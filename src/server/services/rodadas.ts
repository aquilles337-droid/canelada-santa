import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { faixaDe, type ParticipanteDoDominio, type RodadaDoDominio } from "@/domain/tipos";
import { avaliarEdicao, avaliarReabertura, type EdicaoDaRodada } from "@/domain/edicaoDeRodada";
import { formatarDataHora } from "@/lib/format";
import type {
  PrecosDaRodada,
  Profile,
  RegrasDeMulta,
  Round,
  RoundGuest,
  RoundParticipant,
  RoundStatus,
} from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { lerConfiguracoes } from "./configuracoes";
import { notificar } from "./notificacoes";
import { garantirTemporadaAtual } from "./temporadas";

/**
 * Rodadas.
 *
 * Cada rodada e criada manualmente pelo administrador — o sistema nunca
 * inventa um racha semanal sozinho. Na criacao, os precos, as multas e os
 * prazos vigentes sao copiados para dentro da rodada: mudar as configuracoes
 * depois nao reescreve nada que ja aconteceu.
 */

export interface ParticipanteComPerfil extends RoundParticipant {
  perfil: Profile;
}

export interface ConvidadoComAnfitriao extends RoundGuest {
  anfitriao: Profile;
}

export interface RodadaCompleta {
  rodada: Round;
  participantes: ParticipanteComPerfil[];
  convidados: ConvidadoComAnfitriao[];
}

// ------------------------------------------------------------
// Conversao para a camada de regras
// ------------------------------------------------------------

export function rodadaParaDominio(rodada: Round): RodadaDoDominio {
  return {
    id: rodada.id,
    comecaEm: new Date(rodada.starts_at),
    listaFechaEm: new Date(rodada.list_closes_at),
    avulsosLiberadosEm: new Date(rodada.waitlist_unlock_at),
    capacidade: rodada.capacity,
    horasLimiteParaCancelar: rodada.cancel_deadline_hours,
    regrasDeMulta: rodada.fine_rules,
    situacao: rodada.status,
  };
}

export function participanteParaDominio(participante: RoundParticipant): ParticipanteDoDominio {
  return {
    id: participante.id,
    profileId: participante.profile_id,
    tipo: participante.kind,
    faixa: participante.priority_tier,
    situacao: participante.status,
    entrouEm: new Date(participante.joined_at),
    conviteExpiraEm: participante.invite_expires_at ? new Date(participante.invite_expires_at) : null,
  };
}

// ------------------------------------------------------------
// Leitura
// ------------------------------------------------------------

