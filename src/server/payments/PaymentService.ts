import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { erroDeRegra } from "@/lib/erros";
import { formatarDinheiro } from "@/lib/format";
import type { Charge, Json, Payment, Profile } from "@/lib/supabase/tipos";
import { notificar } from "@/server/services/notificacoes";
import { provedorDePagamento } from ".";
import type { PixGerado } from "./tipos";

/**
 * Orquestracao dos pagamentos.
 *
 * Tres garantias que sustentam o financeiro do grupo:
 *
 * 1. O frontend NUNCA confirma pagamento. Voltar para a tela depois de pagar
 *    nao muda nada — quem confirma e o webhook, com consulta a API do
 *    provedor.
 *
 * 2. Todo webhook e registrado em webhook_events, que tem chave unica por
 *    evento. Reenvio do mesmo evento termina em no-op.
 *
 * 3. A confirmacao mexe em pagamento, cobranca e mensalidade dentro de uma
 *    unica transacao no banco, que ainda informa se realmente mudou algo —
 *    e por isso que a notificacao de "pagamento confirmado" sai uma vez so.
 */

export interface PixParaPagar {
  pagamentoId: string;
  copiaECola: string | null;
  qrCodeBase64: string | null;
  linkDoComprovante: string | null;
  expiraEm: string | null;
  valorCentavos: number;
  descricao: string;
}

function referenciaDaCobranca(cobrancaId: string): string {
  return `charge:${cobrancaId}`;
}

/** Divide o nome do jogador no formato que os provedores esperam. */
function separarNome(nomeCompleto: string): { nome: string; sobrenome: string } {
  const partes = nomeCompleto.trim().split(/\s+/);
  return {
    nome: partes[0] ?? "Jogador",
    sobrenome: partes.length > 1 ? partes.slice(1).join(" ") : "Canelada",
  };
}

/**
 * Gera (ou reaproveita) o PIX de uma cobranca.
 *
 * Se ja existe um PIX em aberto e dentro da validade, o mesmo codigo e
 * devolvido: gerar outro so confundiria quem esta pagando.
 */
export async function criarPagamentoPix(cobrancaId: string, perfil: Profile): Promise<PixParaPagar> {
  const admin = clienteAdmin();

  const { data: cobranca } = await admin.from("charges").select("*").eq("id", cobrancaId).maybeSingle();
  if (!cobranca) throw erroDeRegra("nao_encontrado", "Cobrança não encontrada.");

  // Cada um paga o que é seu. Administrador nao gera PIX no nome de outro.
  if (cobranca.profile_id !== perfil.id) {
    throw erroDeRegra("sem_permissao", "Esta cobrança não é sua.");
  }
  if (cobranca.status === "paid") {
    throw erroDeRegra("conflito", "Esta cobrança já está paga.");
  }
  if (cobranca.status === "cancelled" || cobranca.status === "waived") {
    throw erroDeRegra("regra_violada", "Esta cobrança não está mais em aberto.");
  }

  const emAberto = await pixReaproveitavel(cobranca);
  if (emAberto) return emAberto;

  const cfg = env();
  const provedor = provedorDePagamento();
  const { nome, sobrenome } = separarNome(perfil.full_name);

  let gerado: PixGerado;
  try {
    gerado = await provedor.criarPagamentoPix({
      valorCentavos: cobranca.amount_cents,
      descricao: cobranca.description,
      referenciaExterna: referenciaDaCobranca(cobranca.id),
      // A chave inclui a cobranca, entao o provedor tambem nao duplica.
      chaveDeIdempotencia: `canelada:${cobranca.idempotency_key}`,
      pagador: {
        nome,
        sobrenome,
        // O grupo entra por telefone; o provedor exige e-mail, entao usamos
        // o mesmo e-mail sintetico do cadastro.
        email: `${perfil.phone}@${cfg.NEXT_PUBLIC_PHONE_EMAIL_DOMAIN}`,
      },
      minutosParaExpirar: cfg.MP_PIX_EXPIRATION_MINUTES,
    });
  } catch (erro) {
    console.error("[canelada] falha ao gerar PIX", cobranca.id, erro);
    throw erroDeRegra("servico_indisponivel", "Não foi possível gerar o PIX agora. Tente de novo.");
  }

  const { data: pagamento, error } = await admin
    .from("payments")
    .insert({
      charge_id: cobranca.id,
      provider: provedor.nome,
      provider_payment_id: gerado.idNoProvedor,
      external_reference: referenciaDaCobranca(cobranca.id),
      method: "pix",
      status: gerado.situacao,
      amount_cents: cobranca.amount_cents,
      qr_code: gerado.copiaECola,
      qr_code_base64: gerado.qrCodeBase64,
      ticket_url: gerado.linkDoComprovante,
      expires_at: gerado.expiraEm,
      raw: gerado.bruto as Json,
    })
    .select("*")
    .single();

  if (error || !pagamento) {
    // O pagamento ja existia no banco (chave unica do provedor): usamos ele.
    const { data: existente } = await admin
      .from("payments")
      .select("*")
      .eq("provider", provedor.nome)
      .eq("provider_payment_id", gerado.idNoProvedor)
      .maybeSingle();

    if (existente) return montarPix(existente, cobranca);

    throw erroDeRegra("servico_indisponivel", "Não foi possível registrar o pagamento.");
  }

  return montarPix(pagamento, cobranca);
}

async function pixReaproveitavel(cobranca: Charge): Promise<PixParaPagar | null> {
  const { data } = await clienteAdmin()
    .from("payments")
    .select("*")
    .eq("charge_id", cobranca.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.qr_code) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;

  return montarPix(data, cobranca);
}

