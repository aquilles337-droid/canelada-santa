import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { chaveDeCobranca } from "@/domain/cobrancas";
import type { MotivoDeMulta } from "@/domain/presenca";
import type { Charge, ChargeType, Profile, Round } from "@/lib/supabase/tipos";
import { formatarData, formatarDinheiro } from "@/lib/format";
import { registrarAuditoria } from "./auditoria";
import { notificar } from "./notificacoes";
import { nomeDaRodada } from "./rodadas";

/**
 * Cobrancas.
 *
 * Toda criacao passa por `criarCobranca`, que usa a chave de idempotencia:
 * se a mesma cobranca ja existe, a existente e devolvida em vez de uma nova
 * ser criada. E o que garante que repetir uma acao (ou um webhook chegar
 * duas vezes) nunca duplique dinheiro.
 */

export interface NovaCobranca {
  profileId: string;
  tipo: ChargeType;
  valorCentavos: number;
  descricao: string;
  chave: string;
  rodadaId?: string | null;
  convidadoId?: string | null;
  mensalidadeId?: string | null;
  subtipo?: string | null;
  vencimento?: string | null;
  criadoPor?: string | null;
}

export async function criarCobranca(entrada: NovaCobranca): Promise<Charge> {
  const admin = clienteAdmin();

  const { data, error } = await admin
    .from("charges")
    .insert({
      profile_id: entrada.profileId,
      round_id: entrada.rodadaId ?? null,
      guest_id: entrada.convidadoId ?? null,
      membership_id: entrada.mensalidadeId ?? null,
      type: entrada.tipo,
      subtype: entrada.subtipo ?? null,
      amount_cents: entrada.valorCentavos,
      description: entrada.descricao,
      due_date: entrada.vencimento ?? null,
      idempotency_key: entrada.chave,
      created_by: entrada.criadoPor ?? null,
    })
    .select("*")
    .single();

  if (data) return data;

  // 23505 = a cobranca ja existia. Idempotencia: devolvemos a que ja esta la.
  if (error?.code === "23505") {
    const { data: existente } = await admin
      .from("charges")
      .select("*")
      .eq("idempotency_key", entrada.chave)
      .single();

    if (existente) return existente;
  }

  throw erroDeRegra("servico_indisponivel", "Não foi possível gerar a cobrança agora.");
}

/** Cobranca do jogo avulso, criada quando o avulso ocupa a vaga. */
export async function cobrarAvulso(rodada: Round, perfil: Profile): Promise<Charge | null> {
  const valor = rodada.pricing.casual_price_cents;
  if (valor <= 0) return null;

  const cobranca = await criarCobranca({
    profileId: perfil.id,
    tipo: "match",
    valorCentavos: valor,
    descricao: `Avulso · ${nomeDaRodada(rodada)}`,
    chave: chaveDeCobranca("match", { rodadaId: rodada.id, profileId: perfil.id }),
    rodadaId: rodada.id,
    vencimento: rodada.starts_at.slice(0, 10),
  });

  await notificar({
    destinatarios: [perfil.id],
    tipo: "pagamento.pendente",
    titulo: "Pagamento do racha",
    corpo: `${formatarDinheiro(valor)} pelo ${nomeDaRodada(rodada)}. Pague pelo aplicativo.`,
    url: `/perfil/pagamentos`,
    dados: { cobrancaId: cobranca.id },
  });

  return cobranca;
}

/** Cobranca do convidado. Quem paga e sempre o anfitriao que levou. */
export async function cobrarConvidado(
  rodada: Round,
  anfitriao: Profile,
  convidadoId: string,
  nomeDoConvidado: string,
  valorCentavos: number,
): Promise<Charge | null> {
  if (valorCentavos <= 0) return null;

  return criarCobranca({
    profileId: anfitriao.id,
    tipo: "guest",
    valorCentavos,
    descricao: `Convidado ${nomeDoConvidado} · ${nomeDaRodada(rodada)}`,
    chave: chaveDeCobranca("guest", { rodadaId: rodada.id, convidadoId, profileId: anfitriao.id }),
    rodadaId: rodada.id,
    convidadoId,
    vencimento: rodada.starts_at.slice(0, 10),
  });
}

