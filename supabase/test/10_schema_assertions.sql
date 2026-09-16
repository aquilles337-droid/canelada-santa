-- ============================================================
-- Asserções de schema — rodam contra o banco local
-- ============================================================
-- Cada bloco tenta violar uma regra que o sistema depende e exige que o
-- banco recuse. Se qualquer constraint sumir numa migration futura, isto
-- quebra antes de chegar em producao.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.must_fail(sql text, label text)
returns void
language plpgsql
as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice '  ok  %', label;
    return;
  end;
  raise exception 'FALHOU: % — o banco aceitou algo que deveria recusar', label;
end;
$$;

-- ------------------------------------------------------------
-- Dados minimos
-- ------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', '5582900000001@telefone.canelada.app'),
  ('22222222-2222-2222-2222-222222222222', '5582900000002@telefone.canelada.app');

insert into public.profiles (id, full_name, phone, role, is_member, is_goalkeeper)
values
  ('11111111-1111-1111-1111-111111111111', 'Admin Teste', '5582900000001', 'admin', true, false),
  ('22222222-2222-2222-2222-222222222222', 'Jogador Teste', '5582900000002', 'player', false, true);

insert into public.rounds (
  id, season_id, number, starts_at, venue, capacity, teams_count,
  match_minutes, goals_to_win, list_closes_at, waitlist_unlock_at,
  cancel_deadline_hours, pricing, fine_rules
)
select
  '33333333-3333-3333-3333-333333333333', s.id, 1, now() + interval '2 days',
  'Arena Teste', 20, 4, 8, 2, now() + interval '1 day 22 hours',
  now() + interval '1 day 19 hours', 2,
  '{"casual_price_cents":1000}'::jsonb, '{"late_cancel_fine_cents":1000}'::jsonb
from public.seasons s where s.is_current;

insert into public.round_participants (id, round_id, profile_id, kind, priority_tier, status, confirmed_at)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'monthly', 0, 'confirmed', now()
);

-- ------------------------------------------------------------
-- Regras que o banco precisa impor
-- ------------------------------------------------------------
select pg_temp.must_fail($$
  insert into public.round_participants (round_id, profile_id, kind, priority_tier, status, confirmed_at)
  values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','monthly',0,'confirmed',now())
$$, 'um jogador nao entra duas vezes na mesma rodada');

select pg_temp.must_fail($$
  insert into public.round_participants (round_id, profile_id, kind, priority_tier, status, confirmed_at)
  values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','casual',0,'confirmed',now())
$$, 'faixa de prioridade tem de bater com mensalista/avulso');

select pg_temp.must_fail($$
  insert into public.round_participants (round_id, profile_id, kind, priority_tier, status)
  values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','casual',1,'confirmed')
$$, 'confirmado sem data de confirmacao e recusado');

select pg_temp.must_fail($$
  insert into public.round_participants (round_id, profile_id, kind, priority_tier, status, invited_at)
  values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','casual',1,'invited',now())
$$, 'convite da fila sem prazo e recusado');

select pg_temp.must_fail($$
  insert into public.player_rating_votes (voter_id, target_id, score)
  values ('11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111', 10)
$$, 'ninguem se avalia');

select pg_temp.must_fail($$
  insert into public.player_rating_votes (voter_id, target_id, score)
  values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222', 11)
$$, 'nota fora de 0 a 10 e recusada');

insert into public.round_votes (round_id, voter_id, target_id, kind)
values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','mvp');

select pg_temp.must_fail($$
  insert into public.round_votes (round_id, voter_id, target_id, kind)
  values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','mvp')
$$, 'so um voto de craque por rodada');

select pg_temp.must_fail($$
  insert into public.round_votes (round_id, voter_id, target_id, kind)
  values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','bagre')
$$, 'ninguem vota em si mesmo para bagre');

-- Idempotencia financeira
insert into public.charges (profile_id, type, amount_cents, description, idempotency_key)
values ('22222222-2222-2222-2222-222222222222','match',1000,'Avulso rodada 1','match:33333333-3333-3333-3333-333333333333:22222222-2222-2222-2222-222222222222');

select pg_temp.must_fail($$
  insert into public.charges (profile_id, type, amount_cents, description, idempotency_key)
  values ('22222222-2222-2222-2222-222222222222','match',1000,'Avulso rodada 1 (duplicado)','match:33333333-3333-3333-3333-333333333333:22222222-2222-2222-2222-222222222222')
$$, 'a mesma cobranca nao e criada duas vezes');

select pg_temp.must_fail($$
  insert into public.charges (profile_id, type, amount_cents, description, idempotency_key, status)
  values ('22222222-2222-2222-2222-222222222222','match',1000,'Paga sem data','x:1','paid')
$$, 'cobranca paga exige data de pagamento');

select pg_temp.must_fail($$
  insert into public.charges (profile_id, type, subtype, amount_cents, description, idempotency_key)
  values ('22222222-2222-2222-2222-222222222222','fine','inventado',1000,'Multa estranha','x:2')
$$, 'multa so existe com motivo conhecido');

