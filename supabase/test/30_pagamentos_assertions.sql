-- ============================================================
-- Asserções do financeiro
-- ============================================================
-- A garantia mais importante do sistema: webhook repetido nunca cobra,
-- credita ou confirma duas vezes.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.exigir_fin(condicao boolean, label text)
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
  v_jogador     uuid := '0bbbbbbb-0000-0000-0000-000000000001';
  v_mensalidade uuid;
  v_cobranca    uuid;
  v_resultado   public.resultado_confirmacao;
  v_cobranca_row public.charges%rowtype;
  v_pagamento_row public.payments%rowtype;
  v_mensalidade_row public.memberships%rowtype;
begin
  insert into auth.users (id, email) values (v_jogador, 'pagador@teste.test');
  insert into public.profiles (id, full_name, phone, is_member)
  values (v_jogador, 'Pagador Teste', '5582922220001', true);

  insert into public.memberships (profile_id, competence, amount_cents, due_date)
  values (v_jogador, date_trunc('month', current_date)::date, 2500, current_date + 10)
  returning id into v_mensalidade;

  insert into public.charges (profile_id, membership_id, type, amount_cents, description, idempotency_key)
  values (v_jogador, v_mensalidade, 'monthly', 2500, 'Mensalidade de teste', 'monthly:teste:1')
  returning id into v_cobranca;

  insert into public.payments (charge_id, provider_payment_id, external_reference, amount_cents, status)
  values (v_cobranca, 'MP-PAGO-1', 'charge:' || v_cobranca, 2500, 'pending');

  -- Primeira confirmacao: muda tudo.
  v_resultado := public.confirmar_pagamento('mercadopago', 'MP-PAGO-1', 'approved', now(), '{}'::jsonb);
  perform pg_temp.exigir_fin(v_resultado.mudou, 'a primeira confirmacao registra o pagamento');

  select * into v_cobranca_row from public.charges where id = v_cobranca;
  perform pg_temp.exigir_fin(v_cobranca_row.status = 'paid', 'a cobranca fica paga');
  perform pg_temp.exigir_fin(v_cobranca_row.paid_at is not null, 'a cobranca guarda a data do pagamento');

  select * into v_mensalidade_row from public.memberships where id = v_mensalidade;
  perform pg_temp.exigir_fin(v_mensalidade_row.status = 'paid', 'a mensalidade do mes fica quitada junto');

  -- Segunda confirmacao do MESMO evento: nao pode mudar nada.
  v_resultado := public.confirmar_pagamento('mercadopago', 'MP-PAGO-1', 'approved', now(), '{}'::jsonb);
  perform pg_temp.exigir_fin(not v_resultado.mudou, 'o webhook repetido nao confirma de novo');

  perform pg_temp.exigir_fin(
    (select count(*) from public.charges where idempotency_key = 'monthly:teste:1') = 1,
    'a cobranca continua unica depois do webhook repetido'
  );

  -- Webhook de pagamento que nao existe no sistema: ignorado sem quebrar.
  v_resultado := public.confirmar_pagamento('mercadopago', 'MP-INEXISTENTE', 'approved', now(), '{}'::jsonb);
  perform pg_temp.exigir_fin(not v_resultado.mudou, 'notificacao de pagamento desconhecido e ignorada');

  -- Baixa manual antes do webhook: o webhook nao paga duas vezes.
  declare
    v_cobranca2 uuid;
  begin
    insert into public.charges (profile_id, type, amount_cents, description, idempotency_key, status, paid_at)
    values (v_jogador, 'match', 1000, 'Avulso pago na quadra', 'match:teste:2', 'paid', now())
    returning id into v_cobranca2;

    insert into public.payments (charge_id, provider_payment_id, external_reference, amount_cents, status)
    values (v_cobranca2, 'MP-PAGO-2', 'charge:' || v_cobranca2, 1000, 'pending');

    v_resultado := public.confirmar_pagamento('mercadopago', 'MP-PAGO-2', 'approved', now(), '{}'::jsonb);
    perform pg_temp.exigir_fin(
      not v_resultado.mudou,
      'cobranca ja baixada manualmente nao e contada de novo pelo webhook'
    );

    select * into v_pagamento_row from public.payments where provider_payment_id = 'MP-PAGO-2';
    perform pg_temp.exigir_fin(
      v_pagamento_row.status = 'approved',
      'o pagamento e atualizado mesmo quando a cobranca ja estava paga'
    );
  end;

  -- PIX vencido devolve a cobranca para "em aberto".
  declare
    v_cobranca3 uuid;
  begin
    insert into public.charges (profile_id, type, amount_cents, description, idempotency_key)
    values (v_jogador, 'match', 1000, 'Avulso com PIX vencido', 'match:teste:3')
    returning id into v_cobranca3;

    insert into public.payments (charge_id, provider_payment_id, external_reference, amount_cents, status)
    values (v_cobranca3, 'MP-PAGO-3', 'charge:' || v_cobranca3, 1000, 'pending');

    v_resultado := public.confirmar_pagamento('mercadopago', 'MP-PAGO-3', 'cancelled', null, '{}'::jsonb);

    select * into v_cobranca_row from public.charges where id = v_cobranca3;
    perform pg_temp.exigir_fin(
      v_cobranca_row.status = 'pending',
      'PIX cancelado deixa a cobranca em aberto para gerar outro codigo'
    );
  end;

  raise notice '';
end
$$;
