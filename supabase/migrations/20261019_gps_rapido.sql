-- =====================================================================
-- La Base del GPS con muchas fechas no cargaba («No se pudo leer el GPS»,
-- Santiago, 12/10, del 15/01 al 12/10): la base revisaba el permiso de la
-- cuenta en cada fila (puede_usar_en + puede_editar), en cada página de 1000,
-- y con unas 16.000 filas cada página tardaba segundos y se pasaba del tiempo
-- máximo. Medido en una base como la de Supabase: de unos 3 s a 15 ms por
-- página.
--
--   · Mismo permiso, revisado una vez por pedido: clubes_donde_puedo('gps')
--     da los clubes donde la cuenta tiene GPS y sigue (puede_usar_en +
--     puede_editar, las mismas funciones de siempre), y las políticas de la
--     tabla gps miran si la fila es de uno de esos clubes. Quién ve, carga,
--     cambia y borra no cambia: lo comprueban los escenarios.
--   · Quien ya se fue sigue leyendo la foto de su último día
--     (datos_al_dia), como antes.
--
-- Requiere 20261016_gps.sql. Se corre en Supabase > SQL Editor, entera y de
-- una vez. Solo cambia cómo se revisa el permiso. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null then
    raise exception 'Primero hay que correr 20261016_gps.sql.';
  end if;
end $$;

-- Los clubes donde la cuenta tiene el módulo y sigue en el club (puede
-- cargar y cambiar): lo mismo que puede_usar_en(club, módulo) y
-- puede_editar(club) para cada club.
create or replace function public.clubes_donde_puedo(p_modulo text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.equipo_id
    from public.club_miembros m
   where m.user_id = auth.uid()
     and public.puede_usar_en(m.equipo_id, p_modulo)
     and public.puede_editar(m.equipo_id);
$$;

comment on function public.clubes_donde_puedo(text) is
  'Los clubes donde la cuenta tiene el módulo y sigue en el club. Para las políticas: el permiso se revisa una vez por pedido, no en cada fila.';

-- Las políticas lo usan con la cuenta de quien pide: se saca de PUBLIC y se
-- da solo a las cuentas.
revoke execute on function public.clubes_donde_puedo(text) from public, anon;
grant execute on function public.clubes_donde_puedo(text) to authenticated;

drop policy if exists gps_ver on public.gps;
create policy gps_ver on public.gps
  for select to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_crear on public.gps;
create policy gps_crear on public.gps
  for insert to authenticated
  with check (equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_cambiar on public.gps;
create policy gps_cambiar on public.gps
  for update to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('gps')))
  with check (equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_borrar on public.gps;
create policy gps_borrar on public.gps
  for delete to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('gps')));

commit;

-- Para ver que quedó bien: las cuatro políticas con la revisión nueva.
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'gps'
   and coalesce(qual, '') || coalesce(with_check, '') like '%clubes_donde_puedo%'
 order by policyname;
