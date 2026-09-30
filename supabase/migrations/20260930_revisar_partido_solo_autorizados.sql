-- Revisión de 20260930_partido_solo_autorizados.sql. No cambia nada.

-- 1. Una política por tabla, todas para authenticated, pidiendo
--    puede_usar('partido') (partidos) o esta_autorizado() (el resto).
select tablename, policyname, roles, cmd, qual
  from pg_policies
 where schemaname = 'public'
   and tablename in ('equipos', 'registros_partido', 'jugadores', 'ajustes')
 order by tablename;

-- 2. anon sin permisos sobre las cuatro tablas (tiene que salir vacío).
select table_name, privilege_type
  from information_schema.table_privileges
 where table_schema = 'public'
   and table_name in ('equipos', 'registros_partido', 'jugadores', 'ajustes')
   and grantee = 'anon';

-- 3. Simulación: sin usuario (anon) no se ve ningún partido. Tiene que dar
--    "permission denied" o 0 filas.
-- begin;
-- set local role anon;
-- select count(*) from public.registros_partido;
-- rollback;

-- 4. Simulación: una cuenta autorizada con Partido ve los partidos y los
--    jugadores (reemplazar el uuid por el user_id de tu cuenta, que está en
--    Authentication > Users). Tiene que dar las cantidades reales.
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claims', '{"sub":"TU-USER-ID","role":"authenticated"}', true);
-- select (select count(*) from public.registros_partido) as partidos,
--        (select count(*) from public.jugadores) as jugadores,
--        (select count(*) from public.equipos) as equipos;
-- rollback;
