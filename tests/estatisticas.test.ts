import { describe, expect, it } from "vitest";
import {
  calcularAproveitamento,
  calcularAssiduidade,
  calcularSequencia,
  ordenarRanking,
  posicaoNoRanking,
  type LinhaDeRanking,
} from "@/domain/estatisticas";
import { inicioDaTemporada } from "@/domain/temporada";

describe("assiduidade", () => {
  it("é presença dividida pelas rodadas em que estava apto", () => {
    // Exemplo do documento: 10 presenças em 50 rachas = 20%.
    expect(calcularAssiduidade(10, 50)).toBeCloseTo(0.2);
    expect(calcularAssiduidade(25, 25)).toBe(1);
    expect(calcularAssiduidade(0, 30)).toBe(0);
  });

  it("não penaliza quem entrou depois", () => {
    // Quem entrou no meio da temporada: 8 presenças em 10 rodadas aptas.
    expect(calcularAssiduidade(8, 10)).toBeCloseTo(0.8);
  });

  it("não divide por zero para quem nunca teve rodada apta", () => {
    expect(calcularAssiduidade(0, 0)).toBe(0);
  });
});

describe("sequência de presenças", () => {
  const presente = { compareceu: true };
  const ausente = { compareceu: false };

  it("conta os rachas seguidos", () => {
    const sequencia = calcularSequencia([presente, presente, presente]);
    expect(sequencia).toEqual({ atual: 3, maior: 3 });
  });

  it("zera a sequência atual quando o jogador falta", () => {
    const sequencia = calcularSequencia([presente, presente, presente, ausente]);
    expect(sequencia.atual).toBe(0);
    expect(sequencia.maior).toBe(3);
  });

  it("guarda a maior sequência histórica mesmo depois de quebrar", () => {
    const sequencia = calcularSequencia([
      presente, presente, presente, presente, presente, presente, presente,
      ausente,
      presente, presente,
    ]);

    expect(sequencia.maior).toBe(7);
    expect(sequencia.atual).toBe(2);
  });

  it("lida com quem nunca jogou", () => {
    expect(calcularSequencia([])).toEqual({ atual: 0, maior: 0 });
  });
});

describe("aproveitamento", () => {
  it("usa o critério de tabela que o grupo conhece", () => {
    expect(calcularAproveitamento(10, 0, 0)).toBe(1);
    expect(calcularAproveitamento(0, 0, 10)).toBe(0);
    expect(calcularAproveitamento(5, 5, 0)).toBeCloseTo(20 / 30);
  });

  it("não divide por zero para quem não jogou partida nenhuma", () => {
    expect(calcularAproveitamento(0, 0, 0)).toBe(0);
  });
});

describe("ranking", () => {
  const linhas: LinhaDeRanking[] = [
    { profileId: "a", presencas: 20, assiduidade: 0.8, gols: 12, assistencias: 5, vitorias: 30, nota: 7.5, craques: 2 },
    { profileId: "b", presencas: 25, assiduidade: 0.9, gols: 12, assistencias: 9, vitorias: 28, nota: 8.1, craques: 1 },
    { profileId: "c", presencas: 10, assiduidade: 0.5, gols: 3, assistencias: 1, vitorias: 9, nota: 6.0, craques: 0 },
  ];

  it("ordena pelo critério escolhido", () => {
    expect(ordenarRanking(linhas, "presencas").map((l) => l.profileId)).toEqual(["b", "a", "c"]);
    expect(ordenarRanking(linhas, "assistencias").map((l) => l.profileId)).toEqual(["b", "a", "c"]);
    expect(ordenarRanking(linhas, "nota").map((l) => l.profileId)).toEqual(["b", "a", "c"]);
  });

  it("desempata por presenças e mantém a ordem estável", () => {
    // "a" e "b" empatam em gols; "b" tem mais presenças e fica na frente.
    expect(ordenarRanking(linhas, "gols").map((l) => l.profileId)).toEqual(["b", "a", "c"]);
    expect(ordenarRanking(linhas, "gols").map((l) => l.profileId)).toEqual(
      ordenarRanking(linhas, "gols").map((l) => l.profileId),
    );
  });

  it("informa a posição do jogador", () => {
    expect(posicaoNoRanking(linhas, "b", "presencas")).toBe(1);
    expect(posicaoNoRanking(linhas, "c", "presencas")).toBe(3);
    expect(posicaoNoRanking(linhas, "inexistente")).toBeNull();
  });
});

describe("virada de temporada", () => {
  const configuracoes = { season_start_month: 1, season_start_day: 10 };

  it("a temporada 2026 começa em 10 de janeiro de 2026", () => {
    expect(inicioDaTemporada(new Date("2026-09-15T12:00:00Z"), configuracoes)).toEqual(
      new Date("2026-01-10T00:00:00.000Z"),
    );
  });

  it("antes da virada, ainda é a temporada do ano anterior", () => {
    expect(inicioDaTemporada(new Date("2027-01-05T12:00:00Z"), configuracoes)).toEqual(
      new Date("2026-01-10T00:00:00.000Z"),
    );
  });

  it("no dia 10 de janeiro a temporada nova já começou", () => {
    expect(inicioDaTemporada(new Date("2027-01-10T00:00:00Z"), configuracoes)).toEqual(
      new Date("2027-01-10T00:00:00.000Z"),
    );
  });

  it("respeita a data de virada configurada pelo grupo", () => {
    expect(
      inicioDaTemporada(new Date("2026-03-15T12:00:00Z"), { season_start_month: 3, season_start_day: 1 }),
    ).toEqual(new Date("2026-03-01T00:00:00.000Z"));
  });
});
