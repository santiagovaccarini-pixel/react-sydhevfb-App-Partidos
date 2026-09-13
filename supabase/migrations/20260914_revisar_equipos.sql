-- Para comprobar que la migración de varios equipos quedó aplicada.
-- No cambia nada.

select 'equipo' as revision, nombre || ' (' || id || ')' as detalle
from public.equipos

union all

select 'partidos sin equipo',
       count(*) || ' (tienen que ser 0)'
from public.registros_partido
where equipo_id is null

union all

select 'jugadores sin equipo',
       count(*) || ' (tienen que ser 0)'
from public.jugadores
where equipo_id is null

union all

select 'partidos de ' || e.nombre, count(r.id)::text
from public.equipos e
left join public.registros_partido r on r.equipo_id = e.id
group by e.nombre

union all

select 'politica', policyname || ' (' || array_to_string(roles, ',') || ')'
from pg_policies
where schemaname = 'public' and tablename = 'equipos'

order by 1, 2;
