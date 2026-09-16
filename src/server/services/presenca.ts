import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import {
  avaliarCancelamento,
  destinoAoEntrar,
  podeEntrarNaRodada,
  vagasLivres,
  type DebitoEmAberto,
} from "@/domain/presenca";
import { janelaDeAvulsosAberta, prazoParaAceitarVaga } from "@/domain/fila";
import { faixaDe } from "@/domain/tipos";
import type { Profile, RoundParticipant } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { lerConfiguracoes } from "./configuracoes";
import { notificar } from "./notificacoes";
import {
  carregarRodada,
  nomeDaRodada,
  participanteParaDominio,
  rodadaParaDominio,
} from "./rodadas";

/**
 * Presenca.
 *
 * As decisoes ficam no dominio (src/domain): se a pessoa pode entrar, se
 * ocupa vaga ou espera, se o cancelamento gera multa. Aqui acontece a
 * orquestracao — ler o estado, chamar a regra, gravar e avisar.
 *
 * A gravacao da vaga usa a funcao reservar_vaga do banco, que trava a
 * rodada: duas pessoas apertando VOU ao mesmo tempo nunca ocupam a mesma
 * vaga.
 */

/** Cobrancas em aberto do jogador, no formato que o dominio entende. */
export async function debitosDoJogador(profileId: string): Promise<DebitoEmAberto[]> {
  const { data } = await clienteAdmin()
    .from("charges")
    .select("id, type, status, amount_cents, round_id, description")
    .eq("profile_id", profileId)
    .in("status", ["pending", "expired"]);

  return (data ?? []).map((cobranca) => ({
    id: cobranca.id,
    tipo: cobranca.type,
    situacao: cobranca.status,
    valorCentavos: cobranca.amount_cents,
    rodadaId: cobranca.round_id,
    descricao: cobranca.description,
  }));
}

export interface ResultadoDaConfirmacao {
  participacao: RoundParticipant;
  entrouNaVaga: boolean;
  posicaoNaEspera: number | null;
}

/** O jogador apertou VOU. */
export async function confirmarPresenca(
  rodadaId: string,
  perfil: Profile,
): Promise<ResultadoDaConfirmacao> {
  const [{ rodada, participantes }, configuracoes, debitos] = await Promise.all([
    carregarRodada(rodadaId),
    lerConfiguracoes(),
    debitosDoJogador(perfil.id),
  ]);

  const agora = new Date();
  const rodadaDominio = rodadaParaDominio(rodada);
  const participantesDominio = participantes.map(participanteParaDominio);
  const minha = participantesDominio.find((p) => p.profileId === perfil.id) ?? null;

  const veredito = podeEntrarNaRodada({
    rodada: rodadaDominio,
    situacaoDoJogador: perfil.status,
    ehMensalista: perfil.is_member,
    participacaoAtual: minha,
    debitos,
    bloquearPorDebito: configuracoes.block_on_debt,
    agora,
  });

  if (!veredito.permitido) {
    const codigo = veredito.motivo?.includes("pagamento") ? "debito_pendente" : "regra_violada";
    throw erroDeRegra(codigo, veredito.motivo ?? "Você não pode entrar neste racha.");
  }

  const destino = destinoAoEntrar({
    ehMensalista: perfil.is_member,
    vagasLivres: vagasLivres(rodadaDominio.capacidade, participantesDominio),
    rodada: rodadaDominio,
    agora,
  });

  const tipo = perfil.is_member ? "monthly" : "casual";

  const { data, error } = await clienteAdmin().rpc("reservar_vaga", {
    p_round_id: rodadaId,
    p_profile_id: perfil.id,
    p_kind: tipo,
    p_tier: faixaDe(tipo),
    // O banco so concede vaga se o dominio disse que ela pode ser ocupada.
    p_pode_ocupar_vaga: destino === "confirmed",
  });

  if (error || !data) {
    if (error?.message?.includes("ja_esta_na_lista")) {
      throw erroDeRegra("conflito", "Você já está nesta lista.");
    }
    throw erroDeRegra("servico_indisponivel", "Não foi possível confirmar sua presença agora.");
  }

  const participacao = data;
  const entrouNaVaga = participacao.status === "confirmed";

  return {
    participacao,
    entrouNaVaga,
    posicaoNaEspera: entrouNaVaga ? null : await posicaoDoJogadorNaFila(rodadaId, perfil.id),
  };
}

