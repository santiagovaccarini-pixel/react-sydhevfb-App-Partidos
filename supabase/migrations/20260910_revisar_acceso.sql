-- Diagnóstico, solo lectura: no cambia nada.
-- Sirve para confirmar por qué la app no ve las filas antes de tocar la base.

-- 1) ¿Está activada la seguridad por fila?
select
  relname as tabla,
  relrowsecurity as rls_activada,
  relforcerowsecurity as rls_forzada
from pg_class
where relname = 'registros_partido';

-- 2) ¿Qué políticas hay y para qué roles?
--    Si todas dicen {authenticated}, la app —que entra sin sesión— no pasa.
select
  policyname as politica,
  cmd as operacion,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'registros_partido'
order by policyname;

-- 3) ¿Qué permisos tiene el rol anon sobre la tabla?
--    Si no aparece ninguna fila, la app no tiene acceso a nada.
select
  grantee as rol,
  privilege_type as permiso
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'registros_partido'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- 4) Cuántas filas hay de verdad (esta consulta corre con la clave de
--    servicio del panel, así que ve todo aunque la app no vea nada).
select count(*) as partidos_guardados
from public.registros_partido;
