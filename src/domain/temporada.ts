/**
 * Temporadas.
 *
 * A temporada vira todo dia 10 de janeiro por padrão, e a data é
 * configurável. O histórico antigo NUNCA é apagado: cria-se uma temporada
 * nova e as estatísticas passam a ser contadas nela, enquanto o acumulado de
 * todos os tempos continua disponível no Hall da Fama.
 */

export interface ViradaDeTemporada {
  season_start_month: number;
  season_start_day: number;
}

/** Data de início da temporada que contém a data informada. */
export function inicioDaTemporada(referencia: Date, configuracao: ViradaDeTemporada): Date {
  const ano = referencia.getUTCFullYear();
  const virada = Date.UTC(ano, configuracao.season_start_month - 1, configuracao.season_start_day);

  if (referencia.getTime() >= virada) return new Date(virada);

  return new Date(
    Date.UTC(ano - 1, configuracao.season_start_month - 1, configuracao.season_start_day),
  );
}

/** Último dia da temporada iniciada na data informada. */
export function fimDaTemporada(inicio: Date): Date {
  const proximoInicio = Date.UTC(inicio.getUTCFullYear() + 1, inicio.getUTCMonth(), inicio.getUTCDate());
  return new Date(proximoInicio - 86_400_000);
}

/** Nome padrão da temporada, pelo ano do início. */
export function nomeDaTemporada(inicio: Date): string {
  return `Temporada ${inicio.getUTCFullYear()}`;
}

/** A data está dentro da temporada? */
export function dentroDaTemporada(data: Date, inicio: Date, fim: Date): boolean {
  return data >= inicio && data <= new Date(fim.getTime() + 86_399_999);
}
