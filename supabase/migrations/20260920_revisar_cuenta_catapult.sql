-- Para comprobar que la migración de la cuenta de Catapult quedó aplicada.
-- No cambia nada y no muestra ningún secreto.

select 'tabla' as revision,
       case when to_regclass('public.catapult_cuentas') is null then 'FALTA' else 'ok' end as detalle

union all

select 'rls',
       case when relrowsecurity then 'activada' else 'DESACTIVADA' end
from pg_class
where oid = to_regclass('public.catapult_cuentas')

union all

select 'politica', policyname || ' (' || array_to_string(roles, ',') || ')'
from pg_policies
where schemaname = 'public' and tablename = 'catapult_cuentas'

union all

select 'cuentas cargadas', count(*)::text
from public.catapult_cuentas

order by 1, 2;
