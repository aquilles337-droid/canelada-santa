import { describe, expect, it } from "vitest";
import { escalarGoleiros, type GoleirosDaPartida } from "@/domain/goleiros";

describe("quem fica em cada gol", () => {
  it("sem goleiro, os dois gols ficam vazios", () => {
    const e = escalarGoleiros([], []);
    expect(e.ladoA).toBeNull();
    expect(e.ladoB).toBeNull();
  });

  it("com um goleiro só, ele pega um gol e o outro fica sem", () => {
    const e = escalarGoleiros(["g1"], []);
    expect(e.ladoA).toBe("g1");
    expect(e.ladoB).toBeNull();
    expect(e.explicacao).toContain("sem goleiro fixo");
  });

  it("com dois goleiros, cada um fica no seu gol", () => {
    const e = escalarGoleiros(["g1", "g2"], []);
    expect([e.ladoA, e.ladoB]).toEqual(["g1", "g2"]);
    expect(e.descansando).toEqual([]);
  });

  it("com dois goleiros, nada muda partida após partida", () => {
    const historico: GoleirosDaPartida[] = [
      { ladoA: "g1", ladoB: "g2" },
      { ladoA: "g1", ladoB: "g2" },
      { ladoA: "g1", ladoB: "g2" },
    ];
    const e = escalarGoleiros(["g1", "g2"], historico);
    expect([e.ladoA, e.ladoB]).toEqual(["g1", "g2"]);
  });

  it("com três goleiros, os dois primeiros começam e o terceiro espera", () => {
    const e = escalarGoleiros(["g1", "g2", "g3"], []);
    expect([e.ladoA, e.ladoB].sort()).toEqual(["g1", "g2"]);
    expect(e.descansando).toEqual(["g3"]);
  });

  it("quem ficou de fora entra na partida seguinte", () => {
    const e = escalarGoleiros(["g1", "g2", "g3"], [{ ladoA: "g1", ladoB: "g2" }]);
    expect([e.ladoA, e.ladoB]).toContain("g3");
    expect(e.descansando).toHaveLength(1);
  });

  it("quem continua escalado não troca de gol", () => {
    // g1 e g2 jogaram; g3 tem de entrar. Quem sai é g2 (jogou por último em
    // ordem de desempate), e g1 continua no lado onde estava.
    const e = escalarGoleiros(["g1", "g2", "g3"], [{ ladoA: "g1", ladoB: "g2" }]);
    if (e.ladoA === "g1") expect(e.ladoB).toBe("g3");
    else expect(e.ladoB).toBe("g1");
  });

  it("três goleiros se revezam parelho ao longo de seis partidas", () => {
    const goleiros = ["g1", "g2", "g3"];
    const historico: GoleirosDaPartida[] = [];

    for (let i = 0; i < 6; i++) {
      const e = escalarGoleiros(goleiros, historico);
      historico.push({ ladoA: e.ladoA, ladoB: e.ladoB });
    }

    const jogos = new Map(goleiros.map((g) => [g, 0]));
    for (const partida of historico) {
      for (const id of [partida.ladoA, partida.ladoB]) {
        if (id) jogos.set(id, (jogos.get(id) ?? 0) + 1);
      }
    }

    // Seis partidas, dois gols por partida, três goleiros: quatro cada.
    expect([...jogos.values()]).toEqual([4, 4, 4]);
  });

  it("quatro goleiros também se revezam parelho", () => {
    const goleiros = ["g1", "g2", "g3", "g4"];
    const historico: GoleirosDaPartida[] = [];

    for (let i = 0; i < 8; i++) {
      const e = escalarGoleiros(goleiros, historico);
      historico.push({ ladoA: e.ladoA, ladoB: e.ladoB });
    }

    const jogos = new Map(goleiros.map((g) => [g, 0]));
    for (const partida of historico) {
      for (const id of [partida.ladoA, partida.ladoB]) {
        if (id) jogos.set(id, (jogos.get(id) ?? 0) + 1);
      }
    }

    expect([...jogos.values()]).toEqual([4, 4, 4, 4]);
  });

  it("a escala é a mesma para o mesmo histórico", () => {
    const historico: GoleirosDaPartida[] = [
      { ladoA: "g1", ladoB: "g2" },
      { ladoA: "g3", ladoB: "g1" },
    ];
    const primeira = escalarGoleiros(["g1", "g2", "g3"], historico);
    const segunda = escalarGoleiros(["g1", "g2", "g3"], historico);
    expect(segunda).toEqual(primeira);
  });

  it("ninguém fica nos dois gols ao mesmo tempo", () => {
    const e = escalarGoleiros(["g1", "g2", "g3"], [{ ladoA: "g1", ladoB: "g3" }]);
    expect(e.ladoA).not.toBe(e.ladoB);
  });
});
