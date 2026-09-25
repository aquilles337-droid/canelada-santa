import { describe, expect, it } from "vitest";
import {
  atingiuOsGols,
  deveEncerrar,
  quemFicaEQuemSai,
  resultadoDoPlacar,
  segundosRestantes,
  type PlacarDaPartida,
} from "@/domain/partida";

function placar(golsA: number, golsB: number): PlacarDaPartida {
  return { timeA: "T1", timeB: "T2", golsA, golsB };
}

describe("fim da partida", () => {
  it("encerra quando alguém chega nos gols combinados", () => {
    expect(atingiuOsGols(placar(2, 0), 2)).toBe(true);
    expect(atingiuOsGols(placar(1, 2), 2)).toBe(true);
    expect(atingiuOsGols(placar(1, 1), 2)).toBe(false);
  });

  it("encerra quando o tempo acaba, mesmo empatado", () => {
    expect(deveEncerrar(placar(1, 1), 2, 0)).toEqual({ encerrar: true, motivo: "tempo" });
    expect(deveEncerrar(placar(1, 1), 2, 45)).toEqual({ encerrar: false, motivo: null });
  });

  it("gols valem mais que o relógio", () => {
    expect(deveEncerrar(placar(2, 1), 2, 120)).toEqual({ encerrar: true, motivo: "gols" });
  });

  it("lê o resultado do placar", () => {
    expect(resultadoDoPlacar(placar(2, 1))).toBe("team_a");
    expect(resultadoDoPlacar(placar(1, 2))).toBe("team_b");
    expect(resultadoDoPlacar(placar(1, 1))).toBe("draw");
  });
});

describe("quem ganha fica", () => {
  it("o vencedor fica e o perdedor vai para o fim da fila", () => {
    const proxima = quemFicaEQuemSai(placar(2, 0), ["T3", "T4"], { semente: 1 });

    expect(proxima.timeA).toBe("T1");
    expect(proxima.timeB).toBe("T3");
    expect(proxima.fila).toEqual(["T4", "T2"]);
    expect(proxima.sairam).toEqual(["T2"]);
    expect(proxima.sorteio).toBeNull();
  });

  it("funciona quando quem ganha é o time B", () => {
    const proxima = quemFicaEQuemSai(placar(0, 3), ["T3"], { semente: 1 });

    // T2 ganhou no lado B e continua no lado B; T3 assume o lado que T1 deixou.
    expect(proxima.timeA).toBe("T3");
    expect(proxima.timeB).toBe("T2");
    expect(proxima.fila).toEqual(["T1"]);
  });

  // O lado do campo é o que amarra o goleiro à partida: o goleiro é do gol,
  // não do time. Se o vencedor pulasse de lado, trocaria de goleiro no meio
  // do racha sem ninguém ter saído do gol.
  it("quem ganha continua no mesmo lado do campo", () => {
    const venceuNoLadoA = quemFicaEQuemSai(placar(2, 0), ["T3"], { semente: 1 });
    expect(venceuNoLadoA.timeA).toBe("T1");

    const venceuNoLadoB = quemFicaEQuemSai(placar(0, 2), ["T3"], { semente: 1 });
    expect(venceuNoLadoB.timeB).toBe("T2");
  });

  it("quem entra assume o lado de quem saiu", () => {
    const perdeuOLadoB = quemFicaEQuemSai(placar(2, 0), ["T3"], { semente: 1 });
    expect(perdeuOLadoB.timeB).toBe("T3");

    const perdeuOLadoA = quemFicaEQuemSai(placar(0, 2), ["T3"], { semente: 1 });
    expect(perdeuOLadoA.timeA).toBe("T3");
  });
});

