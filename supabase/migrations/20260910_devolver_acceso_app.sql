-- Devuelve el acceso a la app.
--
-- El 8 de septiembre se aplicó la migración de acceso multiusuario
-- (20260908_zz_auth_multiusuario.sql), que quitó todos los permisos al rol
-- anon, activó RLS y dejó políticas solo para cuentas con sesión iniciada.
--
-- Después se sacó el inicio de sesión de la app, así que hoy se conecta con la
-- clave pública y sin sesión: es el rol anon. Revertir el código no deshace el
-- SQL que ya corrió en la base, así que la tabla quedó inaccesible: las filas
-- se ven en el panel de Supabase —que usa la clave de servicio y saltea RLS—
-- pero la app no puede leerlas ni escribir.
--
-- Esto la deja como estaba antes de aquel intento.

begin;

-- La app se conecta sin sesión: el rol es anon.
grant select, insert, update, delete
  on table public.registros_partido
  to anon, authenticated;

-- Las políticas que quedaron exigen una cuenta con sesión iniciada.
drop policy if exists registros_leer_propios_o_admin on public.registros_partido;
drop policy if exists registros_insertar_propios on public.registros_partido;
drop policy if exists registros_actualizar_propios on public.registros_partido;
drop policy if exists registros_borrar_propios on public.registros_partido;

-- Una sola política de acceso, como antes del intento de multiusuario.
drop policy if exists registros_acceso_app on public.registros_partido;

create policy registros_acceso_app
  on public.registros_partido
  for all
  to anon, authenticated
  using (true)
  with check (true);

commit;

-- Nota sobre la columna owner_id: aquella migración la agregó con
-- "default auth.uid()". Sin sesión queda en null, que es válido, así que no
-- estorba y no se toca para no alterar datos existentes.
--
-- Nota sobre la unicidad: aquella migración reemplazó el índice único global
-- (fecha + rival) por uno por cuenta, que solo aplica cuando owner_id no es
-- null. Sin sesión no hay unicidad en la base; la app igual evita duplicados
-- comparando fecha y rival antes de insertar. Si se quiere volver al índice
-- global, conviene revisar primero que no haya quedado ningún duplicado.
