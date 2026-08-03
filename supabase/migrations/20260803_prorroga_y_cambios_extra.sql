-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Agrega almacenamiento flexible para prórroga y cambios posteriores al quinto.

alter table public.registros_partido
  add column if not exists prorroga jsonb not null default '{}'::jsonb,
  add column if not exists cambios_extra jsonb not null default '[]'::jsonb,
  add column if not exists cambios_rival_extra jsonb not null default '[]'::jsonb;

comment on column public.registros_partido.prorroga is
  'Datos de los dos tiempos de prórroga, VAR e hidrataciones.';
comment on column public.registros_partido.cambios_extra is
  'Cambios de Atlético Mineiro posteriores al quinto.';
comment on column public.registros_partido.cambios_rival_extra is
  'Cambios del rival posteriores al quinto.';