export async function carregarRodada(rodadaId: string): Promise<RodadaCompleta> {
  const admin = clienteAdmin();

  const { data: rodada } = await admin.from("rounds").select("*").eq("id", rodadaId).maybeSingle();
  if (!rodada) throw erroDeRegra("nao_encontrado", "Racha não encontrado.");

  const [{ data: participantes }, { data: convidados }] = await Promise.all([
    admin
      .from("round_participants")
      .select("*, perfil:profiles!round_participants_profile_id_fkey(*)")
      .eq("round_id", rodadaId)
      .order("priority_tier", { ascending: true })
      .order("joined_at", { ascending: true }),
    admin
      .from("round_guests")
      .select("*, anfitriao:profiles!round_guests_host_profile_id_fkey(*)")
      .eq("round_id", rodadaId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    rodada,
    participantes: (participantes ?? []) as unknown as ParticipanteComPerfil[],
    convidados: (convidados ?? []) as unknown as ConvidadoComAnfitriao[],
  };
}

/** A rodada que o jogador ve na tela inicial: a proxima que ainda vai acontecer. */
export async function proximaRodada(): Promise<Round | null> {
  const { data } = await clienteAdmin()
    .from("rounds")
    .select("*")
    .in("status", ["open", "closed", "in_progress"])
    .gte("starts_at", new Date(Date.now() - 6 * 3_600_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function listarRodadas(
  opcoes: { situacoes?: RoundStatus[]; temporadaId?: string; limite?: number } = {},
): Promise<Round[]> {
  let consulta = clienteAdmin().from("rounds").select("*");

  if (opcoes.situacoes?.length) consulta = consulta.in("status", opcoes.situacoes);
  if (opcoes.temporadaId) consulta = consulta.eq("season_id", opcoes.temporadaId);

  const { data } = await consulta
    .order("starts_at", { ascending: false })
    .limit(opcoes.limite ?? 50);

  return data ?? [];
}

// ------------------------------------------------------------
// Criacao
// ------------------------------------------------------------

export interface NovaRodada {
  titulo?: string | null;
  /** Data e hora no fuso do grupo, ja convertidas para UTC pela camada de acao. */
  comecaEm: Date;
  local: string;
  endereco?: string | null;
  capacidade: number;
  quantidadeDeTimes: number;
  jogadoresPorTime?: number | null;
  minutosPorPartida: number;
  golsParaVencer: number;
  listaFechaEm: Date;
  regras?: string | null;
  /** Preco do avulso nesta rodada; sem valor, usa a configuracao atual. */
  precoAvulsoCentavos?: number | null;
  abrirImediatamente?: boolean;
}

export async function criarRodada(entrada: NovaRodada, atorId: string): Promise<Round> {
  const configuracoes = await lerConfiguracoes();
  const temporada = await garantirTemporadaAtual(entrada.comecaEm);

  if (entrada.capacidade < 2) {
    throw erroDeRegra("dados_invalidos", "A quantidade de vagas precisa ser pelo menos 2.");
  }
  if (entrada.quantidadeDeTimes < 2) {
    throw erroDeRegra("dados_invalidos", "O racha precisa de pelo menos 2 times.");
  }
  if (entrada.listaFechaEm > entrada.comecaEm) {
    throw erroDeRegra("dados_invalidos", "A lista precisa fechar antes do início do racha.");
  }
  if (entrada.comecaEm.getTime() <= Date.now()) {
    throw erroDeRegra("dados_invalidos", "A data do racha precisa ser no futuro.");
  }

  // Snapshot: o que valia hoje vale para esta rodada, para sempre.
  const precos: PrecosDaRodada = {
    casual_price_cents: entrada.precoAvulsoCentavos ?? configuracoes.casual_price_cents,
    guest_of_member_price_cents: configuracoes.guest_of_member_price_cents,
    guest_of_casual_price_cents: configuracoes.guest_of_casual_price_cents,
    allow_casual_guests: configuracoes.allow_casual_guests,
    guest_quota_per_member: configuracoes.guest_quota_per_member,
  };

  const multas: RegrasDeMulta = {
    late_cancel_fine_cents: configuracoes.late_cancel_fine_cents,
    no_show_multiplier: configuracoes.no_show_multiplier,
    cancel_deadline_hours: configuracoes.cancel_deadline_hours,
  };

  const liberacaoDeAvulsos = new Date(
    entrada.comecaEm.getTime() - configuracoes.waitlist_unlock_hours * 3_600_000,
  );

  const numero = await proximoNumeroDaRodada(temporada.id);

  const { data, error } = await clienteAdmin()
    .from("rounds")
    .insert({
      season_id: temporada.id,
      number: numero,
      title: entrada.titulo?.trim() || null,
      starts_at: entrada.comecaEm.toISOString(),
      venue: entrada.local.trim(),
      address: entrada.endereco?.trim() || null,
      capacity: entrada.capacidade,
      teams_count: entrada.quantidadeDeTimes,
      players_per_team: entrada.jogadoresPorTime ?? null,
      match_minutes: entrada.minutosPorPartida,
      goals_to_win: entrada.golsParaVencer,
      list_opens_at: new Date().toISOString(),
      list_closes_at: entrada.listaFechaEm.toISOString(),
      waitlist_unlock_at: liberacaoDeAvulsos.toISOString(),
      cancel_deadline_hours: configuracoes.cancel_deadline_hours,
      pricing: precos,
      fine_rules: multas,
      rules: entrada.regras?.trim() || null,
      status: entrada.abrirImediatamente === false ? "draft" : "open",
      created_by: atorId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível criar o racha agora.");
  }

  await registrarAuditoria({
    atorId,
    acao: "rodada.criada",
    entidade: "rounds",
    entidadeId: data.id,
    depois: {
      numero: data.number,
      comeca_em: data.starts_at,
      local: data.venue,
      vagas: data.capacity,
      precos,
      multas,
    },
  });

  if (data.status === "open") {
    await avisarAberturaDaRodada(data);
  }

  return data;
}

// ------------------------------------------------------------
// Edicao
// ------------------------------------------------------------

/**
 * Altera uma rodada que ja existe.
 *
 * O que NAO muda aqui, de proposito: preco e multa. Eles foram copiados para
 * dentro da rodada na criacao justamente para nao mudarem depois de alguem
 * ja ter sido cobrado. Quem precisa mexer em valor mexe em Ajustes, e vale
 * da proxima rodada em diante.
 */
/** O que a tela manda: as regras do dominio mais o texto livre. */
export interface EdicaoCompletaDaRodada extends EdicaoDaRodada {
  titulo?: string | null;
  endereco?: string | null;
  regras?: string | null;
}

export async function editarRodada(
  rodadaId: string,
  entrada: EdicaoCompletaDaRodada,
  atorId: string,
): Promise<{ rodada: Round; chamadosDaFila: number }> {
  const admin = clienteAdmin();

  const { data: atual } = await admin.from("rounds").select("*").eq("id", rodadaId).maybeSingle();
  if (!atual) throw erroDeRegra("nao_encontrado", "Racha não encontrado.");

  // Confirmados e chamados seguram vaga do mesmo jeito: quem foi chamado
  // ainda tem prazo para responder, e a vaga e dele ate la.
  const { count } = await admin
    .from("round_participants")
    .select("id", { count: "exact", head: true })
    .eq("round_id", rodadaId)
    .in("status", ["confirmed", "invited"]);

  const vagasOcupadas = count ?? 0;

  const veredito = avaliarEdicao(
    {
      situacao: atual.status,
      capacidade: atual.capacity,
      vagasOcupadas,
      comecaEm: new Date(atual.starts_at),
      listaFechaEm: new Date(atual.list_closes_at),
      local: atual.venue,
    },
    entrada,
    new Date(),
  );

  if (veredito.problemas.length > 0) {
    throw erroDeRegra("dados_invalidos", veredito.problemas.join(" "));
  }

  // Mover o racha move junto a hora em que os avulsos entram, preservando a
  // distancia com que a rodada foi criada. Sem isso, adiar o racha em um dia
  // deixaria a janela dos mensalistas ja vencida.
  const deslocamento = entrada.comecaEm.getTime() - new Date(atual.starts_at).getTime();
  const liberacaoDeAvulsos = new Date(new Date(atual.waitlist_unlock_at).getTime() + deslocamento);

  const { data, error } = await admin
    .from("rounds")
    .update({
      title: entrada.titulo?.trim() || null,
      starts_at: entrada.comecaEm.toISOString(),
      venue: entrada.local.trim(),
      address: entrada.endereco?.trim() || null,
      capacity: entrada.capacidade,
      teams_count: entrada.quantidadeDeTimes,
      players_per_team: entrada.jogadoresPorTime,
      match_minutes: entrada.minutosPorPartida,
      goals_to_win: entrada.golsParaVencer,
      list_closes_at: entrada.listaFechaEm.toISOString(),
      waitlist_unlock_at: liberacaoDeAvulsos.toISOString(),
      rules: entrada.regras?.trim() || null,
    })
    .eq("id", rodadaId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível salvar as alterações do racha.");
  }

  await registrarAuditoria({
    atorId,
    acao: "rodada.alterada",
    entidade: "rounds",
    entidadeId: rodadaId,
    antes: {
      comeca_em: atual.starts_at,
      local: atual.venue,
      vagas: atual.capacity,
      times: atual.teams_count,
      minutos: atual.match_minutes,
      gols: atual.goals_to_win,
      lista_fecha_em: atual.list_closes_at,
    },
    depois: {
      comeca_em: data.starts_at,
      local: data.venue,
      vagas: data.capacity,
      times: data.teams_count,
      minutos: data.match_minutes,
      gols: data.goals_to_win,
      lista_fecha_em: data.list_closes_at,
    },
  });

  // Abriu vaga: quem esta na espera tem de ser chamado agora, nao na proxima
  // vez que alguem cancelar.
  let chamadosDaFila = 0;
  if (veredito.chamarFila) {
    const { promoverFilaDaRodada } = await import("./presenca");
    chamadosDaFila = await promoverFilaDaRodada(rodadaId);
  }

  if (veredito.avisarOGrupo) {
    await avisarMudancaDaRodada(data, atual);
  }

  return { rodada: data, chamadosDaFila };
}

/** Avisa quem tem vaga que o racha mudou de hora ou de lugar. */
async function avisarMudancaDaRodada(rodada: Round, anterior: Round): Promise<void> {
  const { data: participantes } = await clienteAdmin()
    .from("round_participants")
    .select("profile_id")
    .eq("round_id", rodada.id)
    .in("status", ["confirmed", "invited", "waiting"]);

  const mudouHorario = rodada.starts_at !== anterior.starts_at;
  const mudouLocal = rodada.venue !== anterior.venue;

  const partes: string[] = [];
  if (mudouHorario) partes.push(`agora é ${formatarDataHora(rodada.starts_at)}`);
  if (mudouLocal) partes.push(`o local é ${rodada.venue}`);

  await notificar({
    destinatarios: (participantes ?? []).map((p) => p.profile_id),
    tipo: "rodada.alterada",
    titulo: "📣 Mudou o racha",
    corpo: `${nomeDaRodada(rodada)}: ${partes.join(" e ")}.`,
    url: `/racha/${rodada.id}`,
    dados: { rodadaId: rodada.id },
  });
}

async function proximoNumeroDaRodada(temporadaId: string): Promise<number> {
  const { data } = await clienteAdmin()
    .from("rounds")
    .select("number")
    .eq("season_id", temporadaId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.number ?? 0) + 1;
}

export function nomeDaRodada(rodada: Round): string {
  return rodada.title?.trim() || `Canelada Santa #${rodada.number}`;
}

async function avisarAberturaDaRodada(rodada: Round): Promise<void> {
  const { data: jogadores } = await clienteAdmin()
    .from("profiles")
    .select("id")
    .eq("status", "active");

  await notificar({
    destinatarios: (jogadores ?? []).map((j) => j.id),
    tipo: "rodada.aberta",
    titulo: "⚽ Lista aberta!",
    corpo: `${nomeDaRodada(rodada)} está com a lista aberta. Garanta sua vaga.`,
    url: `/racha/${rodada.id}`,
    dados: { rodadaId: rodada.id },
  });
}

// ------------------------------------------------------------
// Ciclo de vida
// ------------------------------------------------------------

async function mudarSituacaoDaRodada(
  rodadaId: string,
  nova: RoundStatus,
  // Nulo quando quem mudou foi o relógio (tarefa agendada), não uma pessoa.
  atorId: string | null,
  acao: Parameters<typeof registrarAuditoria>[0]["acao"],
  camposExtras: Partial<Round> = {},
): Promise<Round> {
  const { data, error } = await clienteAdmin()
    .from("rounds")
    .update({ status: nova, ...camposExtras })
    .eq("id", rodadaId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível atualizar o racha.");
  }

  await registrarAuditoria({
    atorId,
    acao,
    entidade: "rounds",
    entidadeId: rodadaId,
    depois: { situacao: nova },
  });

  return data;
}

export async function abrirRodada(rodadaId: string, atorId: string): Promise<Round> {
  const rodada = await mudarSituacaoDaRodada(rodadaId, "open", atorId, "rodada.aberta");
  await avisarAberturaDaRodada(rodada);
  return rodada;
}

/**
 * Fecha a lista e acomoda os convidados.
 *
 * E aqui que o convidado entra: so depois de saber quantos jogadores do
 * grupo ficaram de fora e possivel dizer quantas vagas sobraram.
 */
export async function fecharLista(rodadaId: string, atorId: string | null): Promise<Round> {
  const rodada = await mudarSituacaoDaRodada(rodadaId, "closed", atorId, "rodada.fechada", {
    closed_at: new Date().toISOString(),
  });

  const { consolidarConvidados } = await import("./convidados");
  await consolidarConvidados(rodadaId);

  const { data: dentro } = await clienteAdmin()
    .from("round_participants")
    .select("profile_id")
    .eq("round_id", rodadaId)
    .eq("status", "confirmed");

  await notificar({
    destinatarios: (dentro ?? []).map((p) => p.profile_id),
    tipo: "lista.fechada",
    titulo: "Lista fechada",
    corpo: `${nomeDaRodada(rodada)}: a lista está fechada. Nos vemos na quadra!`,
    url: `/racha/${rodada.id}`,
  });

  return rodada;
}

/**
 * Reabre uma lista que já tinha fechado.
 *
 * Exige um horário de fechamento novo porque mudar só a situação não
 * reabriria nada: a regra de entrada recusa quem chega depois do horário de
 * fechamento, e a tarefa automática fecha de novo, no minuto seguinte, toda
 * rodada aberta cujo horário já passou.
 *
 * O que NÃO é desfeito: os convidados que foram acomodados e cobrados
 * quando a lista fechou continuam como estão. Reabrir a lista é abrir vaga
 * para quem ainda não entrou, não cancelar cobrança de quem já entrou.
 */
export async function reabrirLista(
  rodadaId: string,
  novoFechamento: Date,
  atorId: string,
): Promise<Round> {
  const admin = clienteAdmin();

  const { data: atual } = await admin.from("rounds").select("*").eq("id", rodadaId).maybeSingle();
  if (!atual) throw erroDeRegra("nao_encontrado", "Racha não encontrado.");

  const veredito = avaliarReabertura(
    { situacao: atual.status, comecaEm: new Date(atual.starts_at) },
    novoFechamento,
    new Date(),
  );

  if (veredito.problemas.length > 0) {
    throw erroDeRegra("regra_violada", veredito.problemas.join(" "));
  }

  const { data, error } = await admin
    .from("rounds")
    .update({
      status: "open",
      closed_at: null,
      list_closes_at: novoFechamento.toISOString(),
    })
    .eq("id", rodadaId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível reabrir a lista.");
  }

  await registrarAuditoria({
    atorId,
    acao: "rodada.reaberta",
    entidade: "rounds",
    entidadeId: rodadaId,
    antes: { situacao: atual.status, lista_fecha_em: atual.list_closes_at },
    depois: { situacao: data.status, lista_fecha_em: data.list_closes_at },
  });

  // Reabrir sem avisar não serve para nada: quem ficou de fora precisa saber
  // que voltou a caber gente.
  const { data: jogadores } = await admin.from("profiles").select("id").eq("status", "active");

  await notificar({
    destinatarios: (jogadores ?? []).map((j) => j.id),
    tipo: "rodada.reaberta",
    titulo: "🔓 A lista reabriu!",
    corpo: `${nomeDaRodada(data)}: a lista voltou a abrir até ${formatarDataHora(data.list_closes_at)}.`,
    url: `/racha/${data.id}`,
    dados: { rodadaId: data.id },
  });

  return data;
}

export function iniciarRodada(rodadaId: string, atorId: string) {
  return mudarSituacaoDaRodada(rodadaId, "in_progress", atorId, "rodada.aberta");
}

export function finalizarRodada(rodadaId: string, atorId: string) {
  return mudarSituacaoDaRodada(rodadaId, "finished", atorId, "rodada.finalizada", {
    finished_at: new Date().toISOString(),
  });
}

export async function cancelarRodada(rodadaId: string, atorId: string): Promise<Round> {
  const rodada = await mudarSituacaoDaRodada(rodadaId, "cancelled", atorId, "rodada.cancelada");

  const { data: participantes } = await clienteAdmin()
    .from("round_participants")
    .select("profile_id")
    .eq("round_id", rodadaId)
    .in("status", ["confirmed", "waiting", "invited"]);

  await notificar({
    destinatarios: (participantes ?? []).map((p) => p.profile_id),
    tipo: "rodada.cancelada",
    titulo: "Racha cancelado",
    corpo: `${nomeDaRodada(rodada)} foi cancelado.`,
    url: `/racha/${rodada.id}`,
  });

  return rodada;
}

/** Faixa de prioridade a partir do vinculo atual do jogador. */
export function faixaDoPerfil(perfil: Profile): number {
  return faixaDe(perfil.is_member ? "monthly" : "casual");
}
