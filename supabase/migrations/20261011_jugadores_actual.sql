-- =====================================================================
-- Quién está hoy en el plantel (Datos básicos), pedido de Santiago del
-- 03/10: en Datos básicos quedan todos los jugadores que pasaron por el
-- club, y una casilla "Actual" marca los del plantel de hoy.
--
--   · jugadores.actual: true si está hoy en el plantel. Los que ya estaban
--     cargados quedan marcados (como hasta ahora: todos eran del plantel);
--     cada club desmarca a los que ya no están. Los nuevos entran marcados.
--   · Un jugador que se fue no se borra: sus partidos, tareas y lesiones
--     siguen con su nombre.
--
-- Se corre en Supabase > SQL Editor, entero y de una vez. Se puede volver a
-- correr.
-- =====================================================================

begin;

alter table public.jugadores
  add column if not exists actual boolean not null default true;

comment on column public.jugadores.actual is 'Está hoy en el plantel del club (Datos básicos › Actual). Los que se fueron quedan con false: no se borran, sus datos siguen.';

commit;

-- Que la app vea la columna nueva sin esperar.
notify pgrst, 'reload schema';
