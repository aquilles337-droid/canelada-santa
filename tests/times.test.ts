import { describe, expect, it } from "vitest";
import {
  chaveDaDupla,
  custoDoArranjo,
  diferencaEntreTimes,
  gerarTimesEquilibrados,
  montarHistoricoDeDuplas,
  type JogadorParaSorteio,
} from "@/domain/times";
import {
  apurarVotos,
  categoriaDaNota,
  consolidarNota,
  mediaDasNotas,
  podeAvaliar,
  podeVotarNaRodada,
} from "@/domain/avaliacoes";
import type { PesosDeTime } from "@/lib/supabase/tipos";

const PESOS: PesosDeTime = {
  balance: 1,
  size: 0.6,
  concentration: 0.35,
  repetition: 0.15,
  physical: 0.05,
  repetitionWindow: 4,
};

function jogador(
  id: string,
  nota: number,
  sobrescrever: Partial<JogadorParaSorteio> = {},
): JogadorParaSorteio {
  return {
    id,
    nome: `Jogador ${id}`,
    nota,
    ehGoleiro: false,
    pesoKg: null,
    alturaCm: null,
    ehConvidado: false,
    ...sobrescrever,
  };
}

/** 16 jogadores de linha com notas espalhadas, como num racha real. */
function elenco(): JogadorParaSorteio[] {
  const notas = [9.5, 9.0, 8.6, 8.2, 7.8, 7.4, 7.0, 6.6, 6.2, 5.8, 5.4, 5.0, 4.6, 4.0, 3.4, 2.8];
  return notas.map((nota, i) => jogador(`L${i + 1}`, nota));
}

function goleiros(quantidade: number): JogadorParaSorteio[] {
  return Array.from({ length: quantidade }, (_, i) =>
    jogador(`G${i + 1}`, 6 + i * 0.4, { ehGoleiro: true }),
  );
}

describe("equilíbrio dos times", () => {
  it("distribui todo mundo sem perder nem repetir ninguém", () => {
    const jogadores = [...elenco(), ...goleiros(4)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 1 });

    const distribuidos = resultado.times.flatMap((t) => (t.goleiro ? [t.goleiro, ...t.linha] : t.linha));

    expect(distribuidos).toHaveLength(20);
    expect(new Set(distribuidos.map((j) => j.id)).size).toBe(20);
  });

  it("deixa os times com força parecida", () => {
    const jogadores = [...elenco(), ...goleiros(4)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 7 });

    // Cinco jogadores por time somando ~32 pontos. Menos de meio ponto entre
    // o time mais forte e o mais fraco é um racha parelho de verdade.
    expect(diferencaEntreTimes(resultado.times)).toBeLessThanOrEqual(0.4);
  });

  it("mantém a quantidade de jogadores equilibrada", () => {
    const jogadores = [...elenco(), ...goleiros(4)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 3 });

    const tamanhos = resultado.times.map((t) => (t.goleiro ? 1 : 0) + t.linha.length);
    expect(Math.max(...tamanhos) - Math.min(...tamanhos)).toBeLessThanOrEqual(1);
  });

  it("funciona com número de jogadores que não divide igualmente", () => {
    const jogadores = [...elenco().slice(0, 13), ...goleiros(3)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 3, pesos: PESOS, semente: 5 });

    const tamanhos = resultado.times.map((t) => (t.goleiro ? 1 : 0) + t.linha.length);
    expect(tamanhos.reduce((s, n) => s + n, 0)).toBe(16);
    expect(Math.max(...tamanhos) - Math.min(...tamanhos)).toBeLessThanOrEqual(1);
  });

  it("não concentra os craques num time só", () => {
    const jogadores = [...elenco(), ...goleiros(4)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 11 });

    // Os quatro melhores de linha não podem cair todos no mesmo time.
    const melhores = new Set(["L1", "L2", "L3", "L4"]);
    for (const time of resultado.times) {
      const craques = time.linha.filter((j) => melhores.has(j.id)).length;
      expect(craques).toBeLessThanOrEqual(2);
    }
  });
});

