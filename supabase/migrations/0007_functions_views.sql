-- ============================================================
-- Canelada Santa — funcoes auxiliares e visoes anonimas
-- ============================================================

-- SECURITY DEFINER para nao recursar na politica da propria tabela profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- Impede que um jogador promova a si mesmo, mude o proprio status de
-- banimento ou se transforme em mensalista editando o perfil. Essas colunas
-- so mudam por acao de administrador.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.is_member is distinct from old.is_member
     or new.member_since is distinct from old.member_since
     or new.banned_at is distinct from old.banned_at then
    raise exception 'Alteracao permitida apenas para administradores';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ------------------------------------------------------------
-- Visoes anonimas
-- ------------------------------------------------------------
-- Views comuns rodam com os privilegios do dono (security_invoker = false),
-- entao agregam os votos sem nunca expor a coluna voter_id.

create view public.v_player_rating as
  select
    target_id                      as profile_id,
    count(*)::int                  as votes_count,
    round(avg(score)::numeric, 2)  as avg_score
  from public.player_rating_votes
  group by target_id;

create view public.v_round_vote_tally as
  select
    round_id,
    kind,
    target_id,
    count(*)::int as votes
  from public.round_votes
  group by round_id, kind, target_id;

-- Nota efetiva de cada jogador, ja aplicando o minimo de votos e a nota
-- padrao configurados. E o numero que o algoritmo de times consome.
create view public.v_player_effective_rating as
  select
    p.id                                         as profile_id,
    coalesce(r.votes_count, 0)                   as votes_count,
    case
      when coalesce(r.votes_count, 0) >= s.min_votes_for_rating then r.avg_score
      else s.default_rating
    end                                          as rating,
    coalesce(r.votes_count, 0) >= s.min_votes_for_rating as has_enough_votes
  from public.profiles p
  cross join public.settings s
  left join public.v_player_rating r on r.profile_id = p.id;

grant select on public.v_player_rating to authenticated;
grant select on public.v_round_vote_tally to authenticated;
grant select on public.v_player_effective_rating to authenticated;
