import { describe, expect, it } from "vitest";
import {
  convidadosRestantes,
  nivelValido,
  podeLevarConvidado,
  precoDoConvidado,
  vagasParaConvidados,
  type RegrasDeConvidado,
} from "@/domain/convidados";
import {
  chaveDeCobranca,
  competenciaDoMes,
  mensalidadeVencida,
  vencimentoDaMensalidade,
} from "@/domain/cobrancas";

const REGRAS: RegrasDeConvidado = {
  cotaPorMes: 5,
  permitirConvidadoDeAvulso: false,
  precoConvidadoDeMensalistaCentavos: 500,
  precoConvidadoDeAvulsoCentavos: 1000,
};

function contexto(sobrescrever: Partial<Parameters<typeof podeLevarConvidado>[0]> = {}) {
  return {
    anfitriaoEhMensalista: true,
    convidadosJaUsadosNoMes: 0,
    regras: REGRAS,
    listaAberta: true,
    ...sobrescrever,
  };
}

describe("quem pode levar convidado", () => {
  it("mensalista pode", () => {
    expect(podeLevarConvidado(contexto()).permitido).toBe(true);
  });

  it("avulso não pode, por padrão", () => {
    const veredito = podeLevarConvidado(contexto({ anfitriaoEhMensalista: false }));

    expect(veredito.permitido).toBe(false);
    expect(veredito.motivo).toContain("mensalista");
  });

  it("avulso pode quando o grupo liga essa configuração", () => {
    const veredito = podeLevarConvidado(
      contexto({
        anfitriaoEhMensalista: false,
        regras: { ...REGRAS, permitirConvidadoDeAvulso: true },
      }),
    );

    expect(veredito.permitido).toBe(true);
  });

  it("recusa com a lista fechada", () => {
    expect(podeLevarConvidado(contexto({ listaAberta: false })).permitido).toBe(false);
  });
});

describe("cota mensal de convidados", () => {
  it("deixa levar enquanto sobrar cota", () => {
    expect(podeLevarConvidado(contexto({ convidadosJaUsadosNoMes: 4 })).permitido).toBe(true);
    expect(convidadosRestantes(contexto({ convidadosJaUsadosNoMes: 4 }))).toBe(1);
  });

  it("barra o sexto convidado do mês", () => {
    const veredito = podeLevarConvidado(contexto({ convidadosJaUsadosNoMes: 5 }));

    expect(veredito.permitido).toBe(false);
    expect(veredito.motivo).toContain("5 convidados");
    expect(convidadosRestantes(contexto({ convidadosJaUsadosNoMes: 5 }))).toBe(0);
  });

  it("respeita a cota configurada pelo grupo, não um número fixo", () => {
    const regras = { ...REGRAS, cotaPorMes: 2 };

    expect(podeLevarConvidado(contexto({ regras, convidadosJaUsadosNoMes: 1 })).permitido).toBe(true);
    expect(podeLevarConvidado(contexto({ regras, convidadosJaUsadosNoMes: 2 })).permitido).toBe(false);
  });
});

describe("preço e vaga do convidado", () => {
  it("cobra conforme quem levou", () => {
    expect(precoDoConvidado(true, REGRAS)).toBe(500);
    expect(precoDoConvidado(false, REGRAS)).toBe(1000);
  });

  it("convidado só ocupa o que sobrou depois dos jogadores", () => {
    expect(vagasParaConvidados(20, 18, 0)).toBe(2);
    expect(vagasParaConvidados(20, 20, 0)).toBe(0);
    expect(vagasParaConvidados(20, 18, 2)).toBe(0);
  });

  it("aceita nível só entre 0 e 10", () => {
    expect(nivelValido(0)).toBe(true);
    expect(nivelValido(7.5)).toBe(true);
    expect(nivelValido(10)).toBe(true);
    expect(nivelValido(11)).toBe(false);
    expect(nivelValido(-1)).toBe(false);
  });
});

describe("idempotência das cobranças", () => {
  it("a mesma cobrança sempre gera a mesma chave", () => {
    const chave = chaveDeCobranca("match", { rodadaId: "r1", profileId: "j1" });

    expect(chave).toBe("match:r1:j1");
    expect(chaveDeCobranca("match", { rodadaId: "r1", profileId: "j1" })).toBe(chave);
  });

  it("separa multa de cancelamento de multa por falta", () => {
    const tardia = chaveDeCobranca("fine", { rodadaId: "r1", profileId: "j1", motivo: "late_cancel" });
    const falta = chaveDeCobranca("fine", { rodadaId: "r1", profileId: "j1", motivo: "no_show" });

    expect(tardia).not.toBe(falta);
  });

  it("separa cobranças de rodadas e jogadores diferentes", () => {
    expect(chaveDeCobranca("match", { rodadaId: "r1", profileId: "j1" })).not.toBe(
      chaveDeCobranca("match", { rodadaId: "r2", profileId: "j1" }),
    );
    expect(chaveDeCobranca("guest", { rodadaId: "r1", convidadoId: "c1", profileId: "j1" })).toBe(
      "guest:r1:c1",
    );
  });
});

describe("mensalidade", () => {
  it("usa o primeiro dia do mês como competência", () => {
    expect(competenciaDoMes(new Date("2026-09-15T23:00:00Z"))).toBe("2026-09-01");
  });

  it("usa o fuso do grupo para decidir o mês na virada", () => {
    // 01/10 às 00:30 UTC ainda é 30/09 às 21:30 em Maceió.
    expect(competenciaDoMes(new Date("2026-10-01T00:30:00Z"))).toBe("2026-09-01");
  });

  it("calcula o vencimento no dia configurado", () => {
    expect(vencimentoDaMensalidade("2026-09-01", 10)).toBe("2026-09-10");
    expect(vencimentoDaMensalidade("2026-09-01", 5)).toBe("2026-09-05");
  });

  it("não inventa dia que não existe no mês", () => {
    expect(vencimentoDaMensalidade("2026-02-01", 28)).toBe("2026-02-28");
  });

  it("marca como vencida só depois do fim do dia do vencimento", () => {
    expect(mensalidadeVencida("2026-09-10", new Date("2026-09-10T12:00:00Z"))).toBe(false);
    expect(mensalidadeVencida("2026-09-10", new Date("2026-09-11T12:00:00Z"))).toBe(true);
  });
});
