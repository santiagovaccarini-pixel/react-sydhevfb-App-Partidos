-- Ejecutar una sola vez en Supabase > SQL Editor.
--
-- Vínculo de cada jugador de la lista de la app con su atleta en Catapult
-- OpenField. La lista de jugadores es la misma que usa Partido; acá solo se
-- le agrega qué atleta de Catapult es cada uno, para que los cortes de
-- Entrenamiento lleven a la persona correcta.
--
-- Se vincula una sola vez y queda guardado. Un atleta de Catapult no puede
-- estar vinculado a dos jugadores del mismo equipo.

begin;

alter table public.jugadores
  add column if not exists catapult_id text,
  add column if not exists catapult_nombre text,
  add column if not exists catapult_vinculado_en timestamptz;

comment on column public.jugadores.catapult_id is
  'Id del atleta en Catapult OpenField. Vacío = todavía sin vincular.';
comment on column public.jugadores.catapult_nombre is
  'Nombre del atleta tal como figura en Catapult, para mostrar el vínculo.';

create unique index if not exists jugadores_catapult_unico_por_equipo
  on public.jugadores (equipo_id, catapult_id)
  where catapult_id is not null;

commit;
