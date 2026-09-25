-- ============================================================
-- Asserções do goleiro no gol
-- ============================================================
-- O goleiro é do GOL, não do time: a linha gira com o "quem ganha fica" e
-- ele continua ali. Numa noite de várias partidas ele joga por times
-- diferentes, e a vitória tem de seguir o LADO que ele defendeu.
--
-- Era exatamente isso que o modelo antigo não sabia fazer: o resultado vinha
-- do time a que a pessoa pertencia na rodada inteira, e o goleiro ficava
-- preso ao time do primeiro sorteio a noite toda.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.exigir_gol(condicao boolean, label text)
returns void
language plpgsql
as $$
begin
  if not condicao then
    raise exception 'FALHOU: %', label;
  end if;
  raise notice '  ok  %', label;
end;
$$;

create or replace function pg_temp.exigir_conta(
  obtido numeric, esperado numeric, label text
)
returns void
language plpgsql
as $$
begin
  if obtido is distinct from esperado then
    raise exception 'FALHOU: % (esperado %, obtido %)', label, esperado, obtido;
  end if;
  raise notice '  ok  %  = %', label, esperado;
end;
$$;

do $$
declare
  v_temporada uuid;
  v_rodada    uuid;
  v_gk1       uuid := '0fffffff-0000-0000-0000-000000000001';
  v_gk2       uuid := '0fffffff-0000-0000-0000-000000000002';
  v_l1        uuid := '0fffffff-0000-0000-0000-000000000011';
  v_l2        uuid := '0fffffff-0000-0000-0000-000000000012';
  v_l3        uuid := '0fffffff-0000-0000-0000-000000000013';
  v_l4        uuid := '0fffffff-0000-0000-0000-000000000014';
  p_gk1       uuid;
  p_gk2       uuid;
  t1          uuid;
  t2          uuid;
  t3          uuid;
  t4          uuid;
  v_est       record;
begin
  select id into v_temporada from public.seasons where is_current;

  insert into auth.users (id, email) values
    (v_gk1, 'gk1@teste.test'), (v_gk2, 'gk2@teste.test'),
    (v_l1, 'l1@teste.test'), (v_l2, 'l2@teste.test'),
    (v_l3, 'l3@teste.test'), (v_l4, 'l4@teste.test');

  insert into public.profiles (id, full_name, phone, joined_at, is_goalkeeper) values
    (v_gk1, 'Goleiro Um',  '5582966660001', now() - interval '90 days', true),
    (v_gk2, 'Goleiro Dois','5582966660002', now() - interval '90 days', true),
    (v_l1,  'Linha Um',    '5582966660011', now() - interval '90 days', false),
    (v_l2,  'Linha Dois',  '5582966660012', now() - interval '90 days', false),
    (v_l3,  'Linha Tres',  '5582966660013', now() - interval '90 days', false),
    (v_l4,  'Linha Quatro','5582966660014', now() - interval '90 days', false);

  insert into public.rounds (
    season_id, number, starts_at, venue, capacity, teams_count, match_minutes,
    goals_to_win, list_opens_at, list_closes_at, waitlist_unlock_at,
    cancel_deadline_hours, pricing, fine_rules, status, finished_at
  ) values (
    v_temporada, 9003, now() - interval '3 days', 'Quadra do teste', 18, 4, 10,
    2, now() - interval '10 days', now() - interval '4 days', now() - interval '4 days', 5,
    '{}'::jsonb, '{}'::jsonb, 'finished', now() - interval '3 days'
  ) returning id into v_rodada;

  insert into public.round_participants
    (round_id, profile_id, kind, priority_tier, status, confirmed_at, attendance)
  select v_rodada, p, 'casual', 1, 'confirmed', now() - interval '9 days', 'present'
  from unnest(array[v_gk1, v_gk2, v_l1, v_l2, v_l3, v_l4]) as p;

  select id into p_gk1 from public.round_participants where round_id = v_rodada and profile_id = v_gk1;
  select id into p_gk2 from public.round_participants where round_id = v_rodada and profile_id = v_gk2;

  -- Os goleiros da rodada. Note que eles NÃO entram em team_members.
  insert into public.round_goalkeepers (round_id, participant_id, idx)
  values (v_rodada, p_gk1, 1), (v_rodada, p_gk2, 2);

  -- Quatro times de linha, um jogador cada — o suficiente para a linha girar.
  insert into public.teams (round_id, idx, name, color)
  values (v_rodada, 1, 'Time 1', 'ouro') returning id into t1;
  insert into public.teams (round_id, idx, name, color)
  values (v_rodada, 2, 'Time 2', 'azul') returning id into t2;
  insert into public.teams (round_id, idx, name, color)
  values (v_rodada, 3, 'Time 3', 'vermelho') returning id into t3;
  insert into public.teams (round_id, idx, name, color)
  values (v_rodada, 4, 'Time 4', 'branco') returning id into t4;

  insert into public.team_members (team_id, participant_id, rating_snapshot)
  select t.id, rp.id, 7.0
  from (values (t1, v_l1), (t2, v_l2), (t3, v_l3), (t4, v_l4)) as p(time_id, perfil)
  join public.teams t on t.id = p.time_id
  join public.round_participants rp on rp.round_id = v_rodada and rp.profile_id = p.perfil;

  -- ----------------------------------------------------------
  -- Três partidas, com os MESMOS goleiros e linhas diferentes
  -- ----------------------------------------------------------
  -- Gol 1 é sempre do goleiro 1, gol 2 sempre do goleiro 2. É isso que muda
  -- a conta: o goleiro 1 ganha na partida 1 jogando com o Time 1, e perde na
  -- partida 2 jogando com o mesmo Time 1 contra o Time 3.
  insert into public.matches (
    round_id, seq, team_a_id, team_b_id, goalkeeper_a_id, goalkeeper_b_id,
    score_a, score_b, status, result
  ) values
    -- 1: lado A (goleiro 1) vence
    (v_rodada, 1, t1, t2, p_gk1, p_gk2, 2, 0, 'finished', 'team_a'),
    -- 2: lado B (goleiro 2) vence
    (v_rodada, 2, t1, t3, p_gk1, p_gk2, 0, 2, 'finished', 'team_b'),
    -- 3: empate
    (v_rodada, 3, t4, t3, p_gk1, p_gk2, 1, 1, 'finished', 'draw');

  -- ----------------------------------------------------------
  -- A conta do goleiro
  -- ----------------------------------------------------------
  select * into v_est from public.v_estatisticas_por_temporada
   where profile_id = v_gk1 and season_id = v_temporada;

  perform pg_temp.exigir_gol(v_est is not null, 'o goleiro aparece nas estatisticas');
  perform pg_temp.exigir_conta(v_est.vitorias, 1, 'vitoria do goleiro 1 (venceu no lado que defendia)');
  perform pg_temp.exigir_conta(v_est.derrotas, 1, 'derrota do goleiro 1');
  perform pg_temp.exigir_conta(v_est.empates, 1, 'empate do goleiro 1');

  select * into v_est from public.v_estatisticas_por_temporada
   where profile_id = v_gk2 and season_id = v_temporada;

  perform pg_temp.exigir_conta(v_est.vitorias, 1, 'vitoria do goleiro 2');
  perform pg_temp.exigir_conta(v_est.derrotas, 1, 'derrota do goleiro 2');
  perform pg_temp.exigir_conta(v_est.empates, 1, 'empate do goleiro 2');

  -- O goleiro jogou as TRÊS partidas, mesmo sem pertencer a time nenhum.
  -- Antes desta correção ele não teria nenhuma, porque não está em
  -- team_members.
  perform pg_temp.exigir_conta(
    (select count(*) from public.v_resultados_por_jogador where profile_id = v_gk1),
    3,
    'o goleiro 1 tem resultado nas tres partidas'
  );

  -- Ninguém conta duas vezes a mesma partida.
  perform pg_temp.exigir_conta(
    (select count(*) from (
       select profile_id, match_id from public.v_resultados_por_jogador
       group by profile_id, match_id having count(*) > 1
     ) repetidos),
    0,
    'ninguem tem dois resultados na mesma partida'
  );

  -- ----------------------------------------------------------
  -- A linha continua contando pelo time, como sempre
  -- ----------------------------------------------------------
  select * into v_est from public.v_estatisticas_por_temporada
   where profile_id = v_l1 and season_id = v_temporada;
  perform pg_temp.exigir_conta(v_est.vitorias, 1, 'linha 1: venceu a partida 1');
  perform pg_temp.exigir_conta(v_est.derrotas, 1, 'linha 1: perdeu a partida 2');
  perform pg_temp.exigir_conta(v_est.empates, 0, 'linha 1 nao jogou o empate');

  select * into v_est from public.v_estatisticas_por_temporada
   where profile_id = v_l3 and season_id = v_temporada;
  perform pg_temp.exigir_conta(v_est.vitorias, 1, 'linha 3: venceu a partida 2');
  perform pg_temp.exigir_conta(v_est.empates, 1, 'linha 3: empatou a partida 3');

  -- O goleiro NÃO está em time de linha: é o que garante que ele não seja
  -- contado duas vezes.
  perform pg_temp.exigir_gol(
    not exists (
      select 1 from public.team_members tm
      where tm.participant_id in (p_gk1, p_gk2)
    ),
    'goleiro nao e integrante de time de linha'
  );

  raise notice 'goleiros conferidos';
