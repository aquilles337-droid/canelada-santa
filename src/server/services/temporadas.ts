import "server-only";

import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import { fimDaTemporada, inicioDaTemporada, nomeDaTemporada } from "@/domain/temporada";
import type { Season } from "@/lib/supabase/tipos";
import { lerConfiguracoes } from "./configuracoes";

/**
 * Temporadas.
 *
 * A temporada vira todo dia 10 de janeiro (configuravel). O historico antigo
 * nunca e apagado: cria-se uma temporada nova e as estatisticas passam a ser
 * contadas nela, enquanto o acumulado de todos os tempos continua intacto.
 */

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

  const { data: criada, error } = await clienteAdmin()
    .from("seasons")
    .insert({
      name: nomeDaTemporada(inicio),
      starts_on: inicioISO,
      ends_on: comoDataISO(fimDaTemporada(inicio)),
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
