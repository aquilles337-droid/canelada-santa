-- ============================================================
-- Asserções da alocação de vaga
-- ============================================================
-- Verifica que as funções de reserva, promoção e expiração fazem exatamente
-- o que a lista de espera do racha exige.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.exigir(condicao boolean, label text)
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

do $$
declare
  v_temporada uuid;
  v_rodada    uuid;
  v_a         uuid := '0aaaaaaa-0000-0000-0000-000000000001';
  v_b         uuid := '0aaaaaaa-0000-0000-0000-000000000002';
  v_c         uuid := '0aaaaaaa-0000-0000-0000-000000000003';
  v_d         uuid := '0aaaaaaa-0000-0000-0000-000000000004';
  v_p         public.round_participants%rowtype;
  v_qtd       integer;
begin
  select id into v_temporada from public.seasons where is_current;

  insert into public.rounds (
    season_id, number, starts_at, venue, capacity, teams_count, match_minutes,
    goals_to_win, list_closes_at, waitlist_unlock_at, cancel_deadline_hours, pricing, fine_rules
  ) values (
    v_temporada, 900, now() + interval '2 days', 'Arena da Fila', 2, 2, 8, 2,
    now() + interval '1 day 22 hours', now() + interval '1 day 19 hours', 2,
    '{}'::jsonb, '{}'::jsonb
  ) returning id into v_rodada;

  insert into auth.users (id, email) values
    (v_a, 'a@fila.test'), (v_b, 'b@fila.test'), (v_c, 'c@fila.test'), (v_d, 'd@fila.test');

  insert into public.profiles (id, full_name, phone, is_member) values
    (v_a, 'Mensalista A', '5582911110001', true),
    (v_b, 'Mensalista B', '5582911110002', true),
    (v_c, 'Mensalista C', '5582911110003', true),
    (v_d, 'Avulso D',     '5582911110004', false);

  -- Duas vagas, tres mensalistas: os dois primeiros entram, o terceiro espera.
  v_p := public.reservar_vaga(v_rodada, v_a, 'monthly'::public.participant_kind, 0, true);
  perform pg_temp.exigir(v_p.status = 'confirmed', 'primeiro mensalista ocupa a vaga');

  v_p := public.reservar_vaga(v_rodada, v_b, 'monthly'::public.participant_kind, 0, true);
  perform pg_temp.exigir(v_p.status = 'confirmed', 'segundo mensalista ocupa a ultima vaga');

  v_p := public.reservar_vaga(v_rodada, v_c, 'monthly'::public.participant_kind, 0, true);
  perform pg_temp.exigir(v_p.status = 'waiting', 'com a lista cheia o terceiro vai para a espera');

  -- Avulso antes da janela: espera mesmo se houvesse vaga.
  v_p := public.reservar_vaga(v_rodada, v_d, 'casual'::public.participant_kind, 1, false);
  perform pg_temp.exigir(v_p.status = 'waiting', 'avulso antes da janela nunca ocupa vaga');

  -- Lista cheia: ninguem sobe.
  select count(*) into v_qtd from public.promover_fila(v_rodada, true, now() + interval '90 minutes');
  perform pg_temp.exigir(v_qtd = 0, 'com a lista cheia a fila nao anda');

  -- Alguem desiste: abre uma vaga.
  update public.round_participants
  set status = 'cancelled', cancelled_at = now()
  where round_id = v_rodada and profile_id = v_a;

  -- Antes da janela, so mensalista e chamado.
  select count(*) into v_qtd from public.promover_fila(v_rodada, false, now() + interval '90 minutes');
  perform pg_temp.exigir(v_qtd = 1, 'a vaga aberta chama uma pessoa');

  select * into v_p from public.round_participants where round_id = v_rodada and profile_id = v_c;
  perform pg_temp.exigir(v_p.status = 'invited', 'o mensalista da fila foi chamado, nao o avulso');
  perform pg_temp.exigir(v_p.invite_expires_at is not null, 'o convite de vaga tem prazo');

  select * into v_p from public.round_participants where round_id = v_rodada and profile_id = v_d;
  perform pg_temp.exigir(v_p.status = 'waiting', 'o avulso continua esperando antes da janela');

  -- O convite segura a vaga: nao ha vaga livre para chamar mais ninguem.
  select count(*) into v_qtd from public.promover_fila(v_rodada, true, now() + interval '90 minutes');
  perform pg_temp.exigir(v_qtd = 0, 'quem foi chamado segura a vaga ate o prazo');

  -- Aceitar a vaga confirma.
  v_p := public.aceitar_vaga((select id from public.round_participants where round_id = v_rodada and profile_id = v_c));
  perform pg_temp.exigir(v_p.status = 'confirmed', 'aceitar a vaga confirma a presenca');

  -- Aceitar duas vezes nao passa.
  begin
    perform public.aceitar_vaga((select id from public.round_participants where round_id = v_rodada and profile_id = v_c));
    raise exception 'FALHOU: aceitar a mesma vaga duas vezes deveria ser recusado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice '  ok  a mesma vaga nao e aceita duas vezes';
  end;

  -- Entrar duas vezes na mesma lista nao passa.
  begin
    perform public.reservar_vaga(v_rodada, v_b, 'monthly'::public.participant_kind, 0, true);
    raise exception 'FALHOU: entrar duas vezes na mesma lista deveria ser recusado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice '  ok  ninguem entra duas vezes na mesma lista';
  end;

  -- Quem desistiu pode voltar, e vai para o fim da fila.
  v_p := public.reservar_vaga(v_rodada, v_a, 'monthly'::public.participant_kind, 0, true);
  perform pg_temp.exigir(v_p.status = 'waiting', 'quem desistiu volta para a espera quando a lista encheu');
  perform pg_temp.exigir(v_p.cancelled_at is null, 'ao voltar, a desistencia anterior e limpa');

  -- Expiracao do convite devolve a pessoa para a fila.
  update public.round_participants
  set status = 'invited', invited_at = now(), invite_expires_at = now() - interval '1 minute'
  where round_id = v_rodada and profile_id = v_d;

  select count(*) into v_qtd from public.expirar_convites_de_vaga(v_rodada);
  perform pg_temp.exigir(v_qtd = 1, 'convite vencido e recolhido');

  select * into v_p from public.round_participants where round_id = v_rodada and profile_id = v_d;
  perform pg_temp.exigir(v_p.status = 'waiting', 'quem nao respondeu volta para a lista de espera');

  raise notice '';
end
$$;
