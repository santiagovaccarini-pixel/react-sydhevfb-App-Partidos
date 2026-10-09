-- Lo mínimo de Supabase que las migraciones dan por sentado, para correrlas
-- en un Postgres pelado: los roles anon/authenticated, el esquema auth con
-- la tabla de usuarios y auth.uid(), el esquema extensions y los permisos
-- por defecto que Supabase le da a toda tabla nueva.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Quién consulta: el "sub" del JWT, que en las pruebas se pone a mano con
-- set_config('request.jwt.claims', '{"sub": "..."}', false).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

grant usage on schema public, auth, extensions to anon, authenticated;
grant select on auth.users to supabase_auth_admin;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter database pruebas set search_path = public, extensions;

-- El dueño de la plataforma de las pruebas: la migración de cuentas lo pide
-- con correo (en producción se completa a mano antes de correrla). La de
-- dueños (20261014) pide además los sub-dueños: subduenia entra como
-- sub-dueña; otro queda para sumarlo y quitarlo en los escenarios.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-0000000000d1', 'duenio@prueba.com', now()),
       ('00000000-0000-0000-0000-0000000000d2', 'subduenia@prueba.com', now()),
       ('00000000-0000-0000-0000-0000000000d3', 'otro@prueba.com', now())
on conflict (id) do nothing;
