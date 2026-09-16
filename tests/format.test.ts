import { describe, expect, it } from "vitest";
import { formatarCronometro, formatarDinheiro, formatarNota, iniciais, lerDinheiro, nomeCurto, tempoAte } from "@/lib/format";
import { formatarTelefone, mascararTelefone, normalizarTelefone } from "@/lib/phone";

describe("dinheiro", () => {
  it("mostra centavos como real", () => {
    expect(formatarDinheiro(2500)).toBe("R$ 25,00");
    expect(formatarDinheiro(500)).toBe("R$ 5,00");
    expect(formatarDinheiro(0)).toBe("R$ 0,00");
  });

  it("lê o que o administrador digita", () => {
    expect(lerDinheiro("25")).toBe(2500);
    expect(lerDinheiro("25,50")).toBe(2550);
    expect(lerDinheiro("R$ 10,00")).toBe(1000);
    expect(lerDinheiro("1.250,00")).toBe(125000);
    expect(lerDinheiro("abc")).toBeNull();
  });
});

describe("telefone", () => {
  it("normaliza o que a pessoa digitar", () => {
    expect(normalizarTelefone("(82) 98888-7777")).toBe("5582988887777");
    expect(normalizarTelefone("82988887777")).toBe("5582988887777");
    expect(normalizarTelefone("5582988887777")).toBe("5582988887777");
    expect(normalizarTelefone("+55 82 98888-7777")).toBe("5582988887777");
    expect(normalizarTelefone("8232221111")).toBe("558232221111");
  });

  it("recusa número que não é telefone brasileiro", () => {
    expect(normalizarTelefone("123")).toBeNull();
    expect(normalizarTelefone("0182988887777")).toBeNull();
    expect(normalizarTelefone("82888887777")).toBeNull();
  });

  it("exibe e mascara no formato conhecido", () => {
    expect(formatarTelefone("5582988887777")).toBe("(82) 98888-7777");
    expect(mascararTelefone("82988")).toBe("(82) 988");
    expect(mascararTelefone("82988887777")).toBe("(82) 98888-7777");
  });
});

describe("apresentação", () => {
  it("encurta nome e monta iniciais", () => {
    expect(nomeCurto("João Pedro da Silva")).toBe("João Silva");
    expect(iniciais("João Pedro da Silva")).toBe("JS");
    expect(iniciais("Léo")).toBe("L");
  });

  it("formata cronômetro e nota", () => {
    expect(formatarCronometro(452)).toBe("07:32");
    expect(formatarCronometro(0)).toBe("00:00");
    expect(formatarNota(7.35)).toBe("7,4");
  });

  it("descreve o tempo que falta em linguagem de grupo", () => {
    const agora = new Date("2026-09-15T12:00:00Z");
    expect(tempoAte(new Date("2026-09-15T12:40:00Z"), agora)).toBe("em 40 min");
    expect(tempoAte(new Date("2026-09-15T15:20:00Z"), agora)).toBe("em 3h20");
    expect(tempoAte(new Date("2026-09-17T12:00:00Z"), agora)).toBe("em 2 dias");
    expect(tempoAte(new Date("2026-09-15T11:00:00Z"), agora)).toBe("agora");
  });
});
