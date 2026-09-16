import { FUSO } from "./format";

/**
 * Conversao entre o horario que o grupo digita (America/Maceio) e o UTC
 * guardado no banco.
 *
 * O administrador escreve "20:00" pensando no relogio dele. Guardar isso
 * como UTC direto adiantaria o racha em tres horas — por isso a conversao
 * passa pelo deslocamento real do fuso na data escolhida.
 */

/** Deslocamento do fuso do grupo, em minutos, para um instante UTC. */
function deslocamentoEmMinutos(instante: Date): number {
  const formatador = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partes = Object.fromEntries(
    formatador.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );

  const comoUTC = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) === 24 ? 0 : Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );

  return (comoUTC - instante.getTime()) / 60_000;
}

/**
 * "2026-09-15" + "20:00" no fuso do grupo → instante UTC correspondente.
 */
export function paraUTC(data: string, hora: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);

  const palpite = Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 1, h ?? 0, m ?? 0);
  const deslocamento = deslocamentoEmMinutos(new Date(palpite));

  return new Date(palpite - deslocamento * 60_000);
}

/** Instante UTC → { data: "2026-09-15", hora: "20:00" } no fuso do grupo. */
export function paraCamposLocais(instante: Date | string): { data: string; hora: string } {
  const d = new Date(instante);

  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(d)
      .map((parte) => [parte.type, parte.value]),
  );

  const hora = partes.hour === "24" ? "00" : partes.hour;
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${hora}:${partes.minute}`,
  };
}
