-- Ejecutar una sola vez en Supabase > SQL Editor.
--
-- Cuenta de Catapult OpenField de cada usuario de la app, para que la app
-- entre sola a escribir cortes sin pedir la contraseña cada vez.
--
-- La contraseña y el pase de sesión se guardan CIFRADOS con una clave que vive
-- solo en Vercel (CATAPULT_SESSION_KEY). Leer la tabla no sirve para
-- recuperarlos. El nombre de usuario queda en claro para mostrar "conectado
-- como" en Ajustes.
--
-- Cada persona tiene su propia cuenta de Catapult: la fila es por usuario de
-- la app (auth.users) y solo ese usuario puede verla, cambiarla o borrarla.

begin;

-- Freno: sobre una base que ya tiene las cuentas (20260930_cuentas.sql) esto
-- volvería a abrir lo que se cerró después (permisos para anon, políticas
-- que dejan ver todo). Ya no hace falta correrla.
do $$
begin
  if to_regclass('public.perfiles') is not null then
    raise exception 'Ya está corrida 20260930_cuentas.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

create table if not exists public.catapult_cuentas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null,
  secreto text not null,
  pase_secreto text,
  pase_expira timestamptz,
  verificado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.catapult_cuentas is
  'Cuenta de Catapult OpenField por usuario de la app. Contraseña y pase cifrados con CATAPULT_SESSION_KEY.';
comment on column public.catapult_cuentas.secreto is
  'Contraseña de Catapult cifrada (AES-256-GCM). Ilegible sin la clave de Vercel.';
comment on column public.catapult_cuentas.pase_secreto is
  'Último pase (access token) de Catapult, cifrado, para reutilizarlo mientras dure.';

alter table public.catapult_cuentas enable row level security;

grant select, insert, update, delete on table public.catapult_cuentas to authenticated;

drop policy if exists catapult_cuentas_propia on public.catapult_cuentas;

create policy catapult_cuentas_propia
  on public.catapult_cuentas
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
