-- Para comprobar que la migración del vínculo con Catapult quedó aplicada.
-- No cambia nada.

select 'columna ' || column_name as revision, data_type as detalle
from information_schema.columns
where table_schema = 'public'
  and table_name = 'jugadores'
  and column_name in ('catapult_id', 'catapult_nombre', 'catapult_vinculado_en')

union all

select 'indice', indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'jugadores'
  and indexname = 'jugadores_catapult_unico_por_equipo'

union all

select 'jugadores vinculados', count(*)::text
from public.jugadores
where catapult_id is not null

union all

select 'jugadores sin vincular', count(*)::text
from public.jugadores
where catapult_id is null

order by 1, 2;
