import type { RegrasDeMulta } from "@/lib/supabase/tipos";
import { faixaDe, type ParticipanteDoDominio, type PrazosDeFila, type RodadaDoDominio } from "@/domain/tipos";

/** Construtores usados pelos testes, com os padroes do grupo. */

export const MULTAS_PADRAO: RegrasDeMulta = {
  late_cancel_fine_cents: 1000,
  no_show_multiplier: 1.5,
  cancel_deadline_hours: 2,
};

export const PRAZOS_PADRAO: PrazosDeFila = {
  minutosParaAceitar: 90,
  minutosParaAceitarUrgente: 30,
  horasParaConsiderarUrgente: 3,
};

export const AGORA = new Date("2026-09-15T12:00:00.000Z");

export function horas(quantidade: number): number {
  return quantidade * 3_600_000;
}

export function emHoras(base: Date, quantidade: number): Date {
  return new Date(base.getTime() + horas(quantidade));
}

export function criarRodada(sobrescrever: Partial<RodadaDoDominio> = {}): RodadaDoDominio {
  const comecaEm = sobrescrever.comecaEm ?? emHoras(AGORA, 48);

  return {
    id: "rodada-1",
    comecaEm,
    listaFechaEm: new Date(comecaEm.getTime() - horas(2)),
    avulsosLiberadosEm: new Date(comecaEm.getTime() - horas(5)),
    capacidade: 20,
    horasLimiteParaCancelar: 2,
    regrasDeMulta: MULTAS_PADRAO,
    situacao: "open",
    ...sobrescrever,
  };
}

let sequencia = 0;

export function criarParticipante(
  sobrescrever: Partial<ParticipanteDoDominio> & { mensalista?: boolean } = {},
): ParticipanteDoDominio {
  sequencia += 1;
  const tipo = sobrescrever.tipo ?? (sobrescrever.mensalista === false ? "casual" : "monthly");

  return {
    id: sobrescrever.id ?? `p-${sequencia}`,
    profileId: sobrescrever.profileId ?? `jogador-${sequencia}`,
    tipo,
    faixa: sobrescrever.faixa ?? faixaDe(tipo),
    situacao: sobrescrever.situacao ?? "confirmed",
    entrouEm: sobrescrever.entrouEm ?? new Date(AGORA.getTime() - horas(24) + sequencia * 1000),
    conviteExpiraEm: sobrescrever.conviteExpiraEm ?? null,
  };
}

/** Cria varios participantes de uma vez. */
export function criarVarios(
  quantidade: number,
  base: Partial<ParticipanteDoDominio> & { mensalista?: boolean } = {},
): ParticipanteDoDominio[] {
  return Array.from({ length: quantidade }, () => criarParticipante(base));
}
