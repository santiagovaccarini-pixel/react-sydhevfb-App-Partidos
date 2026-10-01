-- Revisión de 20261001_lesiones.sql. No cambia nada: se corre aparte para ver
-- que quedó todo. Cada bloque se puede correr por separado.

-- 1. perfiles tiene la columna lesiones y las tablas nuevas existen con RLS.
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'perfiles' and column_name = 'lesiones';

select relname, relrowsecurity
  from pg_class
 where relname in ('lesiones', 'lesiones_historial');

-- 2. Las políticas: lesiones_acceso_app (todo) y lesiones_historial_leer.
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public' and tablename in ('lesiones', 'lesiones_historial')
 order by tablename, policyname;

-- 3. anon no tiene nada; authenticated lee y escribe lesiones, solo lee el historial.
select grantee, table_name, privilege_type
  from information_schema.table_privileges
 where table_schema = 'public' and table_name in ('lesiones', 'lesiones_historial', 'v_lesiones', 'v_lesiones_excel_v1')
   and grantee in ('anon', 'authenticated')
 order by table_name, grantee, privilege_type;

-- 4. puede_usar('lesiones') existe y las vistas respetan RLS (security_invoker).
select c.relname, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('v_lesiones', 'v_lesiones_excel_v1');

-- 5. Los disparadores: uno de auditoría y uno que anota quién editó.
select event_object_table, trigger_name, event_manipulation
  from information_schema.triggers
 where trigger_name in ('lesiones_anotar_cambio', 'lesiones_historial_anotar')
 order by trigger_name, event_manipulation;

-- 6. Quién tiene Lesiones habilitado.
select email, estado, lesiones, admin from public.perfiles order by creado_en;
