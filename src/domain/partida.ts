/**
 * Partida e a regra do "quem ganha fica".
 *
 * A partida acaba de dois jeitos: alguém chega nos gols combinados ou o
 * tempo termina. O time vencedor permanece; o perdedor sai.
 *
 * No empate, o que acontece depende de quantas equipes estão de fora:
 *
 *   • duas ou mais esperando → as duas que estavam dentro saem, e entram as
 *     duas primeiras da fila;
 *   • exatamente uma esperando → o aplicativo sorteia qual das duas sai, e o
 *     sorteio fica registrado no histórico da partida;
 *   • nenhuma esperando (racha de dois times) → não há quem trocar, então as
 *     mesmas equipes seguem para a próxima partida.
 */

import { geradorAleatorio } from "@/lib/utils";

export type ResultadoDaPartida = "team_a" | "team_b" | "draw";

export interface PlacarDaPartida {
  timeA: string;
  timeB: string;
  golsA: number;
  golsB: number;
}

/** A partida já pode ser encerrada por gols? */
export function atingiuOsGols(placar: PlacarDaPartida, golsParaVencer: number): boolean {
  return placar.golsA >= golsParaVencer || placar.golsB >= golsParaVencer;
}

export function resultadoDoPlacar(placar: PlacarDaPartida): ResultadoDaPartida {
  if (placar.golsA > placar.golsB) return "team_a";
  if (placar.golsB > placar.golsA) return "team_b";
  return "draw";
}

export interface RegistroDoSorteio {
  motivo: "empate_uma_equipe_fora";
  timesSorteados: string[];
  timeQueSaiu: string;
  semente: number;
  decididoEm: string;
}

export interface ProximaPartida {
  /** Quem entra em campo na próxima partida. */
  timeA: string;
  timeB: string;
  /** Fila de espera atualizada, na ordem. */
  fila: string[];
  /** Quem saiu de campo nesta troca. */
  sairam: string[];
  /** Preenchido só quando o empate precisou de sorteio. */
  sorteio: RegistroDoSorteio | null;
  explicacao: string;
}

/**
 * Decide quem joga a próxima partida.
 *
 * Função pura: recebe o placar e a fila, devolve a decisão. Quem grava e
 * notifica é o serviço.
 */
export function quemFicaEQuemSai(
  placar: PlacarDaPartida,
  filaDeEspera: string[],
  opcoes: { semente: number; agora?: Date } = { semente: 0 },
): ProximaPartida {
  const resultado = resultadoDoPlacar(placar);
  const fila = [...filaDeEspera];
  const agora = (opcoes.agora ?? new Date()).toISOString();

  if (resultado !== "draw") {
    const vencedor = resultado === "team_a" ? placar.timeA : placar.timeB;
    const perdedor = resultado === "team_a" ? placar.timeB : placar.timeA;

    const proximo = fila.shift();
    if (!proximo) {
      // Só há duas equipes no racha: continuam jogando entre si.
      return {
        timeA: vencedor,
        timeB: perdedor,
        fila: [],
        sairam: [],
        sorteio: null,
        explicacao: "Só há duas equipes: as mesmas seguem em campo.",
      };
    }

    return {
      timeA: vencedor,
      timeB: proximo,
      fila: [...fila, perdedor],
      sairam: [perdedor],
      sorteio: null,
      explicacao: "Quem ganhou fica.",
    };
  }

  // Empate com duas ou mais equipes esperando: as duas de dentro saem.
  if (fila.length >= 2) {
    const entraA = fila.shift() as string;
    const entraB = fila.shift() as string;

    return {
      timeA: entraA,
      timeB: entraB,
      fila: [...fila, placar.timeA, placar.timeB],
      sairam: [placar.timeA, placar.timeB],
      sorteio: null,
      explicacao: "Empate com duas equipes fora: as duas que estavam em campo saem.",
    };
  }

  // Empate com exatamente uma equipe esperando: o aplicativo sorteia quem sai.
  if (fila.length === 1) {
    const entra = fila[0] as string;
    const aleatorio = geradorAleatorio(opcoes.semente);
    const saiOTimeA = aleatorio() < 0.5;

    const queSai = saiOTimeA ? placar.timeA : placar.timeB;
    const queFica = saiOTimeA ? placar.timeB : placar.timeA;

    return {
      timeA: queFica,
      timeB: entra,
      fila: [queSai],
      sairam: [queSai],
      sorteio: {
        motivo: "empate_uma_equipe_fora",
        timesSorteados: [placar.timeA, placar.timeB],
        timeQueSaiu: queSai,
        semente: opcoes.semente,
        decididoEm: agora,
      },
      explicacao: "Empate com uma equipe fora: o sorteio decidiu quem sai.",
    };
  }

  // Empate sem ninguém esperando.
  return {
    timeA: placar.timeA,
    timeB: placar.timeB,
    fila: [],
    sairam: [],
    sorteio: null,
    explicacao: "Empate e ninguém esperando: as mesmas equipes seguem em campo.",
  };
}

/** Segundos restantes de uma partida em andamento. */
export function segundosRestantes(
  comecouEm: Date | null,
  duracaoEmMinutos: number,
  agora: Date = new Date(),
  segundosPausados = 0,
): number {
  if (!comecouEm) return duracaoEmMinutos * 60;

  const decorridos = Math.floor((agora.getTime() - comecouEm.getTime()) / 1000) - segundosPausados;
  return Math.max(0, duracaoEmMinutos * 60 - decorridos);
}

/** A partida deve ser encerrada agora? */
export function deveEncerrar(
  placar: PlacarDaPartida,
  golsParaVencer: number,
  segundosQueFaltam: number,
): { encerrar: boolean; motivo: "gols" | "tempo" | null } {
  if (atingiuOsGols(placar, golsParaVencer)) return { encerrar: true, motivo: "gols" };
  if (segundosQueFaltam <= 0) return { encerrar: true, motivo: "tempo" };
  return { encerrar: false, motivo: null };
}
