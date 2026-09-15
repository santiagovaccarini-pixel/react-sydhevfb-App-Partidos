-- Para comprobar que la cancha neutral quedó habilitada.
-- No cambia nada.

select 'restriccion' as revision,
       pg_get_constraintdef(oid) as detalle
from pg_constraint
where conrelid = 'public.registros_partido'::regclass
  and conname = 'registros_partido_localia_valida'

union all

select 'partidos de ' || localia, count(*)::text
from public.registros_partido
group by localia;
