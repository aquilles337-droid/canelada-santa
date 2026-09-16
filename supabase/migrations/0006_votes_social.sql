-- ============================================================
-- Canelada Santa — avaliacoes, votacoes, notificacoes e auditoria
-- ============================================================

-- Nota de nivel do jogador (0 a 10). Voto anonimo: quem votou nunca e
-- exposto na interface. O jogador nao pode votar em si mesmo.
create table public.player_rating_votes (
  id         uuid primary key default gen_random_uuid(),
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  score      numeric(3, 1) not null check (score between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_rating_votes_unique unique (voter_id, target_id),
  constraint player_rating_votes_no_self check (voter_id <> target_id)
);

create index player_rating_votes_target_idx on public.player_rating_votes (target_id);

create trigger player_rating_votes_touch before update on public.player_rating_votes
  for each row execute function public.touch_updated_at();

-- Craque e bagre da rodada. So participantes votam, e nunca em si mesmos.
create table public.round_votes (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.rounds (id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  kind       public.vote_kind not null,
  created_at timestamptz not null default now(),
  constraint round_votes_unique unique (round_id, voter_id, kind),
  constraint round_votes_no_self check (voter_id <> target_id)
);

create index round_votes_tally_idx on public.round_votes (round_id, kind, target_id);

-- ------------------------------------------------------------
-- notificacoes
-- ------------------------------------------------------------
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  enabled         boolean not null default true,
  failure_count   integer not null default 0,
  last_success_at timestamptz,
  created_at      timestamptz not null default now()
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id) where enabled;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  url        text,
  data       jsonb,
  read_at    timestamptz,
  pushed_at  timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx on public.notifications (profile_id) where read_at is null;

-- ------------------------------------------------------------
-- fotos, conquistas, auditoria e tarefas agendadas
-- ------------------------------------------------------------
create table public.round_photos (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds (id) on delete cascade,
  storage_path text not null unique,
  caption      text,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index round_photos_round_idx on public.round_photos (round_id, created_at);

create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null,
  icon        text not null default '🏅',
  created_at  timestamptz not null default now()
);

create table public.player_achievements (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  season_id      uuid references public.seasons (id) on delete set null,
  round_id       uuid references public.rounds (id) on delete set null,
  awarded_at     timestamptz not null default now(),
  constraint player_achievements_unique unique (profile_id, achievement_id, season_id)
);

-- Toda acao administrativa relevante deixa rastro.
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- Execucoes do cron, para o administrador conseguir ver que as tarefas rodaram.
create table public.job_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,
  status      public.job_status not null default 'running',
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  result      jsonb,
  error       text
);

create index job_runs_recent_idx on public.job_runs (job, started_at desc);