/** Posicao atual na fila, contando a partir de 1. */
export async function posicaoDoJogadorNaFila(rodadaId: string, profileId: string): Promise<number | null> {
  const { data } = await clienteAdmin()
    .from("round_participants")
    .select("profile_id")
    .eq("round_id", rodadaId)
    .eq("status", "waiting")
    .order("priority_tier", { ascending: true })
    .order("joined_at", { ascending: true });

  const indice = (data ?? []).findIndex((p) => p.profile_id === profileId);
  return indice >= 0 ? indice + 1 : null;
}

export interface ResultadoDoCancelamento {
  geraMulta: boolean;
  valorDaMultaCentavos: number;
}

/**
 * O jogador apertou NÃO VOU (ou retirou o nome depois de confirmar).
 *
 * Quem so estava na espera nunca paga multa. Quem ocupava vaga dentro do
 * prazo final paga a multa de cancelamento tardio da rodada.
 */
export async function cancelarPresenca(
  rodadaId: string,
  perfil: Profile,
): Promise<ResultadoDoCancelamento> {
  const { rodada, participantes } = await carregarRodada(rodadaId);
  const agora = new Date();

  const minha = participantes.find((p) => p.profile_id === perfil.id);
  if (!minha || !["confirmed", "waiting", "invited"].includes(minha.status)) {
    throw erroDeRegra("nao_encontrado", "Você não está nesta lista.");
  }

  if (rodada.status === "finished" || rodada.status === "cancelled") {
    throw erroDeRegra("regra_violada", "Este racha já foi encerrado.");
  }

  const rodadaDominio = rodadaParaDominio(rodada);
  const avaliacao = avaliarCancelamento(rodadaDominio, participanteParaDominio(minha), agora);
  const ocupavaVaga = minha.status === "confirmed" || minha.status === "invited";

  const { error } = await clienteAdmin()
    .from("round_participants")
    .update({
      status: minha.status === "waiting" ? "declined" : "cancelled",
      cancelled_at: agora.toISOString(),
      cancel_was_late: avaliacao.geraMulta,
      invite_expires_at: null,
    })
    .eq("id", minha.id);

  if (error) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível retirar seu nome agora.");
  }

  // A vaga que abriu chama a proxima pessoa da fila imediatamente.
  if (ocupavaVaga) {
    await promoverFilaDaRodada(rodadaId);
  }

  return { geraMulta: avaliacao.geraMulta, valorDaMultaCentavos: avaliacao.valorCentavos };
}

/** O jogador aceitou a vaga que abriu para ele. */
export async function aceitarVaga(rodadaId: string, perfil: Profile): Promise<RoundParticipant> {
  const { participantes } = await carregarRodada(rodadaId);
  const minha = participantes.find((p) => p.profile_id === perfil.id);

  if (!minha) throw erroDeRegra("nao_encontrado", "Você não está nesta lista.");
  if (minha.status !== "invited") {
    throw erroDeRegra("regra_violada", "Você não tem uma vaga para aceitar agora.");
  }

  const { data, error } = await clienteAdmin().rpc("aceitar_vaga", { p_participant_id: minha.id });

  if (error || !data) {
    if (error?.message?.includes("convite_expirado")) {
      throw erroDeRegra("prazo_expirado", "O prazo para aceitar a vaga acabou.");
    }
    throw erroDeRegra("servico_indisponivel", "Não foi possível aceitar a vaga agora.");
  }

  return data;
}

/**
 * Chama da fila quem couber nas vagas livres e avisa cada pessoa.
 *
 * Usada quando alguem cancela, quando o administrador aumenta as vagas e
 * pela tarefa agendada que roda a cada minuto.
 */