end
$$;

-- ------------------------------------------------------------
-- O que o banco tem de recusar
-- ------------------------------------------------------------
do $$
declare
  v_rodada uuid;
  p_gk1    uuid;
  t1       uuid;
  t2       uuid;
  recusou  boolean;
begin
  select id into v_rodada from public.rounds where number = 9003;
  select rp.id into p_gk1 from public.round_participants rp
   where rp.round_id = v_rodada and rp.profile_id = '0fffffff-0000-0000-0000-000000000001';
  select id into t1 from public.teams where round_id = v_rodada and idx = 1;
  select id into t2 from public.teams where round_id = v_rodada and idx = 2;

  -- O mesmo goleiro nos dois gols da mesma partida.
  recusou := false;
  begin
    insert into public.matches (
      round_id, seq, team_a_id, team_b_id, goalkeeper_a_id, goalkeeper_b_id, status
    ) values (v_rodada, 90, t1, t2, p_gk1, p_gk1, 'scheduled');
  exception when check_violation then
    recusou := true;
  end;
  perform pg_temp.exigir_gol(recusou, 'ninguem defende os dois gols na mesma partida');

  -- O mesmo goleiro duas vezes na mesma rodada.
  recusou := false;
  begin
    insert into public.round_goalkeepers (round_id, participant_id, idx)
    values (v_rodada, p_gk1, 9);
  exception when unique_violation then
    recusou := true;
  end;
  perform pg_temp.exigir_gol(recusou, 'o mesmo goleiro nao entra duas vezes na rodada');

  -- Dois goleiros na mesma ordem de entrada.
  recusou := false;
  begin
    insert into public.round_goalkeepers (round_id, participant_id, idx)
    select v_rodada, rp.id, 1
    from public.round_participants rp
    where rp.round_id = v_rodada and rp.profile_id = '0fffffff-0000-0000-0000-000000000013';
  exception when unique_violation then
    recusou := true;
  end;
  perform pg_temp.exigir_gol(recusou, 'duas pessoas nao ocupam o mesmo gol');
end
$$;
