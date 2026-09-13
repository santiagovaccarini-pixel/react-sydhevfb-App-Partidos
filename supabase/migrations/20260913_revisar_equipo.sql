-- Para comprobar que la migración del equipo propio quedó aplicada.
-- Se corre en el editor SQL de Supabase; no cambia nada.

-- 1) La tabla existe y tiene el valor inicial.
select clave, valor, actualizado_en
from public.ajustes
where clave = 'equipo_propio';

-- 2) La app (rol anon) puede leerla y escribirla.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'ajustes'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- 3) Y hay una política que se lo permite.
select policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'ajustes';
