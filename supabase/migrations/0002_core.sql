-- ============================================================
-- Canelada Santa — perfis, convites, configuracoes e temporadas
-- ============================================================

-- Atualiza updated_at em qualquer tabela que tenha a coluna.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
-- O login e feito por telefone + senha. O Supabase Auth guarda um e-mail
-- sintetico derivado do telefone (ver src/lib/phone.ts); o telefone real do
-- jogador vive aqui e e a unica coisa que aparece na interface.
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text not null check (length(btrim(full_name)) between 2 and 80),
  nickname              text check (nickname is null or length(btrim(nickname)) between 1 and 30),
  phone                 text not null unique check (phone ~ '^[0-9]{10,15}$'),
  photo_url             text,
  position              public.player_position not null default 'linha',
  is_goalkeeper         boolean not null default false,
  weight_kg             numeric(5, 2) check (weight_kg is null or weight_kg between 30 and 250),
  height_cm             integer check (height_cm is null or height_cm between 100 and 250),
  role                  public.user_role not null default 'player',
  status                public.member_status not null default 'active',
  -- mensalista
  is_member             boolean not null default false,
  member_since          date,
  joined_at             timestamptz not null default now(),
  banned_at             timestamptz,
  banned_reason         text,
  notifications_enabled boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_banned_has_date check (
    (status = 'banned') = (banned_at is not null)
  )
);

create index profiles_status_idx on public.profiles (status);
create index profiles_is_member_idx on public.profiles (is_member) where is_member;
create index profiles_goalkeeper_idx on public.profiles (is_goalkeeper) where is_goalkeeper;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- settings (linha unica)
-- ------------------------------------------------------------
-- Tudo que o grupo pode querer mudar mora aqui. Nenhum valor financeiro
-- ou de prazo pode ser fixado no codigo.
create table public.settings (
  id                              boolean primary key default true check (id),

  -- valores (sempre em centavos, inteiro — nunca ponto flutuante)
  monthly_fee_cents               integer not null default 2500 check (monthly_fee_cents >= 0),
  casual_price_cents              integer not null default 1000 check (casual_price_cents >= 0),
  guest_of_member_price_cents     integer not null default 500 check (guest_of_member_price_cents >= 0),
  guest_of_casual_price_cents     integer not null default 1000 check (guest_of_casual_price_cents >= 0),

  -- convidados
  allow_casual_guests             boolean not null default false,
  guest_quota_per_member          integer not null default 5 check (guest_quota_per_member >= 0),

  -- multas
  late_cancel_fine_cents          integer not null default 1000 check (late_cancel_fine_cents >= 0),
  no_show_multiplier              numeric(4, 2) not null default 1.5 check (no_show_multiplier >= 0),
  cancel_deadline_hours           integer not null default 2 check (cancel_deadline_hours >= 0),

  -- lista de espera
  waitlist_unlock_hours           integer not null default 5 check (waitlist_unlock_hours >= 0),
  waitlist_accept_minutes         integer not null default 90 check (waitlist_accept_minutes > 0),
  waitlist_accept_minutes_urgent  integer not null default 30 check (waitlist_accept_minutes_urgent > 0),
  waitlist_urgent_threshold_hours integer not null default 3 check (waitlist_urgent_threshold_hours >= 0),
  -- Decisao do grupo: vaga confirmada e definitiva. Ligado, permite que um
  -- mensalista atrasado retome a vaga de um avulso ja promovido.
  member_can_reclaim_slot         boolean not null default false,

  -- padroes da rodada
  default_capacity                integer not null default 20 check (default_capacity > 0),
  default_teams_count             integer not null default 4 check (default_teams_count > 0),
  default_match_minutes           integer not null default 8 check (default_match_minutes > 0),
  default_goals_to_win            integer not null default 2 check (default_goals_to_win > 0),
  default_list_close_hours_before integer not null default 2 check (default_list_close_hours_before >= 0),

  -- avaliacao
  rating_categories               jsonb not null default '[
    {"slug":"bagre","label":"Bagre","min":0,"max":3},
    {"slug":"iniciante","label":"Iniciante","min":3,"max":5},
    {"slug":"regular","label":"Regular","min":5,"max":7},
    {"slug":"bom","label":"Bom","min":7,"max":9},
    {"slug":"craque","label":"Craque","min":9,"max":10}
  ]'::jsonb,
  default_rating                  numeric(3, 1) not null default 5.0 check (default_rating between 0 and 10),
  min_votes_for_rating            integer not null default 3 check (min_votes_for_rating >= 0),

  -- mensalidade e temporada
  monthly_due_day                 integer not null default 10 check (monthly_due_day between 1 and 28),
  season_start_month              integer not null default 1 check (season_start_month between 1 and 12),
  season_start_day                integer not null default 10 check (season_start_day between 1 and 28),

  -- regras gerais
  block_on_debt                   boolean not null default true,
  recurring_card_enabled          boolean not null default false,

  -- pesos do algoritmo de times
  team_weights                    jsonb not null default '{
    "balance": 1.0,
    "size": 0.6,
    "concentration": 0.35,
    "repetition": 0.15,
    "physical": 0.05,
    "repetitionWindow": 4
  }'::jsonb,

  group_name                      text not null default 'Canelada Santa',
  updated_by                      uuid references public.profiles (id) on delete set null,
  updated_at                      timestamptz not null default now()
);

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

insert into public.settings (id) values (true);

-- ------------------------------------------------------------
-- invitations
-- ------------------------------------------------------------
-- Nao existe cadastro publico: so entra quem tem convite valido.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  note        text,
  max_uses    integer not null default 1 check (max_uses > 0),
  uses        integer not null default 0 check (uses >= 0),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint invitations_uses_within_max check (uses <= max_uses)
);

create index invitations_active_idx on public.invitations (code) where revoked_at is null;

-- ------------------------------------------------------------
-- seasons
-- ------------------------------------------------------------
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint seasons_period check (ends_on > starts_on)
);

-- No maximo uma temporada corrente.
create unique index seasons_single_current_idx on public.seasons (is_current) where is_current;
