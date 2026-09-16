"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/server/auth/sessao";
import { salvarConfiguracoes, type EdicaoDeConfiguracoes } from "@/server/services/configuracoes";
import { lerDinheiro } from "@/lib/format";
import { comoResultado, falha, sucesso, type Resultado } from "@/lib/erros";

/**
 * Salva as configurações do grupo.
 *
 * Nenhum valor financeiro ou prazo do Canelada Santa vive no código — tudo
 * passa por aqui, e mudar algo nunca reescreve rodadas que já existem,
 * porque cada rodada guarda o próprio snapshot.
 */
const CAMPOS_EM_DINHEIRO = [
  "monthly_fee_cents",
  "casual_price_cents",
  "guest_of_member_price_cents",
  "guest_of_casual_price_cents",
  "late_cancel_fine_cents",
] as const;

const CAMPOS_INTEIROS = [
  "guest_quota_per_member",
  "cancel_deadline_hours",
  "waitlist_unlock_hours",
  "waitlist_accept_minutes",
  "waitlist_accept_minutes_urgent",
  "waitlist_urgent_threshold_hours",
  "default_capacity",
  "default_teams_count",
  "default_match_minutes",
  "default_goals_to_win",
  "default_list_close_hours_before",
  "min_votes_for_rating",
  "monthly_due_day",
  "season_start_month",
  "season_start_day",
] as const;

const CAMPOS_BOOLEANOS = [
  "allow_casual_guests",
  "member_can_reclaim_slot",
  "block_on_debt",
  "recurring_card_enabled",
  "cancel_match_charge_on_withdrawal",
  "keep_match_charge_on_no_show",
] as const;

export async function salvarConfiguracoesAction(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado> {
  try {
    const admin = await exigirAdmin();
    const edicao: EdicaoDeConfiguracoes = {};

    for (const campo of CAMPOS_EM_DINHEIRO) {
      const bruto = formulario.get(campo);
      if (typeof bruto !== "string") continue;

      const centavos = lerDinheiro(bruto);
      if (centavos === null) {
        return falha("dados_invalidos", "Confira os valores em dinheiro informados.");
      }
      edicao[campo] = centavos;
    }

    for (const campo of CAMPOS_INTEIROS) {
      const bruto = formulario.get(campo);
      if (typeof bruto !== "string" || !bruto.trim()) continue;

      const numero = Number(bruto);
      if (!Number.isFinite(numero) || numero < 0) {
        return falha("dados_invalidos", "Confira os números informados.");
      }
      edicao[campo] = Math.round(numero);
    }

    for (const campo of CAMPOS_BOOLEANOS) {
      edicao[campo] = formulario.get(campo) === "on";
    }

    const multiplicador = formulario.get("no_show_multiplier");
    if (typeof multiplicador === "string" && multiplicador.trim()) {
      const numero = Number(multiplicador.replace(",", "."));
      if (!Number.isFinite(numero) || numero < 0) {
        return falha("dados_invalidos", "O multiplicador da falta precisa ser um número.");
      }
      edicao.no_show_multiplier = numero;
    }

    const notaPadrao = formulario.get("default_rating");
    if (typeof notaPadrao === "string" && notaPadrao.trim()) {
      const numero = Number(notaPadrao.replace(",", "."));
      if (!Number.isFinite(numero) || numero < 0 || numero > 10) {
        return falha("dados_invalidos", "A nota padrão vai de 0 a 10.");
      }
      edicao.default_rating = numero;
    }

    const nomeDoGrupo = formulario.get("group_name");
    if (typeof nomeDoGrupo === "string" && nomeDoGrupo.trim()) {
      edicao.group_name = nomeDoGrupo.trim();
    }

    await salvarConfiguracoes(edicao, admin.id);

    revalidatePath("/admin/configuracoes");
    revalidatePath("/admin");
    return sucesso();
  } catch (erro) {
    return comoResultado(erro);
  }
}
