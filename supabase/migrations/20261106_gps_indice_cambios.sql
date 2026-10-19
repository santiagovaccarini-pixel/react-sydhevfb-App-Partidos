-- =====================================================================
-- GPS: lo cambiado desde la última vez, sin recorrer toda la tabla
-- (Santiago, 19/10: «para solucionar la lentitud con las 15,000+ filas»;
-- en un cuestionario, sobre el índice para «lo que cambió»: «Sí, agregalo»).
--
--   · Cada vez que se abre la Base de GPS con la copia del aparato, la app
--     pide lo cargado o cambiado desde la última vez (ponerAlDiaGps en
--     src/domain/gpsDb.js: del club, desde una fecha de actualizado_en, en
--     orden de actualizado_en e id). No había un índice para eso: la base
--     recorría todas las filas del club (16.103 en la base del club el
--     19/10) para devolver unas pocas, y tardaba de 1,2 a 1,6 s cuando el
--     servidor estaba lento.
--   · gps_por_cambio (equipo_id, actualizado_en, id): se leen solo las filas
--     cambiadas, ya en el orden pedido. Medido en Postgres con 16.000 filas
--     inventadas y las reglas puestas: de 11,3 ms a 1,9 ms, leyendo 130
--     páginas en vez de 3.211.
--   · No cambia quién ve qué: las reglas (RLS) son las mismas; el índice
--     solo cambia cuánto se lee.
--
-- Requiere 20261016_gps.sql. Se corre en Supabase > SQL Editor, entera y de
-- una vez. No cambia ningún dato. Se puede volver a correr. Mientras se crea
-- el índice (menos de un segundo con 16.000 filas) no se puede guardar GPS:
-- mejor correrla cuando nadie está cargando.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null then
    raise exception 'Primero hay que correr 20261016_gps.sql.';
  end if;
end $$;

create index if not exists gps_por_cambio on public.gps (equipo_id, actualizado_en, id);

comment on index public.gps_por_cambio is
  'Lo cargado o cambiado en un club desde una fecha, en orden (ponerAlDiaGps en src/domain/gpsDb.js).';

do $$
begin
  if not exists (
    select 1
      from pg_index i
     where i.indexrelid = 'public.gps_por_cambio'::regclass
       and i.indrelid = 'public.gps'::regclass
       and i.indisvalid
       and i.indpred is null
       and (select array_agg(a.attname::text order by k.orden)
              from unnest(i.indkey::int2[]) with ordinality as k (attnum, orden)
              join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum)
           = array['equipo_id', 'actualizado_en', 'id']) then
    raise exception 'gps_por_cambio no quedó como (equipo_id, actualizado_en, id).';
  end if;
end $$;

commit;
