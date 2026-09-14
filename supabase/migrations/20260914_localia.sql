-- Cada partido guarda si se jugó de local o de visitante.
--
-- Hasta ahora no había forma de saberlo, y en la pantalla siempre íbamos
-- primero. Con esto el partido se puede cargar como visitante, los escudos se
-- dan vuelta y los registros se pueden filtrar por localía.
--
-- Lo ya guardado no se toca: el resultado sigue siendo nuestros goles primero,
-- y todo lo cargado antes queda como local, que es como se venía mostrando.

begin;

alter table public.registros_partido
  add column if not exists localia text not null default 'local';

-- Solo dos valores posibles. Se agrega sin validar lo viejo porque la columna
-- se acaba de crear con el default puesto: no hay nada fuera de rango.
alter table public.registros_partido
  drop constraint if exists registros_partido_localia_valida;

alter table public.registros_partido
  add constraint registros_partido_localia_valida
  check (localia in ('local', 'visitante'));

commit;
