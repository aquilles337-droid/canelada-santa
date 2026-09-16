import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { erroDeRegra } from "@/lib/erros";
import type {
  NotificacaoDoProvedor,
  PedidoDePix,
  PixGerado,
  ProvedorDePagamento,
  SituacaoDoPagamento,
} from "./tipos";

/**
 * Provedor simulado, para desenvolvimento e testes.
 *
 * Gera um PIX de mentira, com codigo copia e cola claramente identificado
 * como simulacao, e guarda os pagamentos em memoria. Permite exercitar o
 * fluxo inteiro — cobranca, QR Code, webhook, liberacao — sem credencial do
 * Mercado Pago e sem cobrar ninguem.
 *
 * Nunca use em producao: PAYMENT_PROVIDER=mercadopago exige token real.
 */

interface PagamentoSimulado {
  id: string;
  situacao: SituacaoDoPagamento["situacao"];
  valorCentavos: number;
  referenciaExterna: string;
  pagoEm: string | null;
  expiraEm: string;
}

const memoria = new Map<string, PagamentoSimulado>();
// Idempotencia: a mesma chave devolve o mesmo pagamento, como no provedor real.
const porChave = new Map<string, string>();

export class ProvedorSimulado implements ProvedorDePagamento {
  readonly nome = "simulado";

  async criarPagamentoPix(pedido: PedidoDePix): Promise<PixGerado> {
    const jaCriado = porChave.get(pedido.chaveDeIdempotencia);
    if (jaCriado) {
      const existente = memoria.get(jaCriado);
      if (existente) return this.montarResposta(existente, pedido);
    }

    const pagamento: PagamentoSimulado = {
      id: randomUUID(),
      situacao: "pending",
      valorCentavos: pedido.valorCentavos,
      referenciaExterna: pedido.referenciaExterna,
      pagoEm: null,
      expiraEm: new Date(Date.now() + pedido.minutosParaExpirar * 60_000).toISOString(),
    };

    memoria.set(pagamento.id, pagamento);
    porChave.set(pedido.chaveDeIdempotencia, pagamento.id);

    return this.montarResposta(pagamento, pedido);
  }

  private montarResposta(pagamento: PagamentoSimulado, pedido: PedidoDePix): PixGerado {
    const codigo = `00020126SIMULADO-CANELADA-SANTA-${createHash("sha256")
      .update(pagamento.id)
      .digest("hex")
      .slice(0, 24)
      .toUpperCase()}`;

    return {
      idNoProvedor: pagamento.id,
      situacao: pagamento.situacao,
      copiaECola: codigo,
      qrCodeBase64: null,
      linkDoComprovante: null,
      expiraEm: pagamento.expiraEm,
      bruto: { simulado: true, descricao: pedido.descricao },
    };
  }

  async consultarPagamento(idNoProvedor: string): Promise<SituacaoDoPagamento | null> {
    const pagamento = memoria.get(idNoProvedor);
    if (!pagamento) return null;

    return {
      idNoProvedor: pagamento.id,
      situacao: pagamento.situacao,
      valorCentavos: pagamento.valorCentavos,
      pagoEm: pagamento.pagoEm,
      referenciaExterna: pagamento.referenciaExterna,
      bruto: { simulado: true },
    };
  }

  async interpretarNotificacao(corpo: unknown): Promise<NotificacaoDoProvedor | null> {
    const dados = corpo as { action?: string; data?: { id?: string } };
    const idDoPagamento = dados.data?.id ?? null;
    if (!idDoPagamento) return null;

    return {
      idDoEvento: `${dados.action ?? "payment.updated"}:${idDoPagamento}`,
      tipo: dados.action ?? "payment.updated",
      idDoPagamento,
    };
  }

  /** Só existe no simulado: marca o pagamento como aprovado. */
  async aprovarParaTestes(idNoProvedor: string): Promise<void> {
    const pagamento = memoria.get(idNoProvedor);
    if (!pagamento) return;

    pagamento.situacao = "approved";
    pagamento.pagoEm = new Date().toISOString();
  }

  async criarAssinatura(): Promise<{ idNoProvedor: string; linkDeAssinatura: string }> {
    throw erroDeRegra("servico_indisponivel", "Assinatura recorrente não está ativada.");
  }

  async cancelarAssinatura(): Promise<void> {
    throw erroDeRegra("servico_indisponivel", "Assinatura recorrente não está ativada.");
  }
}
