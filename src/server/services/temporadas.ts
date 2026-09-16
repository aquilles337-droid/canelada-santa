import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import type { Season, Settings } from "@/lib/supabase/tipos";
import { lerConfiguracoes } from "./configuracoes";

/**
 * Temporadas.
 *
 * A temporada vira todo dia 10 de janeiro (configuravel). O historico antigo
 * nunca e apagado: cria-se uma temporada nova e as estatisticas passam a ser
 * contadas nela, enquanto o acumulado de todos os tempos continua intacto.
 */

/** Data de inicio da temporada que contem a data informada. */
export function inicioDaTemporada(referencia: Date, configuracoes: Settings): Date {
  const ano = referencia.getUTCFullYear();
  const virada = Date.UTC(ano, configuracoes.season_start_month - 1, configuracoes.season_start_day);

  if (referencia.getTime() >= virada) return new Date(virada);

  return new Date(Date.UTC(ano - 1, configuracoes.season_start_month - 1, configuracoes.season_start_day));
}

function somarUmAno(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear() + 1, data.getUTCMonth(), data.getUTCDate()));
}

function comoDataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export async function temporadaAtual(): Promise<Season | null> {
  const { data } = await clienteAdmin().from("seasons").select("*").eq("is_current", true).maybeSingle();
  return data;
}

/**
 * Devolve a temporada corrente, criando-a se a virada ja passou.
 *
 * A temporada anterior deixa de ser corrente, mas continua no banco com
 * todas as rodadas e estatisticas.
 */
export async function garantirTemporadaAtual(referencia: Date = new Date()): Promise<Season> {
  const configuracoes = await lerConfiguracoes();
  const inicio = inicioDaTemporada(referencia, configuracoes);
  const inicioISO = comoDataISO(inicio);

  const { data: existente } = await clienteAdmin()
    .from("seasons")
    .select("*")
    .eq("starts_on", inicioISO)
    .maybeSingle();

  if (existente) {
    if (!existente.is_current) {
      await clienteAdmin().from("seasons").update({ is_current: false }).eq("is_current", true);
      await clienteAdmin().from("seasons").update({ is_current: true }).eq("id", existente.id);
      return { ...existente, is_current: true };
    }
    return existente;
  }

  // Ninguem pode ser corrente enquanto a nova nao existir: o banco so aceita
  // uma temporada corrente por vez.
  await clienteAdmin().from("seasons").update({ is_current: false }).eq("is_current", true);

  const fim = new Date(somarUmAno(inicio).getTime() - 86_400_000);
  const { data: criada, error } = await clienteAdmin()
    .from("seasons")
    .insert({
      name: `Temporada ${inicio.getUTCFullYear()}`,
      starts_on: inicioISO,
      ends_on: comoDataISO(fim),
      is_current: true,
    })
    .select("*")
    .single();

  if (error || !criada) {
    throw erroDeRegra("servico_indisponivel", "Não foi possível abrir a temporada.");
  }

  return criada;
}

export async function listarTemporadas(): Promise<Season[]> {
  const { data } = await clienteAdmin().from("seasons").select("*").order("starts_on", { ascending: false });
  return data ?? [];
}
