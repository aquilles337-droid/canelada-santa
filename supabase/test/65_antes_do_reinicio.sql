-- ============================================================
-- Prepara o terreno para testar o reinício da temporada
-- ============================================================
-- As asserções das estatísticas já deixaram rodadas, partidas, gols e
-- votação no banco. Aqui entram as peças que faltam para o reinício ter o
-- que apagar — e a nota entre jogadores, que ele NÃO pode apagar.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

do $$
declare
  v_artilheiro uuid := '0eeeeeee-0000-0000-0000-000000000001';
  v_garcom     uuid := '0eeeeeee-0000-0000-0000-000000000002';
  v_rodada     uuid;
  v_mensal     uuid;
begin
  select id into v_rodada from public.rounds where number = 9001;

  -- Foto da rodada, com o arquivo correspondente no Storage.
  insert into storage.objects (bucket_id, name)
  values ('fotos-rodadas', 'rodada-teste/foto.jpg');

  insert into public.round_photos (round_id, storage_path, uploaded_by)
  values (v_rodada, 'rodada-teste/foto.jpg', v_artilheiro);

  -- Mensalidade com cobrança e PIX gerado.
  insert into public.memberships (profile_id, competence, amount_cents, due_date, status)
  values (v_artilheiro, date_trunc('month', current_date)::date, 3000, current_date + 5, 'pending')
  returning id into v_mensal;

  insert into public.charges (profile_id, membership_id, type, amount_cents, description, idempotency_key)
  values (v_artilheiro, v_mensal, 'monthly', 3000, 'Mensalidade do teste', 'monthly:reinicio:1');

  insert into public.payments (charge_id, external_reference, amount_cents, status)
  select id, 'ref-reinicio-1', 3000, 'pending' from public.charges
   where idempotency_key = 'monthly:reinicio:1';

  -- Cobrança presa à rodada (avulso).
  insert into public.charges (profile_id, round_id, type, amount_cents, description, idempotency_key)
  values (v_garcom, v_rodada, 'match', 1500, 'Avulso do teste', 'match:reinicio:1');

  -- Conquista entregue na temporada.
  insert into public.player_achievements (profile_id, achievement_id, season_id, round_id)
  select v_artilheiro, a.id, r.season_id, r.id
  from public.achievements a, public.rounds r
  where a.slug = 'artilheiro_temporada' and r.id = v_rodada;

  -- Aviso na caixa de entrada.
  insert into public.notifications (profile_id, type, title, body)
  values (v_artilheiro, 'teste', 'Aviso do teste', 'corpo');

  -- A nota que um jogador deu ao outro: NAO e dado de temporada e tem de
  -- sobreviver ao reinicio.
  insert into public.player_rating_votes (voter_id, target_id, score)
  values (v_artilheiro, v_garcom, 8.0);

  raise notice 'terreno preparado para o reinicio';
end
$$;
