import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import {
  nivelValido,
  podeLevarConvidado,
  precoDoConvidado,
  type RegrasDeConvidado,
} from "@/domain/convidados";
import { competenciaDoMes } from "@/domain/cobrancas";
import type { Profile, Round, RoundGuest } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";
import { cobrarConvidado } from "./cobrancas";
import { carregarRodada, nomeDaRodada } from "./rodadas";

/**
 * Convidados.
 *
 * O convidado nao tem conta: ele existe preso ao mensalista que o levou.
 * Entra sempre por ultimo — so ocupa vaga que sobrou depois de todos os
 * jogadores do grupo — e a cobranca dele vai para o anfitriao.
 */

/** Regras vigentes para a rodada, vindas do snapshot gravado nela. */
export function regrasDaRodada(rodada: Round): RegrasDeConvidado {
  return {
    cotaPorMes: rodada.pricing.guest_quota_per_member,
    permitirConvidadoDeAvulso: rodada.pricing.allow_casual_guests,
    precoConvidadoDeMensalistaCentavos: rodada.pricing.guest_of_member_price_cents,
    precoConvidadoDeAvulsoCentavos: rodada.pricing.guest_of_casual_price_cents,
  };
}

/** Quantos convidados o anfitriao ja levou no mes da rodada. */
export async function convidadosUsadosNoMes(anfitriaoId: string, referencia: Date): Promise<number> {
  const { data } = await clienteAdmin().rpc("convidados_usados_no_mes", {
    p_host_profile_id: anfitriaoId,
    p_competencia: competenciaDoMes(referencia),
  });

  return data ?? 0;
}

export interface SituacaoDaCota {
  cota: number;
  usados: number;
  restantes: number;
  podeLevar: boolean;
  motivo: string | null;
  precoCentavos: number;
}

export async function situacaoDaCota(rodada: Round, anfitriao: Profile): Promise<SituacaoDaCota> {
  const regras = regrasDaRodada(rodada);
  const usados = await convidadosUsadosNoMes(anfitriao.id, new Date(rodada.starts_at));

  const veredito = podeLevarConvidado({
    anfitriaoEhMensalista: anfitriao.is_member,
    convidadosJaUsadosNoMes: usados,
    regras,
    listaAberta: rodada.status === "open",
  });

  return {
    cota: regras.cotaPorMes,
    usados,
    restantes: Math.max(0, regras.cotaPorMes - usados),
    podeLevar: veredito.permitido,
    motivo: veredito.motivo ?? null,
    precoCentavos: precoDoConvidado(anfitriao.is_member, regras),
  };
}

export async function adicionarConvidado(
  rodadaId: string,
  anfitriao: Profile,
  nome: string,
  nivel: number,
): Promise<RoundGuest> {
  const { rodada } = await carregarRodada(rodadaId);

  const nomeLimpo = nome.trim().replace(/\s+/g, " ");
  if (nomeLimpo.length < 2 || nomeLimpo.length > 60) {
    throw erroDeRegra("dados_invalidos", "Informe o nome do convidado.");
  }
  if (!nivelValido(nivel)) {
    throw erroDeRegra("dados_invalidos", "O nível do convidado vai de 0 a 10.");
  }

  const cota = await situacaoDaCota(rodada, anfitriao);
  if (!cota.podeLevar) {
    throw erroDeRegra("regra_violada", cota.motivo ?? "Você não pode levar convidado neste racha.");
  }

  const { data, error } = await clienteAdmin()
    .from("round_guests")
    .insert({
      round_id: rodadaId,
      host_profile_id: anfitriao.id,
      name: nomeLimpo,
      skill_level: nivel,
      status: "waiting",
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw erroDeRegra("conflito", "Você já cadastrou um convidado com esse nome neste racha.");
    }
    throw erroDeRegra("servico_indisponivel", "Não foi possível cadastrar o convidado agora.");
  }

  await registrarAuditoria({
    atorId: anfitriao.id,
    acao: "convidado.adicionado",
    entidade: "round_guests",
    entidadeId: data.id,
    depois: { rodada: nomeDaRodada(rodada), convidado: nomeLimpo, nivel },
  });

  return data;
}

export async function removerConvidado(
  convidadoId: string,
  ator: Profile,
): Promise<void> {
  const admin = clienteAdmin();

  const { data: convidado } = await admin
    .from("round_guests")
    .select("*")
    .eq("id", convidadoId)
    .maybeSingle();

  if (!convidado) throw erroDeRegra("nao_encontrado", "Convidado não encontrado.");

  // Só quem levou, ou um administrador, pode tirar o convidado da lista.
  if (convidado.host_profile_id !== ator.id && ator.role !== "admin") {
    throw erroDeRegra("sem_permissao", "Só quem convidou pode retirar este convidado.");
  }

  await admin.from("round_guests").update({ status: "cancelled" }).eq("id", convidadoId);

  // A cobranca do convidado, se ja existir e ainda estiver em aberto, cai junto.
  await admin
    .from("charges")
    .update({ status: "cancelled" })
    .eq("guest_id", convidadoId)
    .eq("status", "pending");

  await registrarAuditoria({
    atorId: ator.id,
    acao: "convidado.removido",
    entidade: "round_guests",
    entidadeId: convidadoId,
    depois: { convidado: convidado.name },
  });
}

/**
 * Acomoda os convidados nas vagas que sobraram e gera as cobrancas.
 *
 * Roda quando a lista fecha: nesse momento ja se sabe quantos jogadores do
 * grupo ficaram de fora, e o convidado so entra no que sobrou.
 */
export async function consolidarConvidados(rodadaId: string): Promise<number> {
  const { rodada } = await carregarRodada(rodadaId);

  const { data: confirmados, error } = await clienteAdmin().rpc("consolidar_convidados", {
    p_round_id: rodadaId,
  });

  if (error || !confirmados || confirmados.length === 0) {
    await cancelarConvidadosSemVaga(rodadaId);
    return 0;
  }

  const regras = regrasDaRodada(rodada);
  const anfitrioes = new Map<string, Profile>();

  const { data: perfis } = await clienteAdmin()
    .from("profiles")
    .select("*")
    .in("id", [...new Set(confirmados.map((c) => c.host_profile_id))]);

  for (const perfil of perfis ?? []) anfitrioes.set(perfil.id, perfil);

  for (const convidado of confirmados) {
    const anfitriao = anfitrioes.get(convidado.host_profile_id);
    if (!anfitriao) continue;

    await cobrarConvidado(
      rodada,
      anfitriao,
      convidado.id,
      convidado.name,
      precoDoConvidado(anfitriao.is_member, regras),
    );
  }

  await cancelarConvidadosSemVaga(rodadaId);
  return confirmados.length;
}

/** Quem nao coube volta a ficar livre e devolve a cota do anfitriao. */
async function cancelarConvidadosSemVaga(rodadaId: string): Promise<void> {
  await clienteAdmin()
    .from("round_guests")
    .update({ status: "cancelled" })
    .eq("round_id", rodadaId)
    .eq("status", "waiting");
}

export async function convidadosDaRodada(rodadaId: string): Promise<RoundGuest[]> {
  const { data } = await clienteAdmin()
    .from("round_guests")
    .select("*")
    .eq("round_id", rodadaId)
    .order("created_at", { ascending: true });

  return data ?? [];
}
