import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificacao da assinatura do webhook do Mercado Pago.
 *
 * Funcao pura, separada do provedor de proposito: e o ponto mais sensivel do
 * financeiro e precisa ser testado isoladamente.
 *
 * O Mercado Pago envia `x-signature: ts=<carimbo>,v1=<hmac>` e `x-request-id`.
 * O HMAC e calculado sobre o texto
 * `id:<id do pagamento>;request-id:<id da requisicao>;ts:<carimbo>;`
 * usando a assinatura secreta configurada no painel.
 */

export interface DadosDaAssinatura {
  cabecalhoAssinatura: string | null;
  idDaRequisicao: string | null;
  idDoPagamento: string | null;
  segredo: string | undefined;
}

/** Quebra "ts=123,v1=abc" em { ts: "123", v1: "abc" }. */
export function partesDaAssinatura(cabecalho: string): Record<string, string> {
  return Object.fromEntries(
    cabecalho
      .split(",")
      .map((parte) => {
        const separador = parte.indexOf("=");
        if (separador < 0) return ["", ""];
        return [parte.slice(0, separador).trim(), parte.slice(separador + 1).trim()];
      })
      .filter(([chave]) => chave.length > 0),
  );
}

export function montarManifesto(
  idDoPagamento: string,
  idDaRequisicao: string | null,
  ts: string,
): string {
  return `id:${idDoPagamento};request-id:${idDaRequisicao ?? ""};ts:${ts};`;
}

/**
 * Confere a assinatura. Sem segredo configurado a resposta e sempre falsa:
 * e melhor nao processar do que processar algo forjado.
 */
export function assinaturaValida(dados: DadosDaAssinatura): boolean {
  if (!dados.segredo || !dados.cabecalhoAssinatura || !dados.idDoPagamento) return false;

  const partes = partesDaAssinatura(dados.cabecalhoAssinatura);
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifesto = montarManifesto(dados.idDoPagamento, dados.idDaRequisicao, ts);
  const esperado = createHmac("sha256", dados.segredo).update(manifesto).digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  // Comprimentos diferentes nunca poderiam bater; comparar direto evitaria
  // o timingSafeEqual lancar excecao.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/** Assinatura valida para um evento — usada nos testes e na documentacao. */
export function assinarParaTestes(
  idDoPagamento: string,
  idDaRequisicao: string,
  ts: string,
  segredo: string,
): string {
  const hmac = createHmac("sha256", segredo)
    .update(montarManifesto(idDoPagamento, idDaRequisicao, ts))
    .digest("hex");

  return `ts=${ts},v1=${hmac}`;
}
