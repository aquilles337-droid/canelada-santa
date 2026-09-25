/**
 * Quem fica em cada gol.
 *
 * O goleiro não é de time nenhum: ele é do GOL. A linha gira na frente dele
 * com o "quem ganha fica", e ele continua ali. Quando a linha que estava na
 * frente do gol 1 perde, sai a linha — o goleiro do gol 1 fica e recebe a
 * próxima linha.
 *
 * Por isso a vitória é contada pelo LADO que o goleiro defendeu naquela
 * partida, e não pelo time a que ele pertenceria: numa noite de sete
 * partidas ele joga por vários times diferentes.
 *
 * Com dois goleiros, nada gira: um em cada gol, a rodada toda. Com três ou
 * mais eles se revezam entre as partidas — entra quem jogou menos, e quem
 * está no gol e continua escalado não muda de lado, porque quem se mexe é a
 * linha.
 */

/** Quem estava em cada gol numa partida já disputada. */
export interface GoleirosDaPartida {
  ladoA: string | null;
  ladoB: string | null;
}

export interface EscalacaoDosGols extends GoleirosDaPartida {
  /** Goleiros que ficam de fora desta partida, na ordem em que entram depois. */
  descansando: string[];
  explicacao: string;
}

interface Carga {
  partidas: number;
  /** Índice da última partida em que jogou; -1 para quem ainda não jogou. */
  ultima: number;
}

function cargaDeCadaGoleiro(
  goleiros: string[],
  anteriores: GoleirosDaPartida[],
): Map<string, Carga> {
  const carga = new Map<string, Carga>(goleiros.map((id) => [id, { partidas: 0, ultima: -1 }]));

  anteriores.forEach((partida, indice) => {
    for (const id of [partida.ladoA, partida.ladoB]) {
      const atual = id ? carga.get(id) : undefined;
      if (!atual) continue;
      atual.partidas += 1;
      atual.ultima = indice;
    }
  });

  return carga;
}

/**
 * Escala os goleiros da próxima partida.
 *
 * Função pura: a mesma lista de goleiros com o mesmo histórico devolve
 * sempre a mesma escalação — nada de sorteio aqui, porque revezamento que
 * muda sozinho a cada consulta ninguém consegue conferir.
 *
 * @param goleiros  Ids dos goleiros da rodada, do mais bem avaliado ao menos.
 * @param anteriores Partidas já disputadas, da mais antiga para a mais nova.
 */
export function escalarGoleiros(
  goleiros: string[],
  anteriores: GoleirosDaPartida[],
): EscalacaoDosGols {
  if (goleiros.length === 0) {
    return { ladoA: null, ladoB: null, descansando: [], explicacao: "Nenhum goleiro na rodada." };
  }

  if (goleiros.length === 1) {
    return {
      ladoA: goleiros[0] ?? null,
      ladoB: null,
      descansando: [],
      explicacao: "Só um goleiro: o outro gol fica sem goleiro fixo.",
    };
  }

  if (goleiros.length === 2) {
    // Nada a revezar: cada um no seu gol, a rodada inteira.
    return {
      ladoA: goleiros[0] ?? null,
      ladoB: goleiros[1] ?? null,
      descansando: [],
      explicacao: "Dois goleiros: cada um fica no seu gol a rodada toda.",
    };
  }

  const carga = cargaDeCadaGoleiro(goleiros, anteriores);

  // Entra quem jogou menos. Empatou em partidas, entra quem parou há mais
  // tempo. Empatou nos dois, vale a ordem da lista — assim a escala é
  // sempre a mesma para o mesmo histórico.
  const posicaoOriginal = new Map(goleiros.map((id, i) => [id, i]));
  const ordem = [...goleiros].sort((a, b) => {
    const ca = carga.get(a) ?? { partidas: 0, ultima: -1 };
    const cb = carga.get(b) ?? { partidas: 0, ultima: -1 };
    if (ca.partidas !== cb.partidas) return ca.partidas - cb.partidas;
    if (ca.ultima !== cb.ultima) return ca.ultima - cb.ultima;
    return (posicaoOriginal.get(a) ?? 0) - (posicaoOriginal.get(b) ?? 0);
  });

  const escalados = ordem.slice(0, 2);
  const ultima = anteriores[anteriores.length - 1];

  // Quem já estava num gol e continua escalado não atravessa o campo: fica
  // onde está. O outro assume o gol que vagou.
  let ladoA: string | null = null;
  let ladoB: string | null = null;

  for (const id of escalados) {
    if (ultima?.ladoA === id) ladoA = id;
    else if (ultima?.ladoB === id) ladoB = id;
  }

  for (const id of escalados) {
    if (id === ladoA || id === ladoB) continue;
    if (ladoA === null) ladoA = id;
    else if (ladoB === null) ladoB = id;
  }

  return {
    ladoA,
    ladoB,
    descansando: ordem.slice(2),
    explicacao: `${goleiros.length} goleiros: revezam a cada partida, entra quem jogou menos.`,
  };
}
