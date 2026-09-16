/**
 * Cobrancas.
 *
 * Tudo que o jogador deve ao grupo vira uma cobranca com chave de
 * idempotencia: a mesma regra, para a mesma pessoa e a mesma rodada, nunca
 * cobra duas vezes — nem se a operacao for repetida, nem se um webhook
 * chegar duplicado.
 */

import type { ChargeType } from "@/lib/supabase/tipos";
import type { MotivoDeMulta } from "./presenca";

/**
 * Chave de idempotencia de cada tipo de cobranca.
 *
 * O formato e legivel de proposito: quem abrir o banco entende de onde a
 * cobranca veio sem precisar cruzar tabelas.
 */
export function chaveDeCobranca(
  tipo: ChargeType,
  partes: { rodadaId?: string; profileId: string; convidadoId?: string; competencia?: string; motivo?: MotivoDeMulta },
): string {
  switch (tipo) {
    case "match":
      return `match:${partes.rodadaId}:${partes.profileId}`;
    case "guest":
      return `guest:${partes.rodadaId}:${partes.convidadoId}`;
    case "fine":
      return `fine:${partes.motivo}:${partes.rodadaId}:${partes.profileId}`;
    case "monthly":
      return `monthly:${partes.competencia}:${partes.profileId}`;
  }
}

/** Primeiro dia do mes de competencia, no formato aceito pelo banco. */
export function competenciaDoMes(referencia: Date, fuso = "America/Maceio"): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit" })
      .formatToParts(referencia)
      .map((p) => [p.type, p.value]),
  );

  return `${partes.year}-${partes.month}-01`;
}

/** Data de vencimento da mensalidade de uma competencia. */
export function vencimentoDaMensalidade(competencia: string, diaDoVencimento: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano ?? 0, mes ?? 1, 0)).getUTCDate();
  const dia = Math.min(diaDoVencimento, ultimoDia);

  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** A mensalidade venceu? */
export function mensalidadeVencida(vencimento: string, hoje: Date): boolean {
  return new Date(`${vencimento}T23:59:59.999Z`).getTime() < hoje.getTime();
}
