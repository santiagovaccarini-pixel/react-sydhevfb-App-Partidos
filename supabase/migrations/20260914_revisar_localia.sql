-- Para comprobar que la migración de localía quedó aplicada.
-- No cambia nada.

select 'columna' as revision,
       column_name || ' ' || data_type ||
       ' (default ' || coalesce(column_default, 'ninguno') || ')' as detalle
from information_schema.columns
where table_schema = 'public'
  and table_name = 'registros_partido'
  and column_name = 'localia'

union all

select 'restriccion', conname
from pg_constraint
where conrelid = 'public.registros_partido'::regclass
  and conname = 'registros_partido_localia_valida'

union all

select 'partidos sin localia',
       count(*)::text || ' (tienen que ser 0)'
from public.registros_partido
where localia is null

union all

select 'partidos de ' || localia, count(*)::text
from public.registros_partido
group by localia;
