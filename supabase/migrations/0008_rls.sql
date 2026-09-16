-- ============================================================
-- Canelada Santa — Row Level Security
-- ============================================================
-- Principio: o aplicativo escreve pelo backend (Server Actions e servicos
-- com service role), que valida sessao e papel antes de qualquer alteracao.
-- O RLS aqui e a SEGUNDA barreira: mesmo que alguem use a chave publica
-- direto, nao consegue ler dado financeiro alheio nem escrever nada
-- sensivel. Por isso quase nenhuma tabela aceita INSERT/UPDATE vindo do
-- cliente — apenas leitura controlada.

alter table public.profiles             enable row level security;
alter table public.settings             enable row level security;
alter table public.invitations          enable row level security;
alter table public.seasons              enable row level security;
alter table public.rounds               enable row level security;
alter table public.round_participants   enable row level security;
alter table public.round_guests         enable row level security;
alter table public.teams                enable row level security;
alter table public.team_members         enable row level security;
alter table public.matches              enable row level security;
alter table public.match_events         enable row level security;
alter table public.player_rating_votes  enable row level security;
alter table public.round_votes          enable row level security;
alter table public.memberships          enable row level security;
alter table public.charges              enable row level security;
alter table public.payments             enable row level security;
alter table public.webhook_events       enable row level security;
alter table public.push_subscriptions   enable row level security;
alter table public.notifications        enable row level security;
alter table public.round_photos         enable row level security;
alter table public.achievements         enable row level security;
alter table public.player_achievements  enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.job_runs             enable row level security;

-- ------------------------------------------------------------
-- profiles: o grupo se enxerga (§43). Banido nao le nada.
-- ------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_active_user());

-- O proprio jogador edita o perfil; o trigger guard_profile_privileges
-- bloqueia papel, status e mensalista.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Leitura publica ao grupo, escrita so por administrador
-- ------------------------------------------------------------
create policy settings_select on public.settings
  for select to authenticated using (public.is_active_user());
create policy settings_admin on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy seasons_select on public.seasons
  for select to authenticated using (public.is_active_user());
create policy seasons_admin on public.seasons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy rounds_select on public.rounds
  for select to authenticated using (public.is_active_user());
create policy rounds_admin on public.rounds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy round_participants_select on public.round_participants
  for select to authenticated using (public.is_active_user());
create policy round_participants_admin on public.round_participants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy round_guests_select on public.round_guests
  for select to authenticated using (public.is_active_user());
create policy round_guests_admin on public.round_guests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy teams_select on public.teams
  for select to authenticated using (public.is_active_user());
create policy teams_admin on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy team_members_select on public.team_members
  for select to authenticated using (public.is_active_user());
create policy team_members_admin on public.team_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy matches_select on public.matches
  for select to authenticated using (public.is_active_user());
create policy matches_admin on public.matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy match_events_select on public.match_events
  for select to authenticated using (public.is_active_user());
create policy match_events_admin on public.match_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy round_photos_select on public.round_photos
  for select to authenticated using (public.is_active_user());
create policy round_photos_admin on public.round_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy achievements_select on public.achievements
  for select to authenticated using (public.is_active_user());
create policy achievements_admin on public.achievements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy player_achievements_select on public.player_achievements
  for select to authenticated using (public.is_active_user());
create policy player_achievements_admin on public.player_achievements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Convites nao sao listaveis pelo grupo: a validacao do codigo acontece no
-- backend, com service role, para nao permitir varredura de codigos.
create policy invitations_admin on public.invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Votos: anonimato absoluto
-- ------------------------------------------------------------
-- Cada um so enxerga o proprio voto. Os resultados chegam pelas views
-- agregadas, que nao carregam voter_id.
create policy player_rating_votes_own on public.player_rating_votes
  for select to authenticated using (voter_id = auth.uid());

create policy player_rating_votes_insert on public.player_rating_votes
  for insert to authenticated
  with check (voter_id = auth.uid() and target_id <> auth.uid() and public.is_active_user());

create policy player_rating_votes_update on public.player_rating_votes
  for update to authenticated
  using (voter_id = auth.uid()) with check (voter_id = auth.uid());

create policy round_votes_own on public.round_votes
  for select to authenticated using (voter_id = auth.uid());

create policy round_votes_insert on public.round_votes
  for insert to authenticated
  with check (voter_id = auth.uid() and target_id <> auth.uid() and public.is_active_user());

-- ------------------------------------------------------------
-- Financeiro: cada um ve so o proprio. Ninguem escreve pelo cliente.
-- ------------------------------------------------------------
create policy memberships_own on public.memberships
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy memberships_admin on public.memberships
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy charges_own on public.charges
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy charges_admin on public.charges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy payments_own on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.charges c where c.id = payments.charge_id and c.profile_id = auth.uid())
  );
create policy payments_admin on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- webhook_events, audit_logs e job_runs: apenas administrador le. A escrita
-- e exclusiva do backend com service role.
create policy webhook_events_admin on public.webhook_events
  for select to authenticated using (public.is_admin());
create policy audit_logs_admin on public.audit_logs
  for select to authenticated using (public.is_admin());
create policy job_runs_admin on public.job_runs
  for select to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- Dados pessoais do proprio usuario
-- ------------------------------------------------------------
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy notifications_own_select on public.notifications
  for select to authenticated using (profile_id = auth.uid());
create policy notifications_own_update on public.notifications
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
