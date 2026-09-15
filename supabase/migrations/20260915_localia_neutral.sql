-- La localía suma una tercera opción: cancha neutral.
--
-- Hay partidos que no se juegan ni en nuestra cancha ni en la del rival
-- (finales, sedes únicas), y hasta ahora había que elegir una de las dos.
--
-- Solo se amplía lo que la columna acepta. Nada de lo ya guardado cambia: los
-- partidos siguen siendo locales o visitantes como estaban, y el resultado
-- sigue siendo nuestros goles primero.
--
-- Se puede correr aunque la de 'localia' ya esté aplicada; correrla dos veces
-- tampoco rompe nada.

begin;

-- Por si esta base todavía no pasó por la migración anterior.
alter table public.registros_partido
  add column if not exists localia text not null default 'local';

alter table public.registros_partido
  drop constraint if exists registros_partido_localia_valida;

alter table public.registros_partido
  add constraint registros_partido_localia_valida
  check (localia in ('local', 'visitante', 'neutral'));

commit;