insert into public.payments (charge_id, provider_payment_id, external_reference, amount_cents)
select id, 'MP-123', 'charge:' || id, amount_cents from public.charges limit 1;

select pg_temp.must_fail($$
  insert into public.payments (charge_id, provider_payment_id, external_reference, amount_cents)
  select id, 'MP-123', 'charge:' || id, amount_cents from public.charges limit 1
$$, 'o mesmo pagamento do provedor nao entra duas vezes');

insert into public.webhook_events (provider_event_id, payload) values ('evt-1', '{}'::jsonb);
select pg_temp.must_fail($$
  insert into public.webhook_events (provider_event_id, payload) values ('evt-1', '{}'::jsonb)
$$, 'webhook repetido e recusado pelo banco');

-- Temporada e rodada
select pg_temp.must_fail($$
  insert into public.seasons (name, starts_on, ends_on, is_current)
  values ('Temporada Fantasma', '2030-01-10', '2031-01-09', true)
$$, 'so existe uma temporada corrente');

select pg_temp.must_fail($$
  insert into public.rounds (season_id, number, starts_at, venue, capacity, teams_count, match_minutes,
                             goals_to_win, list_closes_at, waitlist_unlock_at, cancel_deadline_hours, pricing, fine_rules)
  select s.id, 2, now() + interval '1 day', 'Arena', 20, 4, 8, 2,
         now() + interval '3 days', now(), 2, '{}'::jsonb, '{}'::jsonb
  from public.seasons s where s.is_current
$$, 'lista nao pode fechar depois do inicio do racha');

select pg_temp.must_fail($$
  insert into public.rounds (season_id, number, starts_at, venue, capacity, teams_count, match_minutes,
                             goals_to_win, list_closes_at, waitlist_unlock_at, cancel_deadline_hours, pricing, fine_rules)
  select s.id, 1, now() + interval '5 days', 'Arena', 20, 4, 8, 2,
         now() + interval '4 days', now(), 2, '{}'::jsonb, '{}'::jsonb
  from public.seasons s where s.is_current
$$, 'numero de rodada nao se repete na temporada');

-- Mensalidade
insert into public.memberships (profile_id, competence, amount_cents, due_date)
values ('11111111-1111-1111-1111-111111111111', date_trunc('month', current_date)::date, 2500, current_date);

select pg_temp.must_fail($$
  insert into public.memberships (profile_id, competence, amount_cents, due_date)
  values ('11111111-1111-1111-1111-111111111111', date_trunc('month', current_date)::date, 2500, current_date)
$$, 'uma mensalidade por jogador por mes');

select pg_temp.must_fail($$
  insert into public.memberships (profile_id, competence, amount_cents, due_date)
  values ('22222222-2222-2222-2222-222222222222', current_date + 3, 2500, current_date)
$$, 'competencia precisa ser o primeiro dia do mes');

-- Times
insert into public.teams (id, round_id, idx, name, color)
values ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333',1,'Time 1','ouro');

select pg_temp.must_fail($$
  insert into public.teams (round_id, idx, name, color)
  values ('33333333-3333-3333-3333-333333333333',1,'Time 1 bis','preto')
$$, 'nao existem dois times com o mesmo numero na rodada');

select pg_temp.must_fail($$
  insert into public.team_members (team_id, rating_snapshot) values ('55555555-5555-5555-5555-555555555555', 5)
$$, 'integrante de time e jogador ou convidado, nunca nenhum dos dois');

-- Perfil
select pg_temp.must_fail($$
  insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666','x@y.z');
  insert into public.profiles (id, full_name, phone) values ('66666666-6666-6666-6666-666666666666','Fulano','abc')
$$, 'telefone precisa ser somente digitos');

select pg_temp.must_fail($$
  insert into public.profiles (id, full_name, phone) values ('66666666-6666-6666-6666-666666666666','Fulano','5582900000001')
$$, 'telefone nao se repete entre jogadores');

-- Visao de nota efetiva: sem votos suficientes usa a nota padrao
do $$
declare r record;
begin
  select * into r from public.v_player_effective_rating where profile_id = '22222222-2222-2222-2222-222222222222';
  if r.has_enough_votes then
    raise exception 'FALHOU: jogador sem votos nao deveria ter nota consolidada';
  end if;
  if r.rating <> (select default_rating from public.settings) then
    raise exception 'FALHOU: sem votos suficientes a nota deveria ser a padrao configurada';
  end if;
  raise notice '  ok  jogador sem votos usa a nota padrao configurada';
end
$$;

-- RLS precisa estar ligado em todas as tabelas de dados
do $$
declare faltando text;
begin
  select string_agg(c.relname, ', ') into faltando
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if faltando is not null then
    raise exception 'FALHOU: RLS desligado em: %', faltando;
  end if;
  raise notice '  ok  RLS ligado em todas as tabelas';
end
$$;
