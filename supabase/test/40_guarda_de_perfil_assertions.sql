-- ============================================================
-- Asserções do guarda de privilégios do perfil
-- ============================================================
-- O guarda barrava o backend e o SQL Editor junto com o jogador comum, o que
-- deixava o painel administrativo sem conseguir banir, promover ou marcar
-- mensalista. Estas asserções fixam os três caminhos.

\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.exigir_guarda(condicao boolean, label text)
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
  v_admin   uuid := '0ccccccc-0000-0000-0000-000000000001';
  v_jogador uuid := '0ccccccc-0000-0000-0000-000000000002';
  v_alvo    uuid := '0ccccccc-0000-0000-0000-000000000003';
  v_papel   public.user_role;
begin
  insert into auth.users (id, email) values
    (v_admin, 'admin@guarda.test'), (v_jogador, 'jogador@guarda.test'), (v_alvo, 'alvo@guarda.test');

  insert into public.profiles (id, full_name, phone, role) values
    (v_admin,   'Admin Guarda',   '5582933330001', 'admin'),
    (v_jogador, 'Jogador Guarda', '5582933330002', 'player'),
    (v_alvo,    'Alvo Guarda',    '5582933330003', 'player');

  -- 1. Sem sessao (backend com service_role, ou SQL Editor): pode promover.
  perform set_config('request.jwt.claim.sub', '', true);
  update public.profiles set role = 'admin' where id = v_alvo;

  select role into v_papel from public.profiles where id = v_alvo;
  perform pg_temp.exigir_guarda(
    v_papel = 'admin',
    'sem sessao (backend e SQL Editor) a promocao passa'
  );

  update public.profiles set role = 'player' where id = v_alvo;

  -- 2. Administrador logado: pode alterar.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  update public.profiles set is_member = true where id = v_alvo;

  perform pg_temp.exigir_guarda(
    (select is_member from public.profiles where id = v_alvo),
    'administrador logado pode marcar mensalista'
  );

  -- 3. Jogador comum: NAO pode se promover.
  perform set_config('request.jwt.claim.sub', v_jogador::text, true);
  begin
    update public.profiles set role = 'admin' where id = v_jogador;
    raise exception 'FALHOU: jogador comum conseguiu se promover a administrador';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice '  ok  jogador comum nao se promove a administrador';
  end;

  -- 4. Jogador comum: NAO pode sair de um banimento nem virar mensalista.
  -- Banimos pelo caminho do backend (sem sessao) para haver o que desfazer:
  -- sem mudanca real de valor nao existe privilegio a proteger.
  perform set_config('request.jwt.claim.sub', '', true);
  update public.profiles
  set status = 'banned', banned_at = now()
  where id = v_jogador;

  perform set_config('request.jwt.claim.sub', v_jogador::text, true);

  begin
    update public.profiles set status = 'active', banned_at = null where id = v_jogador;
    raise exception 'FALHOU: jogador comum conseguiu mudar a propria situacao';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice '  ok  jogador comum nao muda a propria situacao';
  end;

  begin
    update public.profiles set is_member = true where id = v_jogador;
    raise exception 'FALHOU: jogador comum conseguiu virar mensalista sozinho';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    raise notice '  ok  jogador comum nao vira mensalista sozinho';
  end;

  -- 5. Jogador comum CONTINUA editando o proprio perfil normalmente.
  update public.profiles set full_name = 'Jogador Guarda Editado' where id = v_jogador;
  perform pg_temp.exigir_guarda(
    (select full_name from public.profiles where id = v_jogador) = 'Jogador Guarda Editado',
    'jogador comum continua editando o proprio perfil'
  );

  perform set_config('request.jwt.claim.sub', '', true);
  raise notice '';
end
$$;
