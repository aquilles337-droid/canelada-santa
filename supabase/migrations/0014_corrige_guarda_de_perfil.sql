-- ============================================================
-- Canelada Santa — corrige o guarda de privilégios do perfil
-- ============================================================
-- O guarda existe para impedir que o JOGADOR promova a si mesmo, saia de um
-- banimento ou vire mensalista editando o próprio perfil. Só que ele exigia
-- que quem faz a alteração fosse um administrador com SESSÃO ABERTA, e isso
-- barrava dois caminhos legítimos que não têm sessão nenhuma:
--
--   • o backend, que usa service_role e já verificou quem é administrador
--     antes de chamar (ver exigirAdmin em src/server/auth/sessao.ts) — por
--     isso Banir, Tornar admin e Tornar mensalista falhavam no painel;
--   • o SQL Editor do Supabase, usado para promover o primeiro
--     administrador, quando ainda não existe nenhum.
--
-- A regra correta é: o guarda vale quando existe um jogador logado por trás
-- da alteração. Sem sessão, a alteração veio do backend ou do console do
-- banco — e o RLS não deixa um visitante anônimo chegar até aqui, porque as
-- políticas de UPDATE em profiles são todas `to authenticated`.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Sem sessão de jogador: backend ou console do banco. Ambos já são
  -- caminhos de confiança, com autorização feita antes de chegar aqui.
  if auth.uid() is null then
    return new;
  end if;

  -- Administrador logado pode alterar o que precisar.
  if public.is_admin() then
    return new;
  end if;

  -- Jogador comum: pode editar o perfil, menos o que define poder.
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
