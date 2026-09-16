import "server-only";

import { cache } from "react";
import { clienteAdmin } from "@/lib/supabase/admin";
import { erroDeRegra } from "@/lib/erros";
import type { Settings } from "@/lib/supabase/tipos";
import { registrarAuditoria } from "./auditoria";

/**
 * Configuracoes do Canelada Santa.
 *
 * Nenhum valor financeiro, prazo ou limite vive no codigo — tudo sai daqui,
 * e o administrador muda pela tela de Configuracoes. As rodadas guardam um
 * snapshot no momento da criacao, entao mudar algo aqui nunca reescreve uma
 * rodada que ja existe.
 */

export const lerConfiguracoes = cache(async (): Promise<Settings> => {
  const { data, error } = await clienteAdmin().from("settings").select("*").eq("id", true).single();

  if (error || !data) {
    throw erroDeRegra(
      "servico_indisponivel",
      "As configurações do grupo não foram encontradas. Verifique se as migrations foram aplicadas.",
    );
  }

  return data;
});

/** Campos que a tela de configuracoes altera. */
export type EdicaoDeConfiguracoes = Partial<
  Pick<
    Settings,
    | "monthly_fee_cents"
    | "casual_price_cents"
    | "guest_of_member_price_cents"
    | "guest_of_casual_price_cents"
    | "allow_casual_guests"
    | "guest_quota_per_member"
    | "late_cancel_fine_cents"
    | "no_show_multiplier"
    | "cancel_deadline_hours"
    | "waitlist_unlock_hours"
    | "waitlist_accept_minutes"
    | "waitlist_accept_minutes_urgent"
    | "waitlist_urgent_threshold_hours"
    | "member_can_reclaim_slot"
    | "default_capacity"
    | "default_teams_count"
    | "default_match_minutes"
    | "default_goals_to_win"
    | "default_list_close_hours_before"
    | "default_rating"
    | "min_votes_for_rating"
    | "monthly_due_day"
    | "season_start_month"
    | "season_start_day"
    | "block_on_debt"
    | "recurring_card_enabled"
    | "rating_categories"
    | "team_weights"
    | "group_name"
  >
>;

export async function salvarConfiguracoes(
  edicao: EdicaoDeConfiguracoes,
  atorId: string,
): Promise<Settings> {
  const antes = await lerConfiguracoes();

  const { data, error } = await clienteAdmin()
    .from("settings")
    .update({ ...edicao, updated_by: atorId })
    .eq("id", true)
    .select("*")
    .single();

  if (error || !data) {
    throw erroDeRegra("dados_invalidos", "Algum valor informado não é aceito. Confira os campos.");
  }

  // Guardamos apenas o que mudou, para a auditoria continuar legivel.
  const mudou: Record<string, { de: unknown; para: unknown }> = {};
  for (const chave of Object.keys(edicao) as (keyof EdicaoDeConfiguracoes)[]) {
    if (JSON.stringify(antes[chave]) !== JSON.stringify(data[chave])) {
      mudou[chave] = { de: antes[chave], para: data[chave] };
    }
  }

  if (Object.keys(mudou).length > 0) {
    await registrarAuditoria({
      atorId,
      acao: "configuracao.alterada",
      entidade: "settings",
      entidadeId: null,
      depois: mudou,
    });
  }

  return data;
}

/** Categoria textual da nota (BAGRE, REGULAR, CRAQUE...). */
export function categoriaDaNota(nota: number, configuracoes: Settings): string {
  const categorias = [...configuracoes.rating_categories].sort((a, b) => a.min - b.min);

  for (const categoria of categorias) {
    // O topo da ultima faixa e inclusivo, para nota 10 nao ficar sem categoria.
    const ehUltima = categoria === categorias[categorias.length - 1];
    if (nota >= categoria.min && (ehUltima ? nota <= categoria.max : nota < categoria.max)) {
      return categoria.label;
    }
  }

  return categorias[0]?.label ?? "Sem categoria";
}