function montarPix(pagamento: Payment, cobranca: Charge): PixParaPagar {
  return {
    pagamentoId: pagamento.id,
    copiaECola: pagamento.qr_code,
    qrCodeBase64: pagamento.qr_code_base64,
    linkDoComprovante: pagamento.ticket_url,
    expiraEm: pagamento.expires_at,
    valorCentavos: cobranca.amount_cents,
    descricao: cobranca.description,
  };
}

export interface ResultadoDaNotificacao {
  aceita: boolean;
  motivo: string;
}

/**
 * Processa uma notificacao do provedor.
 *
 * Sempre responde "aceita" para o provedor parar de reenviar quando o evento
 * ja foi visto; o campo motivo serve para o log e para os testes.
 */
export async function processarNotificacao(
  corpo: unknown,
  cabecalhos: Headers,
): Promise<ResultadoDaNotificacao> {
  const provedor = provedorDePagamento();
  const admin = clienteAdmin();

  const notificacao = await provedor.interpretarNotificacao(corpo, cabecalhos);
  if (!notificacao) {
    return { aceita: false, motivo: "assinatura_invalida" };
  }

  // A chave unica (provedor, evento) e o que impede reprocessamento: se a
  // linha ja existe, este webhook e repetido e nao faz mais nada.
  const { error: erroDeRegistro } = await admin.from("webhook_events").insert({
    provider: provedor.nome,
    provider_event_id: notificacao.idDoEvento,
    topic: notificacao.tipo,
    payload: (corpo ?? {}) as Json,
  });

  if (erroDeRegistro) {
    if (erroDeRegistro.code === "23505") {
      return { aceita: true, motivo: "evento_repetido" };
    }
    console.error("[canelada] falha ao registrar webhook", erroDeRegistro);
    return { aceita: true, motivo: "falha_ao_registrar" };
  }

  if (!notificacao.idDoPagamento) {
    await marcarEventoProcessado(notificacao.idDoEvento, "sem_pagamento");
    return { aceita: true, motivo: "sem_pagamento" };
  }

  // A verdade sobre o pagamento vem da API do provedor, nunca do corpo da
  // notificacao — que poderia ter sido montado por qualquer um.
  const situacao = await provedor.consultarPagamento(notificacao.idDoPagamento);
  if (!situacao) {
    await marcarEventoProcessado(notificacao.idDoEvento, "pagamento_nao_encontrado");
    return { aceita: true, motivo: "pagamento_nao_encontrado" };
  }

  const { data: resultado, error } = await admin.rpc("confirmar_pagamento", {
    p_provider: provedor.nome,
    p_provider_payment_id: situacao.idNoProvedor,
    p_status: situacao.situacao,
    p_paid_at: situacao.pagoEm,
    p_raw: situacao.bruto as Json,
  });

  if (error) {
    console.error("[canelada] falha ao confirmar pagamento", situacao.idNoProvedor, error);
    await marcarEventoProcessado(notificacao.idDoEvento, "erro", error.message);
    return { aceita: true, motivo: "erro" };
  }

  // A notificacao ao jogador sai apenas na transicao real para pago.
  if (resultado?.mudou && resultado.profile_id) {
    await notificar({
      destinatarios: [resultado.profile_id],
      tipo: "pagamento.confirmado",
      titulo: "Pagamento confirmado ✅",
      corpo: `${resultado.descricao ?? "Pagamento"} — ${formatarDinheiro(resultado.amount_cents ?? 0)}.`,
      url: "/perfil/pagamentos",
      dados: { cobrancaId: resultado.charge_id },
    });
  }

  await marcarEventoProcessado(notificacao.idDoEvento, resultado?.mudou ? "confirmado" : "sem_mudanca");
  return { aceita: true, motivo: resultado?.mudou ? "confirmado" : "sem_mudanca" };
}

async function marcarEventoProcessado(
  idDoEvento: string,
  situacao: string,
  erro?: string,
): Promise<void> {
  await clienteAdmin()
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString(), status: situacao, error: erro ?? null })
    .eq("provider_event_id", idDoEvento);
}

/**
 * Consulta a situacao de um pagamento sob demanda.
 *
 * Usada pelo botao "Já paguei" e pela tarefa agendada, para o caso raro de o
 * webhook nao chegar. O resultado passa pela mesma funcao de confirmacao, ou
 * seja, tambem e idempotente.
 */
export async function conferirPagamento(pagamentoId: string, perfil: Profile): Promise<boolean> {
  const admin = clienteAdmin();

  const { data: pagamento } = await admin
    .from("payments")
    .select("*, cobranca:charges!payments_charge_id_fkey(profile_id)")
    .eq("id", pagamentoId)
    .maybeSingle();

  if (!pagamento?.provider_payment_id) return false;

  const dono = (pagamento as unknown as { cobranca: { profile_id: string } }).cobranca?.profile_id;
  if (dono !== perfil.id && perfil.role !== "admin") {
    throw erroDeRegra("sem_permissao", "Este pagamento não é seu.");
  }

  const situacao = await provedorDePagamento().consultarPagamento(pagamento.provider_payment_id);
  if (!situacao) return false;

  const { data: resultado } = await admin.rpc("confirmar_pagamento", {
    p_provider: pagamento.provider,
    p_provider_payment_id: situacao.idNoProvedor,
    p_status: situacao.situacao,
    p_paid_at: situacao.pagoEm,
    p_raw: situacao.bruto as Json,
  });

  if (resultado?.mudou && resultado.profile_id) {
    await notificar({
      destinatarios: [resultado.profile_id],
      tipo: "pagamento.confirmado",
      titulo: "Pagamento confirmado ✅",
      corpo: `${resultado.descricao ?? "Pagamento"} — ${formatarDinheiro(resultado.amount_cents ?? 0)}.`,
      url: "/perfil/pagamentos",
    });
  }

  return situacao.situacao === "approved";
}
