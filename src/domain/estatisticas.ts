/**
 * Estatísticas do racha.
 *
 * Duas decisões importantes vivem aqui:
 *
 * 1. Assiduidade é presença dividida pelas rodadas em que o jogador estava
 *    apto — não pelo total de rodadas do grupo. Quem entrou em agosto não é
 *    penalizado pelos rachas de janeiro.
 *
 * 2. Assiduidade é ESTATÍSTICA DE RESENHA. Ela nunca decide prioridade de
 *    vaga: dois jogadores na mesma faixa são desempatados por quem confirmou
 *    primeiro (ver src/domain/fila.ts).
 */

export interface ResumoDeEstatisticas {
  rodadasAptas: number;
  presencas: number;
  faltas: number;
  faltasJustificadas: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  craques: number;
  bagres: number;
}

export const ESTATISTICAS_ZERADAS: ResumoDeEstatisticas = {
  rodadasAptas: 0,
  presencas: 0,
  faltas: 0,
  faltasJustificadas: 0,
  gols: 0,
  assistencias: 0,
  vitorias: 0,
  derrotas: 0,
  empates: 0,
  craques: 0,
  bagres: 0,
};

/**
 * Assiduidade: presenças ÷ rodadas em que estava apto.
 *
 * 10 presenças em 50 rachas = 0,2 (20%). Sem rodadas aptas, devolve 0 em vez
 * de dividir por zero.
 */
export function calcularAssiduidade(presencas: number, rodadasAptas: number): number {
  if (rodadasAptas <= 0) return 0;
  return Math.min(1, presencas / rodadasAptas);
}

/** Aproveitamento em partidas: vitórias ÷ partidas disputadas. */
export function calcularAproveitamento(
  vitorias: number,
  empates: number,
  derrotas: number,
): number {
  const partidas = vitorias + empates + derrotas;
  if (partidas <= 0) return 0;
  // Vitória vale 3, empate 1 — o mesmo critério de tabela que o grupo conhece.
  return (vitorias * 3 + empates) / (partidas * 3);
}

export interface Sequencia {
  atual: number;
  maior: number;
}

/**
 * Sequência de presenças.
 *
 * A lista vem em ordem cronológica. A sequência atual quebra na primeira
 * ausência a partir do fim — quem faltou no último racha zera, mesmo tendo
 * uma sequência longa antes.
 */
export function calcularSequencia(
  presencasEmOrdem: { compareceu: boolean }[],
): Sequencia {
  let maior = 0;
  let corrente = 0;

  for (const rodada of presencasEmOrdem) {
    if (rodada.compareceu) {
      corrente += 1;
      if (corrente > maior) maior = corrente;
    } else {
      corrente = 0;
    }
  }

  return { atual: corrente, maior };
}

export interface LinhaDeRanking {
  profileId: string;
  presencas: number;
  assiduidade: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  nota: number;
  craques: number;
}

export type CriterioDeRanking =
  | "presencas"
  | "assiduidade"
  | "gols"
  | "assistencias"
  | "vitorias"
  | "nota"
  | "craques";

/**
 * Ordena o ranking por um critério, com desempates estáveis.
 *
 * Empate no critério principal cai para presenças e depois para o
 * identificador, para a ordem nunca mudar sozinha entre dois carregamentos.
 */
export function ordenarRanking(
  linhas: LinhaDeRanking[],
  criterio: CriterioDeRanking,
): LinhaDeRanking[] {
  return [...linhas].sort((a, b) => {
    const diferenca = b[criterio] - a[criterio];
    if (Math.abs(diferenca) > 1e-9) return diferenca;

    if (b.presencas !== a.presencas) return b.presencas - a.presencas;
    return a.profileId.localeCompare(b.profileId);
  });
}

/** Posição do jogador no ranking, começando em 1. */
export function posicaoNoRanking(
  linhas: LinhaDeRanking[],
  profileId: string,
  criterio: CriterioDeRanking = "presencas",
): number | null {
  const indice = ordenarRanking(linhas, criterio).findIndex((l) => l.profileId === profileId);
  return indice >= 0 ? indice + 1 : null;
}
