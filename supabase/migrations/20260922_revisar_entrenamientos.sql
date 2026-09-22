-- Para comprobar que la migración de entrenamientos quedó aplicada.
-- No cambia nada.

select 'tabla' as revision,
       case when to_regclass('public.entrenamientos') is null then 'FALTA' else 'ok' end as detalle

union all

select 'rls',
       case when relrowsecurity then 'activada' else 'DESACTIVADA' end
from pg_class
where oid = to_regclass('public.entrenamientos')

union all

select 'politica', policyname || ' (' || array_to_string(roles, ',') || ')'
from pg_policies
where schemaname = 'public' and tablename = 'entrenamientos'

union all

select 'entrenamientos guardados', count(*)::text
from public.entrenamientos

order by 1, 2;