describe("goleiros", () => {
  it("dá um goleiro para cada time", () => {
    const jogadores = [...elenco(), ...goleiros(4)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 2 });

    expect(resultado.times.every((t) => t.goleiro !== null)).toBe(true);
    expect(new Set(resultado.times.map((t) => t.goleiro?.id)).size).toBe(4);
  });

  it("nunca sorteia goleiro como jogador de linha", () => {
    const jogadores = [...elenco(), ...goleiros(4)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 4 });

    for (const time of resultado.times) {
      expect(time.linha.some((j) => j.ehGoleiro)).toBe(false);
    }
  });

  it("avisa quando falta goleiro", () => {
    const jogadores = [...elenco(), ...goleiros(2)];
    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 6 });

    expect(resultado.times.filter((t) => t.goleiro).length).toBe(2);
    expect(resultado.avisos.join(" ")).toContain("sem goleiro");
  });

  it("goleiro que sobra vira linha, quando o administrador escolhe assim", () => {
    const jogadores = [...elenco(), ...goleiros(6)];
    const resultado = gerarTimesEquilibrados({
      jogadores,
      quantidadeDeTimes: 4,
      pesos: PESOS,
      semente: 8,
      goleiroExtra: "linha",
    });

    const naLinha = resultado.times.flatMap((t) => t.linha);
    expect(naLinha.filter((j) => j.ehGoleiro)).toHaveLength(2);
    expect(resultado.foraDoSorteio).toHaveLength(0);
  });

  it("goleiro que sobra fica de fora, quando o administrador escolhe assim", () => {
    const jogadores = [...elenco(), ...goleiros(6)];
    const resultado = gerarTimesEquilibrados({
      jogadores,
      quantidadeDeTimes: 4,
      pesos: PESOS,
      semente: 8,
      goleiroExtra: "fora",
    });

    expect(resultado.foraDoSorteio).toHaveLength(2);
    expect(resultado.foraDoSorteio.every((j) => j.ehGoleiro)).toBe(true);
  });
});

describe("variedade entre rodadas", () => {
  it("evita repetir as mesmas duplas quando isso não custa equilíbrio", () => {
    const jogadores = [...elenco(), ...goleiros(4)];

    const semHistorico = gerarTimesEquilibrados({
      jogadores,
      quantidadeDeTimes: 4,
      pesos: PESOS,
      semente: 20,
    });

    const duplasAnteriores = montarHistoricoDeDuplas([
      { times: semHistorico.times.map((t) => t.linha.map((j) => j.id)) },
    ]);

    const comHistorico = gerarTimesEquilibrados({
      jogadores,
      quantidadeDeTimes: 4,
      pesos: PESOS,
      semente: 20,
      historicoDeDuplas: duplasAnteriores,
    });

    const contarRepetidas = (resultado: typeof semHistorico) => {
      let total = 0;
      for (const time of resultado.times) {
        for (let i = 0; i < time.linha.length; i++) {
          for (let j = i + 1; j < time.linha.length; j++) {
            const a = time.linha[i];
            const b = time.linha[j];
            if (a && b) total += duplasAnteriores.get(chaveDaDupla(a.id, b.id)) ?? 0;
          }
        }
      }
      return total;
    };

    expect(contarRepetidas(comHistorico)).toBeLessThan(contarRepetidas(semHistorico));
    // E sem estragar o equilíbrio, que continua sendo a prioridade.
    expect(diferencaEntreTimes(comHistorico.times)).toBeLessThanOrEqual(1);
  });

  it("gera arranjos diferentes com sementes diferentes", () => {
    const jogadores = [...elenco(), ...goleiros(4)];

    const assinatura = (semente: number) =>
      gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente })
        .times.map((t) => t.linha.map((j) => j.id).sort().join(","))
        .sort()
        .join(" | ");

    // "GERAR NOVAMENTE" precisa devolver times realmente diferentes, não o
    // mesmo arranjo com outro número.
    const arranjos = new Set([assinatura(1), assinatura(2), assinatura(3), assinatura(4)]);
    expect(arranjos.size).toBe(4);
  });

  it("é determinístico: a mesma semente devolve o mesmo resultado", () => {
    const jogadores = [...elenco(), ...goleiros(4)];

    const primeiro = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 42 });
    const segundo = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 42 });

    expect(primeiro.times.map((t) => t.linha.map((j) => j.id))).toEqual(
      segundo.times.map((t) => t.linha.map((j) => j.id)),
    );
  });
});

