-- ============================================================
-- Canelada Santa — times, partidas e eventos
-- ============================================================

create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds (id) on delete cascade,
  idx          smallint not null check (idx > 0),
  name         text not null,
  color        text not null,
  rating_total numeric(6, 2) not null default 0,
  created_at   timestamptz not null default now(),
  constraint teams_unique_idx unique (round_id, idx)
);

create index teams_round_idx on public.teams (round_id, idx);

-- Um integrante de time e um participante (jogador do app) OU um convidado,
-- nunca os dois.
create table public.team_members (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams (id) on delete cascade,
  participant_id   uuid references public.round_participants (id) on delete cascade,
  guest_id         uuid references public.round_guests (id) on delete cascade,
  is_goalkeeper    boolean not null default false,
  rating_snapshot  numeric(3, 1) not null,
  created_at       timestamptz not null default now(),
  constraint team_members_exactly_one_subject check (
    (participant_id is not null)::int + (guest_id is not null)::int = 1
  )
);

create unique index team_members_participant_unique
  on public.team_members (team_id, participant_id) where participant_id is not null;
create unique index team_members_guest_unique
  on public.team_members (team_id, guest_id) where guest_id is not null;
create index team_members_team_idx on public.team_members (team_id);

-- ------------------------------------------------------------
-- matches
-- ------------------------------------------------------------
create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.rounds (id) on delete cascade,
  seq              integer not null check (seq > 0),
  team_a_id        uuid not null references public.teams (id) on delete cascade,
  team_b_id        uuid not null references public.teams (id) on delete cascade,
  score_a          integer not null default 0 check (score_a >= 0),
  score_b          integer not null default 0 check (score_b >= 0),
  status           public.match_status not null default 'scheduled',
  result           public.match_result,
  -- Registro do sorteio quando o empate precisou ser desempatado no sorteio
  -- (regra do time que ganha fica, com apenas uma equipe fora).
  tiebreak         jsonb,
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint matches_unique_seq unique (round_id, seq),
  constraint matches_distinct_teams check (team_a_id <> team_b_id),
  constraint matches_finished_has_result check (status <> 'finished' or result is not null)
);

create index matches_round_idx on public.matches (round_id, seq);

create trigger matches_touch before update on public.matches
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- match_events
-- ------------------------------------------------------------
-- Registrar gol/assistencia e opcional (§33). Se o grupo nao registrar,
-- o sistema nao inventa numero nenhum.
create table public.match_events (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references public.matches (id) on delete cascade,
  kind             public.match_event_kind not null,
  team_id          uuid not null references public.teams (id) on delete cascade,
  participant_id   uuid references public.round_participants (id) on delete set null,
  guest_id         uuid references public.round_guests (id) on delete set null,
  -- assistencia aponta para o gol correspondente
  related_event_id uuid references public.match_events (id) on delete cascade,
  minute           integer check (minute is null or minute >= 0),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint match_events_subject check (
    (participant_id is not null)::int + (guest_id is not null)::int <= 1
  ),
  constraint match_events_assist_has_goal check (
    kind <> 'assist' or related_event_id is not null
  )
);

create index match_events_match_idx on public.match_events (match_id, created_at);
create index match_events_participant_idx on public.match_events (participant_id) where participant_id is not null;
