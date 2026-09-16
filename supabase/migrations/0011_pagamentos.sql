-- ============================================================
-- Canelada Santa — confirmacao de pagamento
-- ============================================================
-- A confirmacao mexe em tres lugares (pagamento, cobranca e, quando for
-- mensalidade, a competencia do mes). Fazer isso em chamadas separadas
-- abriria espaco para um webhook repetido pegar o sistema no meio do
-- caminho. Aqui tudo acontece numa transacao so, e a funcao avisa se ela
-- realmente mudou alguma coisa — assim o sistema so envia a notificacao de
-- "pagamento confirmado" na primeira vez.

create type public.resultado_confirmacao as (
  mudou            boolean,
  charge_id        uuid,
  profile_id       uuid,
  amount_cents     integer,
  descricao        text
);

create or replace function public.confirmar_pagamento(
  p_provider            text,
  p_provider_payment_id text,
  p_status              public.payment_status,
  p_paid_at             timestamptz,
  p_raw                 jsonb
)
returns public.resultado_confirmacao
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pagamento public.payments%rowtype;
  v_cobranca  public.charges%rowtype;
  v_saida     public.resultado_confirmacao;
begin
  select * into v_pagamento
  from public.payments
  where provider = p_provider and provider_payment_id = p_provider_payment_id
  for update;

  if not found then
    v_saida := (false, null, null, null, null);
    return v_saida;
  end if;

  select * into v_cobranca from public.charges where id = v_pagamento.charge_id for update;

  -- Ja estava no mesmo estado: nada a fazer. E o caso do webhook repetido.
  if v_pagamento.status = p_status and (p_status <> 'approved' or v_cobranca.status = 'paid') then
    v_saida := (false, v_cobranca.id, v_cobranca.profile_id, v_cobranca.amount_cents, v_cobranca.description);
    return v_saida;
  end if;

  update public.payments
  set status  = p_status,
      paid_at = case when p_status = 'approved' then coalesce(p_paid_at, now()) else null end,
      raw     = coalesce(p_raw, raw)
  where id = v_pagamento.id;

  if p_status = 'approved' then
    -- Cobranca ja paga por outro caminho (baixa manual, por exemplo) nao e
    -- paga de novo: o dinheiro nunca e contado duas vezes.
    if v_cobranca.status <> 'paid' then
      update public.charges
      set status = 'paid', paid_at = coalesce(p_paid_at, now())
      where id = v_cobranca.id;

      if v_cobranca.membership_id is not null then
        update public.memberships
        set status = 'paid', paid_at = coalesce(p_paid_at, now())
        where id = v_cobranca.membership_id;
      end if;

      v_saida := (true, v_cobranca.id, v_cobranca.profile_id, v_cobranca.amount_cents, v_cobranca.description);
      return v_saida;
    end if;
  elsif p_status in ('cancelled', 'rejected', 'expired') then
    -- O PIX venceu ou foi recusado: a cobranca volta a ficar em aberto para
    -- a pessoa poder gerar outro codigo.
    if v_cobranca.status = 'pending' then
      update public.charges set status = 'pending' where id = v_cobranca.id;
    end if;
  end if;

  v_saida := (false, v_cobranca.id, v_cobranca.profile_id, v_cobranca.amount_cents, v_cobranca.description);
  return v_saida;
end;
$$;

revoke all on function public.confirmar_pagamento(text, text, public.payment_status, timestamptz, jsonb)
  from public, anon, authenticated;