describe("peso e altura como sinal auxiliar", () => {
  it("não transforma porte físico em habilidade", () => {
    // Dois blocos de jogadores com a mesma nota, mas portes bem diferentes.
    const leves = Array.from({ length: 8 }, (_, i) =>
      jogador(`leve${i}`, 6, { pesoKg: 62, alturaCm: 168 }),
    );
    const pesados = Array.from({ length: 8 }, (_, i) =>
      jogador(`pesado${i}`, 6, { pesoKg: 95, alturaCm: 190 }),
    );

    const resultado = gerarTimesEquilibrados({
      jogadores: [...leves, ...pesados],
      quantidadeDeTimes: 4,
      pesos: PESOS,
      semente: 9,
    });

    // Com todo mundo na mesma nota, os times têm de sair com força idêntica:
    // o porte físico não pode criar diferença de qualidade.
    expect(diferencaEntreTimes(resultado.times)).toBe(0);
  });
});

describe("casos de borda", () => {
  it("lida com lista vazia sem quebrar", () => {
    const resultado = gerarTimesEquilibrados({
      jogadores: [],
      quantidadeDeTimes: 4,
      pesos: PESOS,
      semente: 1,
    });

    expect(resultado.times).toHaveLength(4);
    expect(resultado.avisos.join(" ")).toContain("Nenhum jogador");
  });

  it("aceita convidado no sorteio como qualquer outro jogador", () => {
    const jogadores = [
      ...elenco().slice(0, 14),
      jogador("C1", 7, { ehConvidado: true }),
      jogador("C2", 4, { ehConvidado: true }),
      ...goleiros(4),
    ];

    const resultado = gerarTimesEquilibrados({ jogadores, quantidadeDeTimes: 4, pesos: PESOS, semente: 13 });
    const todos = resultado.times.flatMap((t) => t.linha);

    expect(todos.filter((j) => j.ehConvidado)).toHaveLength(2);
  });

  it("o custo de um arranjo perfeito é praticamente zero", () => {
    const iguais = Array.from({ length: 8 }, (_, i) => jogador(`i${i}`, 5));
    const resultado = gerarTimesEquilibrados({
      jogadores: iguais,
      quantidadeDeTimes: 2,
      pesos: PESOS,
      semente: 1,
    });

    expect(custoDoArranjo(resultado.times, PESOS, new Map())).toBeLessThan(0.01);
  });
});

