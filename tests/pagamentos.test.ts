import { describe, expect, it } from "vitest";
import {
  assinarParaTestes,
  assinaturaValida,
  montarManifesto,
  partesDaAssinatura,
} from "@/server/payments/assinatura";
import { centavosParaReais, reaisParaCentavos } from "@/server/payments/tipos";

const SEGREDO = "segredo-de-teste-do-canelada-santa";
const PAGAMENTO = "1234567890";
const REQUISICAO = "b3f2c9d1-0000-4444-8888-aaaaaaaaaaaa";
const TS = "1757980800";

describe("assinatura do webhook do Mercado Pago", () => {
  it("aceita uma assinatura legítima", () => {
    const cabecalho = assinarParaTestes(PAGAMENTO, REQUISICAO, TS, SEGREDO);

    expect(
      assinaturaValida({
        cabecalhoAssinatura: cabecalho,
        idDaRequisicao: REQUISICAO,
        idDoPagamento: PAGAMENTO,
        segredo: SEGREDO,
      }),
    ).toBe(true);
  });

  it("recusa assinatura feita com outro segredo", () => {
    const cabecalho = assinarParaTestes(PAGAMENTO, REQUISICAO, TS, "outro-segredo-qualquer");

    expect(
      assinaturaValida({
        cabecalhoAssinatura: cabecalho,
        idDaRequisicao: REQUISICAO,
        idDoPagamento: PAGAMENTO,
        segredo: SEGREDO,
      }),
    ).toBe(false);
  });

  it("recusa quando trocam o pagamento sem refazer a assinatura", () => {
    const cabecalho = assinarParaTestes(PAGAMENTO, REQUISICAO, TS, SEGREDO);

    expect(
      assinaturaValida({
        cabecalhoAssinatura: cabecalho,
        idDaRequisicao: REQUISICAO,
        idDoPagamento: "9999999999",
        segredo: SEGREDO,
      }),
    ).toBe(false);
  });

  it("recusa quando o sistema está sem segredo configurado", () => {
    const cabecalho = assinarParaTestes(PAGAMENTO, REQUISICAO, TS, SEGREDO);

    expect(
      assinaturaValida({
        cabecalhoAssinatura: cabecalho,
        idDaRequisicao: REQUISICAO,
        idDoPagamento: PAGAMENTO,
        segredo: undefined,
      }),
    ).toBe(false);
  });

  it("recusa cabeçalho ausente ou incompleto", () => {
    const base = { idDaRequisicao: REQUISICAO, idDoPagamento: PAGAMENTO, segredo: SEGREDO };

    expect(assinaturaValida({ ...base, cabecalhoAssinatura: null })).toBe(false);
    expect(assinaturaValida({ ...base, cabecalhoAssinatura: "ts=123" })).toBe(false);
    expect(assinaturaValida({ ...base, cabecalhoAssinatura: "v1=abc" })).toBe(false);
    expect(assinaturaValida({ ...base, cabecalhoAssinatura: "lixo" })).toBe(false);
  });

  it("lê o cabeçalho no formato que o Mercado Pago envia", () => {
    expect(partesDaAssinatura("ts=1757980800,v1=abc123")).toEqual({
      ts: "1757980800",
      v1: "abc123",
    });
    expect(partesDaAssinatura(" ts=1 , v1=2 ")).toEqual({ ts: "1", v1: "2" });
  });

  it("monta o manifesto exatamente como a documentação exige", () => {
    expect(montarManifesto("42", "req-1", "1700000000")).toBe(
      "id:42;request-id:req-1;ts:1700000000;",
    );
    expect(montarManifesto("42", null, "1700000000")).toBe("id:42;request-id:;ts:1700000000;");
  });
});

describe("conversão de valores", () => {
  it("converte centavos para o decimal do provedor e volta sem perder nada", () => {
    expect(centavosParaReais(2500)).toBe(25);
    expect(centavosParaReais(1050)).toBe(10.5);
    expect(centavosParaReais(1)).toBe(0.01);

    expect(reaisParaCentavos(25)).toBe(2500);
    expect(reaisParaCentavos(10.5)).toBe(1050);
    // O clássico 0.1 + 0.2 não pode virar 30 centavos errados.
    expect(reaisParaCentavos(0.29)).toBe(29);
    expect(reaisParaCentavos(19.99)).toBe(1999);
  });
});
