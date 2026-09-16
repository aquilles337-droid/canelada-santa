/**
 * Contrato do provedor de pagamento.
 *
 * Nada do Mercado Pago aparece fora desta pasta: o resto do sistema fala
 * apenas com esta interface. Isso permite rodar o desenvolvimento inteiro
 * com um provedor simulado e, no futuro, trocar ou somar outro provedor sem
 * mexer nas regras do racha.
 */

import type { PaymentStatus } from "@/lib/supabase/tipos";

export interface PedidoDePix {
  /** Valor em centavos. Dinheiro nunca trafega como decimal dentro do sistema. */
  valorCentavos: number;
  descricao: string;
  /** Referencia externa — sempre `charge:<id da cobranca>`. */
  referenciaExterna: string;
  /** Chave de idempotencia enviada ao provedor. */
  chaveDeIdempotencia: string;
  pagador: {
    nome: string;
    sobrenome: string;
    email: string;
  };
  minutosParaExpirar: number;
}

export interface PixGerado {
  /** Identificador do pagamento no provedor. */
  idNoProvedor: string;
  situacao: PaymentStatus;
  /** Codigo copia e cola. */
  copiaECola: string | null;
  /** Imagem do QR Code em base64, sem o prefixo data:. */
  qrCodeBase64: string | null;
  /** Pagina do provedor, quando existir. */
  linkDoComprovante: string | null;
  expiraEm: string | null;
  bruto: unknown;
}

export interface SituacaoDoPagamento {
  idNoProvedor: string;
  situacao: PaymentStatus;
  valorCentavos: number;
  pagoEm: string | null;
  referenciaExterna: string | null;
  bruto: unknown;
}

/** Notificacao recebida do provedor, ja interpretada. */
export interface NotificacaoDoProvedor {
  /** Identificador unico do evento, usado para nao processar duas vezes. */
  idDoEvento: string;
  tipo: string;
  idDoPagamento: string | null;
}

export interface ProvedorDePagamento {
  readonly nome: string;

  criarPagamentoPix(pedido: PedidoDePix): Promise<PixGerado>;

  consultarPagamento(idNoProvedor: string): Promise<SituacaoDoPagamento | null>;

  /**
   * Confere a assinatura da notificacao e devolve o que ela representa.
   * Retorna null quando a assinatura nao confere — nesse caso o evento e
   * descartado sem tocar em nada.
   */
  interpretarNotificacao(
    corpo: unknown,
    cabecalhos: Headers,
  ): Promise<NotificacaoDoProvedor | null>;

  /** Assinatura recorrente por cartao. Preparada, desligada por configuracao. */
  criarAssinatura(entrada: {
    profileId: string;
    valorCentavos: number;
    descricao: string;
  }): Promise<{ idNoProvedor: string; linkDeAssinatura: string }>;

  cancelarAssinatura(idNoProvedor: string): Promise<void>;
}

/** Converte centavos para o decimal que os provedores esperam. */
export function centavosParaReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** Converte o decimal devolvido pelo provedor de volta para centavos. */
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}
