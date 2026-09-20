-- ============================================================
-- Asserções das estatísticas por temporada
-- ============================================================
-- Estas asserções conferem NÚMEROS, não regras de recusa: montam uma
-- temporada inteira com gols, partidas e votação conhecidos e exigem que a
-- visão devolva exatamente o que foi cadastrado.
--
-- É o buraco que deixou passar o bug do ranking: a visão antiga juntava
-- gols (uma linha por rodada) com resultados (uma linha por partida) na
-- mesma consulta, e cada gol saía multiplicado pelo número de partidas.
-- Seis gols numa rodada de sete partidas viravam quarenta e dois.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.exigir_est(condicao boolean, label text)
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

-- Compara um campo da visão com o valor esperado e mostra os dois na falha.
-- Recebe numeric de propósito: assim a asserção falha pelo NÚMERO errado, e
-- não por diferença de tipo entre uma versão da visão e outra.
create or replace function pg_temp.exigir_igual(
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
  v_temporada  uuid;
  v_artilheiro uuid := '0eeeeeee-0000-0000-0000-000000000001';  -- faz gols, time A
  v_garcom     uuid := '0eeeeeee-0000-0000-0000-000000000002';  -- da assistencias, time B
  v_parceiro   uuid := '0eeeeeee-0000-0000-0000-000000000003';  -- faz os gols do time B
  v_rodada1    uuid;
  v_rodada2    uuid;
  v_timeA1     uuid;
  v_timeB1     uuid;
  v_timeA2     uuid;
  v_timeB2     uuid;
  v_pA1        uuid;  -- participacao do artilheiro na rodada 1
  v_pG1        uuid;
  v_pP1        uuid;
  v_pA2        uuid;
  v_pG2        uuid;
  v_partida    uuid;
  v_gol        uuid;
  v_est        record;
  i            integer;
begin
  select id into v_temporada from public.seasons where is_current limit 1;

  -- ----------------------------------------------------------
  -- Jogadores
  -- ----------------------------------------------------------
  insert into auth.users (id, email) values
    (v_artilheiro, 'artilheiro@teste.test'),
    (v_garcom,     'garcom@teste.test'),
    (v_parceiro,   'parceiro@teste.test');

  insert into public.profiles (id, full_name, phone, joined_at) values
    (v_artilheiro, 'Artilheiro Teste', '5582955550001', now() - interval '90 days'),
    (v_garcom,     'Garcom Teste',     '5582955550002', now() - interval '90 days'),
    (v_parceiro,   'Parceiro Teste',   '5582955550003', now() - interval '90 days');

  -- ----------------------------------------------------------
  -- Rodada 1: SETE partidas, é o multiplicador que inflava tudo
  -- ----------------------------------------------------------
  insert into public.rounds (
    season_id, number, starts_at, venue, capacity, teams_count, match_minutes,
    goals_to_win, list_opens_at, list_closes_at, waitlist_unlock_at,
    cancel_deadline_hours, pricing, fine_rules, status, finished_at
  ) values (
    v_temporada, 9001, now() - interval '14 days', 'Quadra do teste', 20, 2, 10,
    2, now() - interval '21 days', now() - interval '15 days', now() - interval '15 days', 5,
    '{}'::jsonb, '{}'::jsonb, 'finished', now() - interval '14 days'
  ) returning id into v_rodada1;

  insert into public.round_participants
    (round_id, profile_id, kind, priority_tier, status, confirmed_at, attendance)
  values
    (v_rodada1, v_artilheiro, 'casual', 1, 'confirmed', now() - interval '20 days', 'present'),
    (v_rodada1, v_garcom,     'casual', 1, 'confirmed', now() - interval '20 days', 'present'),
    (v_rodada1, v_parceiro,   'casual', 1, 'confirmed', now() - interval '20 days', 'present');

  select id into v_pA1 from public.round_participants
    where round_id = v_rodada1 and profile_id = v_artilheiro;
  select id into v_pG1 from public.round_participants
    where round_id = v_rodada1 and profile_id = v_garcom;
  select id into v_pP1 from public.round_participants
    where round_id = v_rodada1 and profile_id = v_parceiro;

  insert into public.teams (round_id, idx, name, color)
  values (v_rodada1, 1, 'Time 1', 'preto') returning id into v_timeA1;
  insert into public.teams (round_id, idx, name, color)
  values (v_rodada1, 2, 'Time 2', 'branco') returning id into v_timeB1;

  insert into public.team_members (team_id, participant_id, rating_snapshot) values
    (v_timeA1, v_pA1, 8.0),
    (v_timeB1, v_pG1, 7.0),
    (v_timeB1, v_pP1, 7.5);

  -- Sete partidas encerradas: 4 do time 1, 2 do time 2, 1 empate.
  for i in 1..7 loop
    insert into public.matches (
      round_id, seq, team_a_id, team_b_id, score_a, score_b, status, result
    ) values (
      v_rodada1, i, v_timeA1, v_timeB1,
      case when i <= 4 then 2 when i <= 6 then 0 else 1 end,
      case when i <= 4 then 0 when i <= 6 then 2 else 1 end,
      'finished',
      (case when i <= 4 then 'team_a' when i <= 6 then 'team_b' else 'draw' end)::public.match_result
    );
  end loop;

  -- Seis gols do artilheiro, todos na MESMA partida de propósito: o número
  -- tem de sair 6, e não 6 x 7.
  select id into v_partida from public.matches where round_id = v_rodada1 and seq = 1;
  for i in 1..6 loop
    insert into public.match_events (match_id, kind, team_id, participant_id)
    values (v_partida, 'goal', v_timeA1, v_pA1);
  end loop;

  -- Dois gols do parceiro, cada um com assistência do garçom.
  for i in 1..2 loop
    insert into public.match_events (match_id, kind, team_id, participant_id)
    values (v_partida, 'goal', v_timeB1, v_pP1)
    returning id into v_gol;

    insert into public.match_events (match_id, kind, team_id, participant_id, related_event_id)
    values (v_partida, 'assist', v_timeB1, v_pG1, v_gol);
  end loop;

  -- Votação da rodada 1: artilheiro é craque, garçom é bagre.
  insert into public.round_votes (round_id, voter_id, target_id, kind) values
    (v_rodada1, v_garcom,     v_artilheiro, 'mvp'),
    (v_rodada1, v_parceiro,   v_artilheiro, 'mvp'),
    (v_rodada1, v_artilheiro, v_garcom,     'bagre'),
    (v_rodada1, v_parceiro,   v_garcom,     'bagre');

  -- ----------------------------------------------------------
  -- Rodada 2: duas partidas, para conferir a soma entre rodadas
  -- ----------------------------------------------------------
  insert into public.rounds (
    season_id, number, starts_at, venue, capacity, teams_count, match_minutes,
    goals_to_win, list_opens_at, list_closes_at, waitlist_unlock_at,
    cancel_deadline_hours, pricing, fine_rules, status, finished_at
  ) values (
    v_temporada, 9002, now() - interval '7 days', 'Quadra do teste', 20, 2, 10,
    2, now() - interval '14 days', now() - interval '8 days', now() - interval '8 days', 5,
    '{}'::jsonb, '{}'::jsonb, 'finished', now() - interval '7 days'
  ) returning id into v_rodada2;

  insert into public.round_participants
    (round_id, profile_id, kind, priority_tier, status, confirmed_at, attendance, absence_justified)
  values
    (v_rodada2, v_artilheiro, 'casual', 1, 'confirmed', now() - interval '10 days', 'present', null),
    (v_rodada2, v_garcom,     'casual', 1, 'confirmed', now() - interval '10 days', 'absent',  true);

  select id into v_pA2 from public.round_participants
    where round_id = v_rodada2 and profile_id = v_artilheiro;
  select id into v_pG2 from public.round_participants
    where round_id = v_rodada2 and profile_id = v_garcom;

  insert into public.teams (round_id, idx, name, color)
  values (v_rodada2, 1, 'Time 1', 'preto') returning id into v_timeA2;
  insert into public.teams (round_id, idx, name, color)
  values (v_rodada2, 2, 'Time 2', 'branco') returning id into v_timeB2;

  insert into public.team_members (team_id, participant_id, rating_snapshot) values
    (v_timeA2, v_pA2, 8.0),
    (v_timeB2, v_pG2, 7.0);

  insert into public.matches (round_id, seq, team_a_id, team_b_id, score_a, score_b, status, result)
  values
    (v_rodada2, 1, v_timeA2, v_timeB2, 3, 1, 'finished', 'team_a'),
    (v_rodada2, 2, v_timeA2, v_timeB2, 0, 2, 'finished', 'team_b');

  select id into v_partida from public.matches where round_id = v_rodada2 and seq = 1;
  insert into public.match_events (match_id, kind, team_id, participant_id)
  values (v_partida, 'goal', v_timeA2, v_pA2);

  -- Partida ainda em andamento não vira vitória nem derrota de ninguém.
  insert into public.matches (round_id, seq, team_a_id, team_b_id, score_a, score_b, status)
  values (v_rodada2, 3, v_timeA2, v_timeB2, 1, 0, 'live');

  -- ----------------------------------------------------------
  -- O que a visão tem de devolver
  -- ----------------------------------------------------------
  select * into v_est from public.v_estatisticas_por_temporada
   where profile_id = v_artilheiro and season_id = v_temporada;

  perform pg_temp.exigir_est(v_est is not null, 'o artilheiro aparece na temporada');

  -- 6 gols na rodada de SETE partidas + 1 na rodada de duas. Com o bug
  -- antigo este numero saia 44 (6 x 7 + 1 x 2), nao 7.
  perform pg_temp.exigir_igual(v_est.gols, 7, 'gols do artilheiro nao sao multiplicados pelas partidas');
  perform pg_temp.exigir_igual(v_est.assistencias, 0, 'artilheiro nao ganha assistencia alheia');
  perform pg_temp.exigir_igual(v_est.rodadas_aptas, 2, 'rodadas aptas do artilheiro');
  perform pg_temp.exigir_igual(v_est.presencas, 2, 'presencas do artilheiro');
  perform pg_temp.exigir_igual(v_est.faltas, 0, 'faltas do artilheiro');
  perform pg_temp.exigir_igual(v_est.vitorias, 5, 'vitorias do artilheiro (4 + 1)');
  perform pg_temp.exigir_igual(v_est.derrotas, 3, 'derrotas do artilheiro (2 + 1)');
  perform pg_temp.exigir_igual(v_est.empates, 1, 'empates do artilheiro');
  -- Ser eleito craque nao pode multiplicar vitoria nem gol: era o segundo
  -- fator de inflacao da visao antiga.
  perform pg_temp.exigir_igual(v_est.craques, 1, 'craques do artilheiro');
  perform pg_temp.exigir_igual(v_est.bagres, 0, 'bagres do artilheiro');

  select * into v_est from public.v_estatisticas_por_temporada
   where profile_id = v_garcom and season_id = v_temporada;

  perform pg_temp.exigir_igual(v_est.gols, 0, 'garcom nao marcou gol');
  perform pg_temp.exigir_igual(v_est.assistencias, 2, 'assistencias do garcom nao sao multiplicadas');
  perform pg_temp.exigir_igual(v_est.presencas, 1, 'presencas do garcom');
  perform pg_temp.exigir_igual(v_est.faltas, 1, 'faltas do garcom');
  perform pg_temp.exigir_igual(v_est.faltas_justificadas, 1, 'faltas justificadas do garcom');
  perform pg_temp.exigir_igual(v_est.vitorias, 3, 'vitorias do garcom (2 + 1)');
  perform pg_temp.exigir_igual(v_est.derrotas, 5, 'derrotas do garcom (4 + 1)');
  perform pg_temp.exigir_igual(v_est.empates, 1, 'empates do garcom');
  perform pg_temp.exigir_igual(v_est.bagres, 1, 'bagres do garcom');
  perform pg_temp.exigir_igual(v_est.craques, 0, 'craques do garcom');

  select * into v_est from public.v_estatisticas_por_temporada
   where profile_id = v_parceiro and season_id = v_temporada;

  perform pg_temp.exigir_igual(v_est.gols, 2, 'gols do parceiro');
  perform pg_temp.exigir_igual(v_est.rodadas_aptas, 2, 'o parceiro esta apto mesmo sem jogar a rodada 2');
  perform pg_temp.exigir_igual(v_est.presencas, 1, 'presencas do parceiro');
  perform pg_temp.exigir_igual(v_est.faltas, 0, 'quem nem entrou na lista nao leva falta');

  raise notice 'estatisticas conferidas';
end
$$;

-- Nenhum jogador pode ter mais gols do que a soma dos eventos de gol do
-- banco inteiro: rede de seguranca contra qualquer multiplicacao futura.
do $$
declare
  v_na_visao   integer;
  v_no_banco   integer;
begin
  select coalesce(sum(gols), 0)::int into v_na_visao
    from public.v_estatisticas_por_temporada;
  select count(*)::int into v_no_banco
    from public.match_events where kind = 'goal';

  if v_na_visao > v_no_banco then
    raise exception 'FALHOU: a visao soma % gols, mas o banco so tem % (fan-out de novo)',
      v_na_visao, v_no_banco;
  end if;
  raise notice '  ok  a soma de gols da visao (%) nao passa dos gols do banco (%)',
    v_na_visao, v_no_banco;
end
$$;
