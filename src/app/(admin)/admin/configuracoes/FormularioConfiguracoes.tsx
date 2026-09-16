"use client";

import { useActionState, useEffect } from "react";
import { salvarConfiguracoesAction } from "@/server/actions/configuracoes";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { useToast } from "@/components/ui/Toast";
import type { Settings } from "@/lib/supabase/tipos";

function emReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

function Interruptor({
  nome,
  rotulo,
  ajuda,
  ligado,
}: {
  nome: string;
  rotulo: string;
  ajuda: string;
  ligado: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-linha bg-carvao/60 px-4 py-3">
      <input type="checkbox" name={nome} defaultChecked={ligado} className="mt-0.5 size-5 accent-[#c9a227]" />
      <span className="text-sm">
        {rotulo}
        <span className="block text-xs text-cinza-escuro">{ajuda}</span>
      </span>
    </label>
  );
}

/**
 * Configurações do Canelada Santa.
 *
 * Tudo que o grupo pode querer mudar está aqui: valores, prazos, multas,
 * cota de convidados, padrões da rodada e virada de temporada. Nada disso é
 * fixo no código.
 */
export function FormularioConfiguracoes({ configuracoes }: { configuracoes: Settings }) {
  const toast = useToast();
  const [estado, acao, salvando] = useActionState(salvarConfiguracoesAction, null);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast.sucesso("Configurações salvas.");
    else toast.erro(estado.mensagem);
  }, [estado, toast]);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <Cartao>
        <CabecalhoCartao titulo="Valores" icone={<span aria-hidden>💰</span>} />
        <div className="flex flex-col gap-3">
          <Campo
            name="monthly_fee_cents"
            rotulo="Mensalidade"
            prefixo="R$"
            inputMode="decimal"
            defaultValue={emReais(configuracoes.monthly_fee_cents)}
          />
          <Campo
            name="casual_price_cents"
            rotulo="Avulso"
            prefixo="R$"
            inputMode="decimal"
            defaultValue={emReais(configuracoes.casual_price_cents)}
            ajuda="Valor padrão; cada rodada pode ter o seu"
          />
          <Campo
            name="guest_of_member_price_cents"
            rotulo="Convidado de mensalista"
            prefixo="R$"
            inputMode="decimal"
            defaultValue={emReais(configuracoes.guest_of_member_price_cents)}
          />
          <Campo
            name="guest_of_casual_price_cents"
            rotulo="Convidado de avulso"
            prefixo="R$"
            inputMode="decimal"
            defaultValue={emReais(configuracoes.guest_of_casual_price_cents)}
          />
          <Campo
            name="monthly_due_day"
            rotulo="Dia do vencimento da mensalidade"
            type="number"
            min={1}
            max={28}
            defaultValue={configuracoes.monthly_due_day}
          />
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Multas" icone={<span aria-hidden>⚠️</span>} />
        <div className="flex flex-col gap-3">
          <Campo
            name="late_cancel_fine_cents"
            rotulo="Desistir em cima da hora"
            prefixo="R$"
            inputMode="decimal"
            defaultValue={emReais(configuracoes.late_cancel_fine_cents)}
          />
          <Campo
            name="no_show_multiplier"
            rotulo="Multiplicador da falta sem aviso"
            inputMode="decimal"
            defaultValue={String(configuracoes.no_show_multiplier).replace(".", ",")}
            ajuda={`Hoje, faltar sem avisar custa ${emReais(
              Math.round(configuracoes.late_cancel_fine_cents * configuracoes.no_show_multiplier),
            )} reais`}
          />
          <Campo
            name="cancel_deadline_hours"
            rotulo="Cancelar sem multa até (horas antes)"
            type="number"
            min={0}
            defaultValue={configuracoes.cancel_deadline_hours}
          />
          <Interruptor
            nome="cancel_match_charge_on_withdrawal"
            rotulo="Desistir cancela a cobrança do jogo"
            ajuda="A multa de cancelamento tardio continua sendo gerada."
            ligado={configuracoes.cancel_match_charge_on_withdrawal}
          />
          <Interruptor
            nome="keep_match_charge_on_no_show"
            rotulo="Faltar mantém a cobrança do jogo"
            ajuda="Além da multa por faltar sem avisar."
            ligado={configuracoes.keep_match_charge_on_no_show}
          />
          <Interruptor
            nome="block_on_debt"
            rotulo="Bloquear quem está devendo"
            ajuda="Impede entrar em racha novo com pagamento em aberto."
            ligado={configuracoes.block_on_debt}
          />
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Lista de espera" icone={<span aria-hidden>⏳</span>} />
        <div className="flex flex-col gap-3">
          <Campo
            name="waitlist_unlock_hours"
            rotulo="Avulsos liberados (horas antes)"
            type="number"
            min={0}
            defaultValue={configuracoes.waitlist_unlock_hours}
            ajuda="Até aqui, a vaga fica guardada para mensalistas"
          />
          <Campo
            name="waitlist_accept_minutes"
            rotulo="Prazo para aceitar a vaga (minutos)"
            type="number"
            min={1}
            defaultValue={configuracoes.waitlist_accept_minutes}
          />
          <Campo
            name="waitlist_accept_minutes_urgent"
            rotulo="Prazo em cima da hora (minutos)"
            type="number"
            min={1}
            defaultValue={configuracoes.waitlist_accept_minutes_urgent}
          />
          <Campo
            name="waitlist_urgent_threshold_hours"
            rotulo="Considerar em cima da hora a partir de (horas)"
            type="number"
            min={0}
            defaultValue={configuracoes.waitlist_urgent_threshold_hours}
          />
          <Interruptor
            nome="member_can_reclaim_slot"
            rotulo="Mensalista atrasado pode retomar vaga de avulso"
            ajuda="Desligado: vaga confirmada é definitiva, como o grupo decidiu."
            ligado={configuracoes.member_can_reclaim_slot}
          />
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Convidados" icone={<span aria-hidden>🎟️</span>} />
        <div className="flex flex-col gap-3">
          <Campo
            name="guest_quota_per_member"
            rotulo="Convidados por mensalista, por mês"
            type="number"
            min={0}
            defaultValue={configuracoes.guest_quota_per_member}
          />
          <Interruptor
            nome="allow_casual_guests"
            rotulo="Avulso também pode levar convidado"
            ajuda="Desligado: só mensalista leva convidado."
            ligado={configuracoes.allow_casual_guests}
          />
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Padrões da rodada" icone={<span aria-hidden>⚽</span>} />
        <div className="grid grid-cols-2 gap-3">
          <Campo name="default_capacity" rotulo="Vagas" type="number" min={2} defaultValue={configuracoes.default_capacity} />
          <Campo name="default_teams_count" rotulo="Times" type="number" min={2} defaultValue={configuracoes.default_teams_count} />
          <Campo name="default_match_minutes" rotulo="Minutos" type="number" min={1} defaultValue={configuracoes.default_match_minutes} />
          <Campo name="default_goals_to_win" rotulo="Gols p/ vencer" type="number" min={1} defaultValue={configuracoes.default_goals_to_win} />
          <Campo
            name="default_list_close_hours_before"
            rotulo="Lista fecha (h antes)"
            type="number"
            min={0}
            defaultValue={configuracoes.default_list_close_hours_before}
            className="col-span-2"
          />
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Avaliação e temporada" icone={<span aria-hidden>⭐</span>} />
        <div className="flex flex-col gap-3">
          <Campo
            name="default_rating"
            rotulo="Nota padrão de quem ainda não foi avaliado"
            inputMode="decimal"
            defaultValue={String(configuracoes.default_rating).replace(".", ",")}
          />
          <Campo
            name="min_votes_for_rating"
            rotulo="Votos mínimos para a nota valer"
            type="number"
            min={0}
            defaultValue={configuracoes.min_votes_for_rating}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              name="season_start_day"
              rotulo="Dia da virada"
              type="number"
              min={1}
              max={28}
              defaultValue={configuracoes.season_start_day}
            />
            <Campo
              name="season_start_month"
              rotulo="Mês da virada"
              type="number"
              min={1}
              max={12}
              defaultValue={configuracoes.season_start_month}
            />
          </div>
          <Interruptor
            nome="recurring_card_enabled"
            rotulo="Cobrança recorrente por cartão"
            ajuda="Arquitetura pronta; ligue quando o grupo decidir usar."
            ligado={configuracoes.recurring_card_enabled}
          />
        </div>
      </Cartao>

      <Botao type="submit" tamanho="lg" larguraTotal carregando={salvando}>
        Salvar configurações
      </Botao>
    </form>
  );
}
