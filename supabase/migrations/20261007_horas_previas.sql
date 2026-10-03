-- =====================================================================
-- Las horas de entrenamiento previas de cada jugador (Datos básicos).
--
--   · jugadores.horas_previas: las horas de entrenamiento de antes de que
--     llegara el cuerpo técnico. En el Excel es la columna A de la hoja
--     "Datos Básicos" (sin título, en [h]:mm:ss). Los reportes de Lesiones
--     las suman a las horas del GPS del jugador para las cuentas cada 1000
--     horas. Se guardan en horas (30:14:20 = 30,2389).
--
-- Se corre en Supabase > SQL Editor, entero y de una vez. Se puede volver a
-- correr.
-- =====================================================================

begin;

alter table public.jugadores
  add column if not exists horas_previas numeric;

-- Ni negativas, ni "NaN", ni "Infinity" (numeric los acepta y NaN pasa el >= 0).
alter table public.jugadores drop constraint if exists jugadores_horas_previas_no_negativas;
alter table public.jugadores
  add constraint jugadores_horas_previas_no_negativas check (horas_previas is null or (horas_previas >= 0 and horas_previas < 'Infinity'));

comment on column public.jugadores.horas_previas is 'Horas de entrenamiento de antes de que llegara el cuerpo técnico (Excel: columna A de Datos Básicos). Los reportes de Lesiones las suman a las del GPS.';

commit;
