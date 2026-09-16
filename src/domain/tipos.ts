/**
 * Tipos do dominio.
 *
 * Esta camada nao conhece banco, HTTP nem React: sao funcoes puras sobre
 * dados simples. E o que permite testar cada regra do racha isoladamente.
 */

import type { ParticipantKind, ParticipationStatus, RegrasDeMulta } from "@/lib/supabase/tipos";

/** Faixa de prioridade na fila. Mensalista sempre antes de avulso. */
export const FAIXA_MENSALISTA = 0;
export const FAIXA_AVULSO = 1;

export function faixaDe(tipo: ParticipantKind): number {
  return tipo === "monthly" ? FAIXA_MENSALISTA : FAIXA_AVULSO;
}

/** O minimo que o dominio precisa saber sobre um participante. */
export interface ParticipanteDoDominio {
  id: string;
  profileId: string;
  tipo: ParticipantKind;
  faixa: number;
  situacao: ParticipationStatus;
  /** Momento em que a pessoa apertou VOU — e o criterio de desempate. */
  entrouEm: Date;
  conviteExpiraEm?: Date | null;
}

/** Dados da rodada usados pelas regras. */
export interface RodadaDoDominio {
  id: string;
  comecaEm: Date;
  listaFechaEm: Date;
  /** A partir daqui avulsos podem ocupar as vagas que sobraram. */
  avulsosLiberadosEm: Date;
  capacidade: number;
  horasLimiteParaCancelar: number;
  regrasDeMulta: RegrasDeMulta;
  situacao: "draft" | "open" | "closed" | "in_progress" | "finished" | "cancelled";
}

/** Prazos de aceite da vaga, vindos das configuracoes. */
export interface PrazosDeFila {
  minutosParaAceitar: number;
  minutosParaAceitarUrgente: number;
  horasParaConsiderarUrgente: number;
}

/**
 * Resposta padrao das regras: alem do sim/nao, sempre vem um motivo pronto
 * para ser mostrado ao jogador.
 */
export interface Veredito {
  permitido: boolean;
  motivo?: string;
}

export const PERMITIDO: Veredito = { permitido: true };

export function negar(motivo: string): Veredito {
  return { permitido: false, motivo };
}
