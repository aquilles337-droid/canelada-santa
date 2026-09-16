import "server-only";

import { MercadoPagoConfig, Payment } from "mercadopago";
import { env } from "@/lib/env";
import { erroDeRegra } from "@/lib/erros";
import type { PaymentStatus } from "@/lib/supabase/tipos";
import {
  centavosParaReais,
  reaisParaCentavos,
  type NotificacaoDoProvedor,
  type PedidoDePix,
  type PixGerado,
  type ProvedorDePagamento,
  type SituacaoDoPagamento,
} from "./tipos";
import { assinaturaValida } from "./assinatura";

/**
 * Mercado Pago.
 *
 * Duas decisoes de seguranca que valem destacar:
 *
 * 1. A assinatura do webhook e conferida com HMAC antes de qualquer coisa.
 *    Notificacao sem assinatura valida e descartada.
 *
 * 2. Mesmo com assinatura valida, o corpo da notificacao nunca e usado como
 *    verdade sobre o pagamento: o sistema consulta a API do Mercado Pago
 *    para saber a situacao real. O corpo so diz "olhe o pagamento X".
 */

const SITUACOES: Record<string, PaymentStatus> = {
  pending: "pending",
  in_process: "pending",
  in_mediation: "pending",
  authorized: "pending",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
  refunded: "refunded",
  charged_back: "refunded",
};

function traduzirSituacao(situacao: string | undefined): PaymentStatus {
  return SITUACOES[situacao ?? ""] ?? "pending";
}

export class MercadoPagoProvider implements ProvedorDePagamento {
  readonly nome = "mercadopago";

  private readonly pagamentos: Payment;

  constructor(accessToken: string) {
    const cliente = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 15_000 },
    });

    this.pagamentos = new Payment(cliente);
  }

  async criarPagamentoPix(pedido: PedidoDePix): Promise<PixGerado> {
    const cfg = env();
    const expiraEm = new Date(Date.now() + pedido.minutosParaExpirar * 60_000);

    const resposta = await this.pagamentos.create({
      body: {
        transaction_amount: centavosParaReais(pedido.valorCentavos),
        description: pedido.descricao,
        payment_method_id: "pix",
        external_reference: pedido.referenciaExterna,
        notification_url: `${cfg.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
        date_of_expiration: expiraEm.toISOString(),
        payer: {
          email: pedido.pagador.email,
          first_name: pedido.pagador.nome,
          last_name: pedido.pagador.sobrenome,
        },
      },
      // O Mercado Pago usa esta chave para nao criar dois pagamentos quando
      // a mesma requisicao chega duas vezes.
      requestOptions: { idempotencyKey: pedido.chaveDeIdempotencia },
    });

    const dadosDoPix = resposta.point_of_interaction?.transaction_data;

    if (!resposta.id) {
      throw erroDeRegra("servico_indisponivel", "O Mercado Pago não devolveu o pagamento.");
    }

    return {
      idNoProvedor: String(resposta.id),
      situacao: traduzirSituacao(resposta.status),
      copiaECola: dadosDoPix?.qr_code ?? null,
      qrCodeBase64: dadosDoPix?.qr_code_base64 ?? null,
      linkDoComprovante: dadosDoPix?.ticket_url ?? null,
      expiraEm: resposta.date_of_expiration ?? expiraEm.toISOString(),
      bruto: resposta,
    };
  }

  async consultarPagamento(idNoProvedor: string): Promise<SituacaoDoPagamento | null> {
    try {
      const resposta = await this.pagamentos.get({ id: idNoProvedor });
      if (!resposta?.id) return null;

      return {
        idNoProvedor: String(resposta.id),
        situacao: traduzirSituacao(resposta.status),
        valorCentavos: reaisParaCentavos(resposta.transaction_amount ?? 0),
        pagoEm: resposta.date_approved ?? null,
        referenciaExterna: resposta.external_reference ?? null,
        bruto: resposta,
      };
    } catch (erro) {
      console.error("[canelada] falha ao consultar pagamento no Mercado Pago", idNoProvedor, erro);
      return null;
    }
  }

  async interpretarNotificacao(
    corpo: unknown,
    cabecalhos: Headers,
  ): Promise<NotificacaoDoProvedor | null> {
    const dados = corpo as {
      id?: string | number;
      type?: string;
      action?: string;
      data?: { id?: string | number };
    };

    const idDoPagamento = dados.data?.id != null ? String(dados.data.id) : null;

    if (!this.assinaturaConfere(cabecalhos, idDoPagamento)) {
      console.warn("[canelada] notificação do Mercado Pago com assinatura inválida — descartada");
      return null;
    }

    // Um mesmo pagamento gera varias notificacoes (criado, atualizado...).
    // O identificador do evento junta acao e pagamento para nao reprocessar
    // exatamente a mesma coisa, sem perder mudancas de situacao.
    const acao = dados.action ?? dados.type ?? "payment";
    const idDoEvento = `${acao}:${idDoPagamento ?? dados.id ?? "desconhecido"}`;

    return { idDoEvento, tipo: acao, idDoPagamento };
  }

  /** Confere a assinatura HMAC (a logica vive em ./assinatura.ts, testada a parte). */
  private assinaturaConfere(cabecalhos: Headers, idDoPagamento: string | null): boolean {
    return assinaturaValida({
      cabecalhoAssinatura: cabecalhos.get("x-signature"),
      idDaRequisicao: cabecalhos.get("x-request-id"),
      idDoPagamento,
      segredo: env().MP_WEBHOOK_SECRET,
    });
  }

  async criarAssinatura(): Promise<{ idNoProvedor: string; linkDeAssinatura: string }> {
    // A cobranca recorrente por cartao esta prevista na arquitetura, mas so
    // e ligada quando o grupo decidir (settings.recurring_card_enabled).
    throw erroDeRegra(
      "servico_indisponivel",
      "A cobrança recorrente por cartão ainda não está ativada para o grupo.",
    );
  }

  async cancelarAssinatura(): Promise<void> {
    throw erroDeRegra(
      "servico_indisponivel",
      "A cobrança recorrente por cartão ainda não está ativada para o grupo.",
    );
  }
}
