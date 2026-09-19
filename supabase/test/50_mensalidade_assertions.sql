-- ============================================================
-- Asserções da sincronia entre mensalidade e cobrança
-- ============================================================
-- Perdoar a dívida não pode deixar a competência em aberto: era assim que o
-- perdão acabava virando inadimplência quando a tarefa automática rodava.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.exigir_mens(condicao boolean, label text)
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
  v_jogador uuid := '0ddddddd-0000-0000-0000-000000000001';
  v_mes     date := date_trunc('month', current_date)::date;
  v_mensal  uuid;
  v_cobr    uuid;
  v_situacao public.membership_status;
begin
  insert into auth.users (id, email) values (v_jogador, 'mensalista@teste.test');
  insert into public.profiles (id, full_name, phone, is_member)
  values (v_jogador, 'Mensalista Sincronia', '5582944440001', true);

  -- 1. Perdoar a cobranca perdoa a competencia.
  insert into public.memberships (profile_id, competence, amount_cents, due_date, status)
  values (v_jogador, v_mes, 2500, current_date - 5, 'overdue')
  returning id into v_mensal;

  insert into public.charges (profile_id, membership_id, type, amount_cents, description, idempotency_key)
  values (v_jogador, v_mensal, 'monthly', 2500, 'Mensalidade', 'monthly:sinc:1')
  returning id into v_cobr;

  update public.charges set status = 'waived' where id = v_cobr;

  select status into v_situacao from public.memberships where id = v_mensal;
  perform pg_temp.exigir_mens(
    v_situacao = 'waived',
    'perdoar a cobranca tira a mensalidade da inadimplencia'
  );

  -- 2. Baixar a cobranca quita a competencia.
  insert into public.memberships (profile_id, competence, amount_cents, due_date, status)
  values (v_jogador, v_mes - interval '1 month', 2500, current_date - 35, 'overdue')
  returning id into v_mensal;

  insert into public.charges (profile_id, membership_id, type, amount_cents, description, idempotency_key)
  values (v_jogador, v_mensal, 'monthly', 2500, 'Mensalidade anterior', 'monthly:sinc:2')
  returning id into v_cobr;

  update public.charges set status = 'paid', paid_at = now() where id = v_cobr;

  select status into v_situacao from public.memberships where id = v_mensal;
  perform pg_temp.exigir_mens(v_situacao = 'paid', 'baixar a cobranca quita a mensalidade');

  -- 3. Dinheiro que entrou nao vira perdao depois.
  update public.charges set status = 'waived' where id = v_cobr;

  select status into v_situacao from public.memberships where id = v_mensal;
  perform pg_temp.exigir_mens(
    v_situacao = 'paid',
    'mensalidade ja paga nao volta a ser perdoada'
  );

  -- 4. Cancelar a cobranca cancela a competencia.
  insert into public.memberships (profile_id, competence, amount_cents, due_date, status)
  values (v_jogador, v_mes - interval '2 months', 2500, current_date - 65, 'pending')
  returning id into v_mensal;

  insert into public.charges (profile_id, membership_id, type, amount_cents, description, idempotency_key)
  values (v_jogador, v_mensal, 'monthly', 2500, 'Mensalidade antiga', 'monthly:sinc:3')
  returning id into v_cobr;

  update public.charges set status = 'cancelled' where id = v_cobr;

  select status into v_situacao from public.memberships where id = v_mensal;
  perform pg_temp.exigir_mens(v_situacao = 'cancelled', 'cancelar a cobranca cancela a mensalidade');

  raise notice '';
end
$$;
