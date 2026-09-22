-- ============================================================
-- Asserções do reinício da temporada
-- ============================================================
-- Rodam DEPOIS de supabase/reiniciar-temporada.sql ter sido aplicado com a
-- confirmação ligada. Conferem as duas metades da promessa: o movimento da
-- temporada sumiu, e o que não é movimento continua de pé.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.exigir_rein(condicao boolean, label text)
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

create or replace function pg_temp.exigir_zero(quantidade bigint, label text)
returns void
language plpgsql
as $$
begin
  if quantidade <> 0 then
    raise exception 'FALHOU: % (sobraram % linhas)', label, quantidade;
  end if;
  raise notice '  ok  % = 0', label;
end;
$$;

do $$
declare
  v_temporada uuid;
begin
  select id into v_temporada from public.seasons where is_current;

  -- ----------------------------------------------------------
  -- Sumiu o que tinha de sumir
  -- ----------------------------------------------------------
  perform pg_temp.exigir_zero(
    (select count(*) from public.rounds where season_id = v_temporada), 'rodadas da temporada');
  perform pg_temp.exigir_zero((select count(*) from public.round_participants), 'listas de presenca');
  perform pg_temp.exigir_zero((select count(*) from public.round_guests), 'convidados');
  perform pg_temp.exigir_zero((select count(*) from public.teams), 'times');
  perform pg_temp.exigir_zero((select count(*) from public.matches), 'partidas');
  perform pg_temp.exigir_zero((select count(*) from public.match_events), 'gols e assistencias');
  perform pg_temp.exigir_zero((select count(*) from public.round_votes), 'votos de craque e bagre');
  perform pg_temp.exigir_zero((select count(*) from public.round_photos), 'fotos das rodadas');
  -- O Supabase proibe apagar arquivo por SQL. O reinicio NAO pode quebrar
  -- por causa disso: ele segue, a foto some do aplicativo e o arquivo fica
  -- orfao no disco ate alguem rodar "npm run fotos:limpar".
  perform pg_temp.exigir_rein(
    exists (select 1 from storage.objects where bucket_id = 'fotos-rodadas'),
    'o arquivo da foto sobrevive (o Storage recusa apagar por SQL)');
  perform pg_temp.exigir_rein(
    not exists (
      select 1 from storage.objects o
      join public.round_photos f on f.storage_path = o.name
      where o.bucket_id = 'fotos-rodadas'
    ),
    'o arquivo que sobrou e orfao: nenhuma rodada aponta mais para ele');
  perform pg_temp.exigir_zero((select count(*) from public.charges), 'cobrancas');
  perform pg_temp.exigir_zero((select count(*) from public.payments), 'pagamentos (caem junto com a cobranca)');
  perform pg_temp.exigir_zero((select count(*) from public.memberships), 'mensalidades');
  perform pg_temp.exigir_zero(
    (select count(*) from public.player_achievements where season_id = v_temporada),
    'conquistas entregues na temporada');
  perform pg_temp.exigir_zero((select count(*) from public.notifications), 'avisos');

  -- O ranking fica vazio, nao quebrado.
  perform pg_temp.exigir_zero(
    (select count(*) from public.v_estatisticas_por_temporada), 'linhas no ranking');

  -- ----------------------------------------------------------
  -- Continua de pé o que não é movimento de temporada
  -- ----------------------------------------------------------
  perform pg_temp.exigir_rein(
    (select count(*) from public.profiles) > 0,
    'os jogadores continuam cadastrados');
  perform pg_temp.exigir_rein(
    exists (select 1 from public.profiles where id = '0eeeeeee-0000-0000-0000-000000000001'),
    'o jogador do teste anterior continua la');
  perform pg_temp.exigir_rein(
    exists (select 1 from public.settings where id),
    'as configuracoes do racha ficaram');
  perform pg_temp.exigir_rein(
    v_temporada is not null,
    'a temporada corrente continua existindo');
  perform pg_temp.exigir_rein(
    (select count(*) from public.achievements) > 0,
    'o catalogo de conquistas ficou');
  perform pg_temp.exigir_rein(
    (select count(*) from public.player_rating_votes) > 0,
    'as notas entre jogadores NAO sao apagadas por padrao');
  perform pg_temp.exigir_rein(
    exists (select 1 from storage.buckets where id = 'fotos-rodadas'),
    'os baldes do Storage continuam configurados');

  raise notice 'reinicio conferido';
end
$$;

-- Depois do reinício, criar a primeira rodada tem de funcionar — inclusive
-- com o número 1 livre de novo.
do $$
declare
  v_temporada uuid;
  v_rodada    uuid;
begin
  select id into v_temporada from public.seasons where is_current;

  insert into public.rounds (
    season_id, number, starts_at, venue, capacity, teams_count, match_minutes,
    goals_to_win, list_opens_at, list_closes_at, waitlist_unlock_at,
    cancel_deadline_hours, pricing, fine_rules, status
  ) values (
    v_temporada, 1, now() + interval '3 days', 'Quadra do racha', 20, 2, 10,
    2, now(), now() + interval '2 days', now() + interval '1 day', 5,
    '{}'::jsonb, '{}'::jsonb, 'open'
  ) returning id into v_rodada;

  if v_rodada is null then
    raise exception 'FALHOU: nao deu para criar a rodada 1 depois do reinicio';
  end if;
  raise notice '  ok  a rodada 1 pode ser criada de novo';

  delete from public.rounds where id = v_rodada;
end
$$;
