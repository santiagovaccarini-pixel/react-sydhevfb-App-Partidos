-- =====================================================================
-- Lesiones y Evaluaciones, como GPS: el permiso se revisa una vez por pedido
-- y no en cada fila (nota de Santiago del 12/10: «hacer el mismo
-- procedimiento de quitar que se lean los permisos fila por fila dentro de
-- evaluaciones y lesiones como se hizo en gps para poder agilizar el
-- cargado y filtrado de filas»; 14/10: «segui»).
--
--   · Mismo permiso, revisado una vez por pedido: clubes_donde_puedo (de
--     20261019_gps_rapido.sql) da los clubes donde la cuenta tiene el módulo
--     y sigue (puede_usar_en + puede_editar, las mismas funciones de
--     siempre), y las políticas de lesiones y de evaluaciones miran si la
--     fila es de uno de esos clubes. Quién ve, carga, cambia y borra no
--     cambia: lo comprueban los escenarios.
--   · Quien ya se fue sigue leyendo la foto de su último día
--     (datos_al_dia), como antes.
--
-- Requiere 20261019_gps_rapido.sql y 20261012_evaluaciones.sql. Se corre en
-- Supabase > SQL Editor, entera y de una vez. Solo cambia cómo se revisa el
-- permiso. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.clubes_donde_puedo(text)') is null then
    raise exception 'Primero hay que correr 20261019_gps_rapido.sql.';
  end if;
  if to_regclass('public.evaluaciones') is null then
    raise exception 'Primero hay que correr 20261012_evaluaciones.sql.';
  end if;
end $$;

-- ------------------------------------------------------------- Lesiones --

drop policy if exists lesiones_ver on public.lesiones;
create policy lesiones_ver on public.lesiones
  for select to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('lesiones')));

drop policy if exists lesiones_crear on public.lesiones;
create policy lesiones_crear on public.lesiones
  for insert to authenticated
  with check (equipo_id in (select public.clubes_donde_puedo('lesiones')));

drop policy if exists lesiones_cambiar on public.lesiones;
create policy lesiones_cambiar on public.lesiones
  for update to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('lesiones')))
  with check (equipo_id in (select public.clubes_donde_puedo('lesiones')));

drop policy if exists lesiones_borrar on public.lesiones;
create policy lesiones_borrar on public.lesiones
  for delete to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('lesiones')));

-- --------------------------------------------------------- Evaluaciones --

drop policy if exists evaluaciones_ver on public.evaluaciones;
create policy evaluaciones_ver on public.evaluaciones
  for select to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('evaluaciones')));

drop policy if exists evaluaciones_crear on public.evaluaciones;
create policy evaluaciones_crear on public.evaluaciones
  for insert to authenticated
  with check (equipo_id in (select public.clubes_donde_puedo('evaluaciones')));

drop policy if exists evaluaciones_cambiar on public.evaluaciones;
create policy evaluaciones_cambiar on public.evaluaciones
  for update to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('evaluaciones')))
  with check (equipo_id in (select public.clubes_donde_puedo('evaluaciones')));

drop policy if exists evaluaciones_borrar on public.evaluaciones;
create policy evaluaciones_borrar on public.evaluaciones
  for delete to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('evaluaciones')));

commit;

-- Para ver que quedó bien: las ocho políticas con la revisión nueva.
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename in ('lesiones', 'evaluaciones')
   and coalesce(qual, '') || coalesce(with_check, '') like '%clubes_donde_puedo%'
 order by tablename, policyname;
