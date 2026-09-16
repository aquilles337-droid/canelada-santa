-- ============================================================
-- Canelada Santa — rodadas, presenca, lista de espera e convidados
-- ============================================================

-- Cada rodada e criada manualmente pelo administrador e guarda um SNAPSHOT
-- dos precos, multas e prazos vigentes na criacao. Mudar as configuracoes
-- depois nunca altera uma rodada que ja existe.
create table public.rounds (
  id                    uuid primary key default gen_random_uuid(),
  season_id             uuid not null references public.seasons (id) on delete restrict,
  number                integer not null check (number > 0),
  title                 text,

  starts_at             timestamptz not null,
  venue                 text not null check (length(btrim(venue)) > 0),
  address               text,

  capacity              integer not null check (capacity > 0),
  teams_count           integer not null check (teams_count > 0),
  players_per_team      integer check (players_per_team is null or players_per_team > 0),
  match_minutes         integer not null check (match_minutes > 0),
  goals_to_win          integer not null check (goals_to_win > 0),

  list_opens_at         timestamptz not null default now(),
  list_closes_at        timestamptz not null,
  -- Momento em que avulsos passam a poder ocupar as vagas que sobraram.
  waitlist_unlock_at    timestamptz not null,
  cancel_deadline_hours integer not null check (cancel_deadline_hours >= 0),

  -- snapshots imutaveis
  pricing               jsonb not null,
  fine_rules            jsonb not null,
  rules                 text,

  status                public.round_status not null default 'draft',
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  closed_at             timestamptz,
  finished_at           timestamptz,

  constraint rounds_number_unique unique (season_id, number),
  constraint rounds_list_closes_before_start check (list_closes_at <= starts_at),
  constraint rounds_list_window check (list_opens_at < list_closes_at),
  constraint rounds_unlock_before_start check (waitlist_unlock_at <= starts_at)
);

create index rounds_starts_at_idx on public.rounds (starts_at desc);
create index rounds_status_idx on public.rounds (status);
create index rounds_season_idx on public.rounds (season_id, number desc);

create trigger rounds_touch before update on public.rounds
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- round_participants
-- ------------------------------------------------------------
-- A fila e ordenada por (priority_tier, joined_at): mensalista (0) antes de
-- avulso (1) e, dentro da mesma faixa, quem confirmou primeiro. Assiduidade
-- NUNCA entra nesse criterio.
create table public.round_participants (
  id                   uuid primary key default gen_random_uuid(),
  round_id             uuid not null references public.rounds (id) on delete cascade,
  profile_id           uuid not null references public.profiles (id) on delete cascade,

  kind                 public.participant_kind not null,
  priority_tier        smallint not null check (priority_tier in (0, 1)),
  status               public.participation_status not null,

  joined_at            timestamptz not null default now(),
  confirmed_at         timestamptz,
  invited_at           timestamptz,
  invite_expires_at    timestamptz,
  cancelled_at         timestamptz,
  cancel_was_late      boolean not null default false,

  attendance           public.attendance_status not null default 'pending',
  absence_justified    boolean,
  absence_note         text,
  attendance_marked_by uuid references public.profiles (id) on delete set null,
  attendance_marked_at timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint round_participants_unique unique (round_id, profile_id),
  constraint round_participants_tier_matches_kind check (
    (kind = 'monthly' and priority_tier = 0) or (kind = 'casual' and priority_tier = 1)
  ),
  constraint round_participants_confirmed_has_timestamp check (
    status <> 'confirmed' or confirmed_at is not null
  ),
  constraint round_participants_invited_has_deadline check (
    status <> 'invited' or invite_expires_at is not null
  ),
  -- Justificativa so existe para quem faltou.
  constraint round_participants_justification_requires_absence check (
    absence_justified is null or attendance = 'absent'
  )
);

-- Indice que serve a consulta mais quente do sistema: a proxima pessoa da fila.
create index round_participants_queue_idx
  on public.round_participants (round_id, priority_tier, joined_at)
  where status in ('waiting', 'invited');

create index round_participants_confirmed_idx
  on public.round_participants (round_id)
  where status = 'confirmed';

create index round_participants_profile_idx on public.round_participants (profile_id, round_id);

create index round_participants_invite_expiry_idx
  on public.round_participants (invite_expires_at)
  where status = 'invited';

create trigger round_participants_touch before update on public.round_participants
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- round_guests
-- ------------------------------------------------------------
-- Convidado NAO e usuario do sistema: nao tem conta, nao entra no ranking.
-- Fica preso ao mensalista que o levou (host), que gasta uma cota do mes.
create table public.round_guests (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references public.rounds (id) on delete cascade,
  host_profile_id uuid not null references public.profiles (id) on delete cascade,
  name            text not null check (length(btrim(name)) between 2 and 60),
  skill_level     numeric(3, 1) not null check (skill_level between 0 and 10),
  status          public.guest_status not null default 'waiting',
  attendance      public.attendance_status not null default 'pending',
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  constraint round_guests_unique_name unique (round_id, host_profile_id, name)
);

create index round_guests_round_idx on public.round_guests (round_id, status);
create index round_guests_host_idx on public.round_guests (host_profile_id, created_at);

create trigger round_guests_touch before update on public.round_guests
  for each row execute function public.touch_updated_at();
