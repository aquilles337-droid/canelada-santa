-- ============================================================
-- Canelada Santa — regras financeiras configuraveis
-- ============================================================
-- O documento do grupo define as multas, mas nao diz o que acontece com a
-- cobranca do jogo avulso quando a pessoa desiste ou falta. Em vez de
-- inventar uma regra, os dois casos viram configuracao — com um padrao
-- razoavel que o administrador confirma ou muda na tela de Configuracoes.

alter table public.settings
  -- Desistir cancela a cobranca do avulso? (a multa de cancelamento tardio
  -- continua sendo gerada normalmente, quando for o caso)
  add column cancel_match_charge_on_withdrawal boolean not null default true,
  -- Faltar sem avisar mantem a cobranca do jogo, alem da multa?
  add column keep_match_charge_on_no_show boolean not null default false,
  -- Dia em que a mensalidade do mes e gerada
  add column monthly_generation_day integer not null default 1
    check (monthly_generation_day between 1 and 28);

-- Convidado tambem gera cobranca, e ela e do anfitriao — quem levou paga.
comment on column public.charges.guest_id is
  'Convidado que originou a cobranca. O profile_id da cobranca e sempre o anfitriao que levou o convidado.';

-- Conta quantos convidados o mensalista ja usou num mes de competencia.
-- Cancelados e removidos nao consomem cota.
create or replace function public.convidados_usados_no_mes(
  p_host_profile_id uuid,
  p_competencia     date
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.round_guests g
  join public.rounds r on r.id = g.round_id
  where g.host_profile_id = p_host_profile_id
    and g.status not in ('cancelled', 'removed')
    and r.status <> 'cancelled'
    and date_trunc('month', r.starts_at at time zone 'America/Maceio')::date = date_trunc('month', p_competencia)::date;
$$;

/**
 * Confirma convidados nas vagas que sobraram depois dos jogadores.
 *
 * Convidado sempre entra por ultimo: jogador do grupo, mensalista ou
 * avulso, tem preferencia. Quem nao couber e cancelado por falta de vaga,
 * e a cota do mes do anfitriao volta a ficar disponivel.
 */
create or replace function public.consolidar_convidados(p_round_id uuid)
returns setof public.round_guests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rodada public.rounds%rowtype;
  v_livres integer;
begin
  select * into v_rodada from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'rodada_nao_encontrada';
  end if;

  v_livres := v_rodada.capacity
            - (select count(*)::int from public.round_participants
               where round_id = p_round_id and status in ('confirmed', 'invited'))
            - (select count(*)::int from public.round_guests
               where round_id = p_round_id and status = 'confirmed');

  if v_livres < 0 then
    v_livres := 0;
  end if;

  return query
  with cabem as (
    select id
    from public.round_guests
    where round_id = p_round_id and status = 'waiting'
    order by created_at, id
    limit v_livres
    for update
  )
  update public.round_guests g
  set status = 'confirmed', confirmed_at = now()
  from cabem
  where g.id = cabem.id
  returning g.*;
end;
$$;

revoke all on function public.convidados_usados_no_mes(uuid, date) from public, anon, authenticated;
revoke all on function public.consolidar_convidados(uuid) from public, anon, authenticated;
