-- Reproduz localmente o minimo do Supabase que as migrations dependem:
-- o schema auth, a tabela auth.users e a funcao auth.uid(), alem das roles
-- anon/authenticated/service_role. Este arquivo NAO vai para producao.
create schema if not exists auth;

create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Stub do Supabase Storage
-- ------------------------------------------------------------
-- A migration das fotos cria baldes e uma politica de leitura. Localmente
-- reproduzimos so o suficiente para a migration rodar igual.
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- O Supabase de verdade PROIBE apagar linha de storage.objects por SQL: um
-- gatilho manda usar a Storage API, para o arquivo nunca ficar orfao no
-- disco depois que a linha some. O stub reproduz isso — sem o gatilho aqui,
-- um script que roda limpo na maquina quebra no painel do Supabase, que foi
-- exatamente o que aconteceu.
create or replace function storage.protect_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
    using errcode = '42501',
          hint    = 'This prevents accidental data loss from orphaned objects.';
end;
$$;

create trigger protect_delete_objects
  before delete on storage.objects
  for each row execute function storage.protect_delete();
