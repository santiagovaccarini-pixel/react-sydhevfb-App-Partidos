-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Conserva la guía visual de Transmisión mientras las columnas históricas guardan HH:MM:SS.

alter table public.registros_partido
  add column if not exists guia_transmision jsonb not null default '{}'::jsonb;

comment on column public.registros_partido.guia_transmision is
  'Minutos visuales, período de cada cambio y horas internas de inicio usadas para convertir a HH:MM:SS.';
