-- Revisión de 20260930_cuentas.sql. No cambia nada: se corre aparte para ver
-- que quedó todo. Cada bloque se puede correr por separado.

-- 1. La tabla, con RLS prendida, y sus columnas.
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'perfiles'
 order by ordinal_position;

select relname, relrowsecurity
  from pg_class
 where relname in ('perfiles', 'entrenamientos', 'catapult_cuentas');

-- 2. Las políticas: perfiles_leer, perfiles_decidir, y las de Flujo diario
--    pidiendo puede_usar('flujo').
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('perfiles', 'entrenamientos', 'catapult_cuentas')
 order by tablename, policyname;

-- 3. Lo que puede hacer cada rol: anon nada; authenticated select y update
--    solo de estado, partido, flujo y admin.
select grantee, privilege_type, column_name
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'perfiles'
   and grantee in ('anon', 'authenticated')
 order by grantee, privilege_type, column_name;

-- 4. Las funciones, con search_path fijo (security definer).
select p.proname, p.prosecdef, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('es_admin', 'puede_usar', 'perfiles_alta_usuario',
                     'perfiles_sincronizar_usuario', 'perfiles_anotar_decision')
 order by p.proname;

-- 5. Los disparadores: dos sobre auth.users y uno sobre perfiles.
select event_object_schema, event_object_table, trigger_name, event_manipulation
  from information_schema.triggers
 where trigger_name in ('perfiles_alta_usuario', 'perfiles_sincronizar_usuario',
                        'perfiles_anotar_decision')
 order by trigger_name, event_manipulation;

-- 6. Las cuentas: tiene que haber al menos un administrador autorizado.
select email, estado, partido, flujo, admin, confirmado_en, decidido_en
  from public.perfiles
 order by creado_en;

-- 7. Simulación: una cuenta pendiente no ve entrenamientos. Reemplazar el
--    uuid por el user_id de una cuenta pendiente (de la consulta 6 no sale;
--    está en Authentication > Users). Tiene que devolver 0.
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claims', '{"sub":"UUID-DE-UNA-CUENTA-PENDIENTE","role":"authenticated"}', true);
-- select count(*) as entrenamientos_visibles from public.entrenamientos;
-- select public.puede_usar('flujo') as puede_flujo, public.es_admin() as es_admin;
-- rollback;
