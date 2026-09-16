-- ============================================================
-- Canelada Santa — mensalidades, cobrancas, pagamentos e webhooks
-- ============================================================

-- Uma linha por jogador por mes de competencia.
create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  -- sempre o primeiro dia do mes de referencia
  competence   date not null,
  amount_cents integer not null check (amount_cents >= 0),
  due_date     date not null,
  status       public.membership_status not null default 'pending',
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint memberships_unique unique (profile_id, competence),
  constraint memberships_competence_is_month_start check (extract(day from competence) = 1)
);

create index memberships_status_idx on public.memberships (status, due_date);
create index memberships_profile_idx on public.memberships (profile_id, competence desc);

create trigger memberships_touch before update on public.memberships
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- charges
-- ------------------------------------------------------------
-- Toda obrigacao financeira do jogador vira uma cobranca. idempotency_key
-- impede duplicidade na origem: a mesma regra nunca cobra duas vezes.
create table public.charges (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  round_id        uuid references public.rounds (id) on delete set null,
  guest_id        uuid references public.round_guests (id) on delete set null,
  membership_id   uuid references public.memberships (id) on delete set null,
  type            public.charge_type not null,
  -- para multas: 'late_cancel' ou 'no_show'
  subtype         text,
  amount_cents    integer not null check (amount_cents >= 0),
  status          public.charge_status not null default 'pending',
  description     text not null,
  due_date        date,
  idempotency_key text not null unique,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  paid_at         timestamptz,
  constraint charges_paid_has_timestamp check (status <> 'paid' or paid_at is not null),
  constraint charges_monthly_has_membership check (type <> 'monthly' or membership_id is not null),
  constraint charges_guest_has_guest check (type <> 'guest' or guest_id is not null),
  constraint charges_fine_has_subtype check (type <> 'fine' or subtype in ('late_cancel', 'no_show'))
);

create index charges_profile_status_idx on public.charges (profile_id, status);
create index charges_pending_idx on public.charges (profile_id) where status = 'pending';
create index charges_round_idx on public.charges (round_id) where round_id is not null;

create trigger charges_touch before update on public.charges
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
-- Tentativa de pagamento junto ao provedor. provider_payment_id unico faz o
-- webhook repetido virar no-op por constraint, nao por if no codigo.
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  charge_id           uuid not null references public.charges (id) on delete cascade,
  provider            text not null default 'mercadopago',
  provider_payment_id text,
  external_reference  text not null,
  method              text not null default 'pix',
  status              public.payment_status not null default 'pending',
  amount_cents        integer not null check (amount_cents >= 0),
  qr_code             text,
  qr_code_base64      text,
  ticket_url          text,
  expires_at          timestamptz,
  paid_at             timestamptz,
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint payments_provider_id_unique unique (provider, provider_payment_id)
);

create index payments_charge_idx on public.payments (charge_id, created_at desc);
create index payments_external_reference_idx on public.payments (external_reference);
create index payments_open_idx on public.payments (status) where status = 'pending';

create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- webhook_events
-- ------------------------------------------------------------
-- Guarda cada notificacao recebida. A unicidade garante idempotencia mesmo
-- se o Mercado Pago reenviar o mesmo evento varias vezes.
create table public.webhook_events (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null default 'mercadopago',
  provider_event_id  text not null,
  topic              text,
  payload            jsonb not null,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  status             text not null default 'received',
  error              text,
  constraint webhook_events_unique unique (provider, provider_event_id)
);

create index webhook_events_unprocessed_idx on public.webhook_events (received_at)
  where processed_at is null;
