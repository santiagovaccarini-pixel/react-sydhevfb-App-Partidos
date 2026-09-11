-- Diagnóstico, solo lectura: no cambia nada.
-- Sirve para confirmar que la migración de jugadores quedó bien aplicada.

-- 1) ¿Existe la tabla y cuántos jugadores tiene?
select count(*) as jugadores_cargados
from public.jugadores;

-- 2) ¿Puede la app entrar? Si acá no aparece el rol anon con sus permisos,
--    la app no va a poder leer ni escribir, igual que pasó en septiembre.
select
  grantee as rol,
  privilege_type as permiso
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'jugadores'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- 3) ¿Qué política quedó?
select
  policyname as politica,
  cmd as operacion,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'jugadores';

-- 4) ¿Se agregó la columna de la cancha en los registros?
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'registros_partido'
  and column_name = 'formacion_cancha';