export async function promoverFilaDaRodada(rodadaId: string): Promise<number> {
  const [{ rodada }, configuracoes] = await Promise.all([carregarRodada(rodadaId), lerConfiguracoes()]);

  if (rodada.status !== "open" && rodada.status !== "closed") return 0;

  const agora = new Date();
  const rodadaDominio = rodadaParaDominio(rodada);
  const permitirAvulsos = janelaDeAvulsosAberta(rodadaDominio, agora);

  const expiraEm = prazoParaAceitarVaga(rodadaDominio, agora, {
    minutosParaAceitar: configuracoes.waitlist_accept_minutes,
    minutosParaAceitarUrgente: configuracoes.waitlist_accept_minutes_urgent,
    horasParaConsiderarUrgente: configuracoes.waitlist_urgent_threshold_hours,
  });

  const { data, error } = await clienteAdmin().rpc("promover_fila", {
    p_round_id: rodadaId,
    p_permitir_avulsos: permitirAvulsos,
    p_expira_em: expiraEm.toISOString(),
  });

  if (error || !data || data.length === 0) return 0;

  const minutos = Math.max(1, Math.round((expiraEm.getTime() - agora.getTime()) / 60_000));

  await notificar({
    destinatarios: data.map((p) => p.profile_id),
    tipo: "vaga.liberada",
    titulo: "Você ganhou uma vaga no Canelada Santa! ⚽",
    corpo: `Confirme em até ${minutos} minutos para garantir sua vaga em ${nomeDaRodada(rodada)}.`,
    url: `/racha/${rodada.id}`,
    dados: { rodadaId: rodada.id, expiraEm: expiraEm.toISOString() },
  });

  return data.length;
}

/**
 * Recolhe as vagas de quem nao respondeu no prazo e chama os proximos.
 * Executada pela tarefa agendada.
 */
export async function expirarConvitesDeVaga(rodadaId?: string): Promise<number> {
  const { data, error } = await clienteAdmin().rpc("expirar_convites_de_vaga", {
    p_round_id: rodadaId ?? null,
  });

  if (error || !data || data.length === 0) return 0;

  await notificar({
    destinatarios: data.map((p) => p.profile_id),
    tipo: "vaga.perdida",
    titulo: "O prazo da sua vaga acabou",
    corpo: "Você voltou para a lista de espera. Se abrir outra vaga, avisamos de novo.",
    url: "/inicio",
  });

  // Cada vaga devolvida pode ser oferecida a proxima pessoa da fila.
  const rodadas = [...new Set(data.map((p) => p.round_id))];
  for (const id of rodadas) {
    await promoverFilaDaRodada(id);
  }

  return data.length;
}

/** Remocao feita pelo administrador (por exemplo, jogador que nao vai mais). */
export async function removerParticipante(
  rodadaId: string,
  participacaoId: string,
  atorId: string,
): Promise<void> {
  const { error } = await clienteAdmin()
    .from("round_participants")
    .update({ status: "removed", cancelled_at: new Date().toISOString(), invite_expires_at: null })
    .eq("id", participacaoId)
    .eq("round_id", rodadaId);

  if (error) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível remover o jogador.");
  }

  await registrarAuditoria({
    atorId,
    acao: "presenca.removido_pelo_admin",
    entidade: "round_participants",
    entidadeId: participacaoId,
  });

  await promoverFilaDaRodada(rodadaId);
}

/**
 * Estado da presenca do jogador nesta rodada, no formato que a tela usa.
 * Junta a participacao, a posicao na fila e o veredito das regras.
 */
export async function montarEstadoDePresenca(
  rodadaId: string,
  perfil: Profile,
): Promise<{
  situacao: RoundParticipant["status"] | null;
  posicaoNaEspera: number | null;
  conviteExpiraEm: string | null;
  podeEntrar: boolean;
  motivo: string | null;
}> {
  const [{ rodada, participantes }, configuracoes, debitos] = await Promise.all([
    carregarRodada(rodadaId),
    lerConfiguracoes(),
    debitosDoJogador(perfil.id),
  ]);

  const minha = participantes.find((p) => p.profile_id === perfil.id) ?? null;
  const participantesDominio = participantes.map(participanteParaDominio);

  const veredito = podeEntrarNaRodada({
    rodada: rodadaParaDominio(rodada),
    situacaoDoJogador: perfil.status,
    ehMensalista: perfil.is_member,
    participacaoAtual: minha ? participanteParaDominio(minha) : null,
    debitos,
    bloquearPorDebito: configuracoes.block_on_debt,
    agora: new Date(),
  });

  const naEspera = minha?.status === "waiting";
  const fila = participantesDominio
    .filter((p) => p.situacao === "waiting")
    .sort((a, b) => a.faixa - b.faixa || a.entrouEm.getTime() - b.entrouEm.getTime());

  const posicao = naEspera ? fila.findIndex((p) => p.profileId === perfil.id) + 1 : null;

  return {
    situacao: minha?.status ?? null,
    posicaoNaEspera: posicao && posicao > 0 ? posicao : null,
    conviteExpiraEm: minha?.invite_expires_at ?? null,
    podeEntrar: veredito.permitido,
    motivo: veredito.motivo ?? null,
  };
}