/** Multa de cancelamento tardio ou de falta sem aviso. */
export async function cobrarMulta(
  rodada: Round,
  perfil: Profile,
  motivo: MotivoDeMulta,
  valorCentavos: number,
  atorId?: string | null,
): Promise<Charge | null> {
  if (valorCentavos <= 0) return null;

  const descricao =
    motivo === "late_cancel"
      ? `Multa por desistir em cima da hora · ${nomeDaRodada(rodada)}`
      : `Multa por faltar sem avisar · ${nomeDaRodada(rodada)}`;

  const cobranca = await criarCobranca({
    profileId: perfil.id,
    tipo: "fine",
    subtipo: motivo,
    valorCentavos,
    descricao,
    chave: chaveDeCobranca("fine", { rodadaId: rodada.id, profileId: perfil.id, motivo }),
    rodadaId: rodada.id,
    criadoPor: atorId ?? null,
  });

  await registrarAuditoria({
    atorId: atorId ?? null,
    acao: "multa.criada",
    entidade: "charges",
    entidadeId: cobranca.id,
    depois: { jogador: perfil.full_name, motivo, valor: valorCentavos },
  });

  await notificar({
    destinatarios: [perfil.id],
    tipo: "multa.aplicada",
    titulo: "Multa aplicada",
    corpo: `${descricao} — ${formatarDinheiro(valorCentavos)}.`,
    url: "/perfil/pagamentos",
    dados: { cobrancaId: cobranca.id },
  });

  return cobranca;
}

/** Cancela uma cobranca que ainda nao foi paga. */
export async function cancelarCobranca(
  chave: string,
  atorId?: string | null,
  motivo?: string,
): Promise<void> {
  const admin = clienteAdmin();

  const { data } = await admin
    .from("charges")
    .update({ status: "cancelled" })
    .eq("idempotency_key", chave)
    .eq("status", "pending")
    .select("id, profile_id, amount_cents");

  if (data && data.length > 0 && atorId) {
    await registrarAuditoria({
      atorId,
      acao: "cobranca.cancelada",
      entidade: "charges",
      entidadeId: data[0]?.id ?? null,
      depois: { motivo: motivo ?? null },
    });
  }
}

/** Cobrancas em aberto do jogador, das mais antigas para as mais novas. */
export async function cobrancasEmAberto(profileId: string): Promise<Charge[]> {
  const { data } = await clienteAdmin()
    .from("charges")
    .select("*")
    .eq("profile_id", profileId)
    .in("status", ["pending", "expired"])
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function historicoDeCobrancas(profileId: string, limite = 60): Promise<Charge[]> {
  const { data } = await clienteAdmin()
    .from("charges")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limite);

  return data ?? [];
}

/** Baixa manual feita pelo administrador (ex.: pagamento em dinheiro na quadra). */
export async function baixarCobrancaManualmente(
  cobrancaId: string,
  atorId: string,
  observacao?: string,
): Promise<Charge> {
  const admin = clienteAdmin();

  const { data: antes } = await admin.from("charges").select("*").eq("id", cobrancaId).maybeSingle();
  if (!antes) throw erroDeRegra("nao_encontrado", "Cobrança não encontrada.");
  if (antes.status === "paid") return antes;

  const { data, error } = await admin
    .from("charges")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", cobrancaId)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível dar baixa na cobrança.");
  }

  if (data.membership_id) {
    await admin
      .from("memberships")
      .update({ status: "paid", paid_at: data.paid_at })
      .eq("id", data.membership_id);
  }

  await registrarAuditoria({
    atorId,
    acao: "cobranca.baixada_manualmente",
    entidade: "charges",
    entidadeId: cobrancaId,
    antes: { situacao: antes.status },
    depois: { situacao: "paid", observacao: observacao ?? null },
  });

  await notificar({
    destinatarios: [data.profile_id],
    tipo: "pagamento.confirmado",
    titulo: "Pagamento confirmado ✅",
    corpo: `${data.description} — ${formatarDinheiro(data.amount_cents)}${
      data.due_date ? ` (venc. ${formatarData(data.due_date)})` : ""
    }.`,
    url: "/perfil/pagamentos",
  });

  return data;
}

/** Perdoa uma cobranca sem apagar o historico. */
export async function perdoarCobranca(cobrancaId: string, atorId: string, motivo: string): Promise<void> {
  const { error } = await clienteAdmin()
    .from("charges")
    .update({ status: "waived" })
    .eq("id", cobrancaId)
    .in("status", ["pending", "expired"]);

  if (error) throw erroDeRegra("servico_indisponivel", "Não foi possível perdoar a cobrança.");

  await registrarAuditoria({
    atorId,
    acao: "cobranca.perdoada",
    entidade: "charges",
    entidadeId: cobrancaId,
    depois: { motivo },
  });
}