describe("empate", () => {
  it("com duas equipes fora, as duas que estavam em campo saem", () => {
    const proxima = quemFicaEQuemSai(placar(1, 1), ["T3", "T4"], { semente: 1 });

    expect([proxima.timeA, proxima.timeB]).toEqual(["T3", "T4"]);
    expect(proxima.fila).toEqual(["T1", "T2"]);
    expect(proxima.sairam).toEqual(["T1", "T2"]);
    expect(proxima.sorteio).toBeNull();
  });

  it("com uma equipe fora, o sorteio decide quem sai", () => {
    const proxima = quemFicaEQuemSai(placar(1, 1), ["T3"], { semente: 7 });

    expect(proxima.sorteio).not.toBeNull();
    expect(proxima.sorteio?.motivo).toBe("empate_uma_equipe_fora");
    expect(proxima.sorteio?.timesSorteados).toEqual(["T1", "T2"]);
    expect(["T1", "T2"]).toContain(proxima.sorteio?.timeQueSaiu);

    // Quem saiu é exatamente quem não ficou, e a equipe que esperava entrou
    // no lado que vagou.
    expect(proxima.fila).toEqual([proxima.sorteio?.timeQueSaiu]);
    expect([proxima.timeA, proxima.timeB]).toContain("T3");
    expect([proxima.timeA, proxima.timeB]).not.toContain(proxima.sorteio?.timeQueSaiu);

    const ladoQueVagou = proxima.sorteio?.timeQueSaiu === "T1" ? proxima.timeA : proxima.timeB;
    expect(ladoQueVagou).toBe("T3");
  });

  it("o sorteio fica registrado e é reproduzível pela semente", () => {
    const primeiro = quemFicaEQuemSai(placar(1, 1), ["T3"], { semente: 123 });
    const segundo = quemFicaEQuemSai(placar(1, 1), ["T3"], { semente: 123 });

    expect(primeiro.sorteio?.timeQueSaiu).toBe(segundo.sorteio?.timeQueSaiu);
    expect(primeiro.sorteio?.semente).toBe(123);
    expect(primeiro.sorteio?.decididoEm).toBeTruthy();
  });

  it("sementes diferentes conseguem sortear qualquer um dos dois", () => {
    const saidas = new Set(
      Array.from({ length: 40 }, (_, i) =>
        quemFicaEQuemSai(placar(1, 1), ["T3"], { semente: i }).sorteio?.timeQueSaiu,
      ),
    );

    expect(saidas).toEqual(new Set(["T1", "T2"]));
  });

  it("com só duas equipes no racha, ninguém sai", () => {
    const proxima = quemFicaEQuemSai(placar(1, 1), [], { semente: 1 });

    expect(proxima.sairam).toEqual([]);
    expect([proxima.timeA, proxima.timeB]).toEqual(["T1", "T2"]);
    expect(proxima.explicacao).toContain("seguem em campo");
  });

  it("com só duas equipes, o vencedor também não troca de adversário nem de lado", () => {
    const proxima = quemFicaEQuemSai(placar(2, 0), [], { semente: 1 });

    expect([proxima.timeA, proxima.timeB]).toEqual(["T1", "T2"]);
    expect(proxima.sairam).toEqual([]);
  });
});

describe("cronômetro", () => {
  const inicio = new Date("2026-09-15T23:00:00Z");

  it("conta o tempo que falta", () => {
    expect(segundosRestantes(inicio, 8, new Date("2026-09-15T23:00:00Z"))).toBe(480);
    expect(segundosRestantes(inicio, 8, new Date("2026-09-15T23:03:00Z"))).toBe(300);
  });

  it("não fica negativo depois do fim", () => {
    expect(segundosRestantes(inicio, 8, new Date("2026-09-15T23:20:00Z"))).toBe(0);
  });

  it("desconta o tempo parado", () => {
    expect(segundosRestantes(inicio, 8, new Date("2026-09-15T23:03:00Z"), 60)).toBe(360);
  });

  it("antes de começar, mostra a duração cheia", () => {
    expect(segundosRestantes(null, 8)).toBe(480);
  });
});