describe("avaliação dos jogadores", () => {
  it("ninguém avalia a si mesmo", () => {
    const veredito = podeAvaliar({
      votanteId: "j1",
      avaliadoId: "j1",
      votanteEstaAtivo: true,
      nota: 8,
    });

    expect(veredito.permitido).toBe(false);
    expect(veredito.motivo).toContain("si mesmo");
  });

  it("aceita só nota de 0 a 10", () => {
    const base = { votanteId: "j1", avaliadoId: "j2", votanteEstaAtivo: true };

    expect(podeAvaliar({ ...base, nota: 0 }).permitido).toBe(true);
    expect(podeAvaliar({ ...base, nota: 10 }).permitido).toBe(true);
    expect(podeAvaliar({ ...base, nota: 10.5 }).permitido).toBe(false);
    expect(podeAvaliar({ ...base, nota: -1 }).permitido).toBe(false);
  });

  it("jogador inativo não vota", () => {
    expect(
      podeAvaliar({ votanteId: "j1", avaliadoId: "j2", votanteEstaAtivo: false, nota: 7 }).permitido,
    ).toBe(false);
  });

  it("a nota final é a média das avaliações", () => {
    expect(mediaDasNotas([8, 7, 9])).toBe(8);
    expect(mediaDasNotas([7.5, 8.5])).toBe(8);
    expect(mediaDasNotas([])).toBeNull();
  });

  it("usa a nota padrão enquanto faltarem votos", () => {
    expect(consolidarNota([8, 9], 5, 3)).toEqual({ nota: 5, votos: 2, temVotosSuficientes: false });
    expect(consolidarNota([8, 9, 7], 5, 3)).toEqual({ nota: 8, votos: 3, temVotosSuficientes: true });
  });

  it("classifica a nota nas faixas configuradas pelo grupo", () => {
    const faixas = [
      { slug: "bagre", label: "Bagre", min: 0, max: 3 },
      { slug: "iniciante", label: "Iniciante", min: 3, max: 5 },
      { slug: "regular", label: "Regular", min: 5, max: 7 },
      { slug: "bom", label: "Bom", min: 7, max: 9 },
      { slug: "craque", label: "Craque", min: 9, max: 10 },
    ];

    expect(categoriaDaNota(2, faixas)?.label).toBe("Bagre");
    expect(categoriaDaNota(3, faixas)?.label).toBe("Iniciante");
    expect(categoriaDaNota(6.9, faixas)?.label).toBe("Regular");
    expect(categoriaDaNota(7, faixas)?.label).toBe("Bom");
    // O topo da última faixa é inclusivo: nota 10 é craque, não fica sem categoria.
    expect(categoriaDaNota(10, faixas)?.label).toBe("Craque");
  });
});

describe("craque e bagre da rodada", () => {
  const base = {
    votanteId: "j1",
    escolhidoId: "j2",
    votanteParticipou: true,
    escolhidoParticipou: true,
    rodadaFinalizada: true,
  };

  it("só quem jogou pode votar", () => {
    expect(podeVotarNaRodada(base).permitido).toBe(true);
    expect(podeVotarNaRodada({ ...base, votanteParticipou: false }).permitido).toBe(false);
  });

  it("só se vota em quem jogou", () => {
    expect(podeVotarNaRodada({ ...base, escolhidoParticipou: false }).permitido).toBe(false);
  });

  it("ninguém vota em si mesmo", () => {
    expect(podeVotarNaRodada({ ...base, escolhidoId: "j1" }).permitido).toBe(false);
  });

  it("a votação só abre quando o racha termina", () => {
    expect(podeVotarNaRodada({ ...base, rodadaFinalizada: false }).permitido).toBe(false);
  });

  it("apura o mais votado", () => {
    const resultado = apurarVotos([
      { alvoId: "j1", votos: 5 },
      { alvoId: "j2", votos: 3 },
      { alvoId: "j3", votos: 1 },
    ]);

    expect(resultado).toEqual({ vencedorId: "j1", votos: 5, empate: false, totalDeVotos: 9 });
  });

  it("avisa o empate em vez de escolher às cegas", () => {
    const resultado = apurarVotos([
      { alvoId: "j1", votos: 4 },
      { alvoId: "j2", votos: 4 },
    ]);

    expect(resultado.empate).toBe(true);
    expect(resultado.vencedorId).toBeNull();
  });

  it("lida com votação sem nenhum voto", () => {
    expect(apurarVotos([])).toEqual({ vencedorId: null, votos: 0, empate: false, totalDeVotos: 0 });
  });
});
