-- =====================================================================
-- Quién está en cada club, y hasta cuándo.
--
--   · club_miembros: una fila por cuenta y club. `hasta` vacío = sigue en
--     el club; con fecha = ese fue su último día (inclusive). Quien se fue
--     sigue viendo lo cargado hasta ese día (partidos, entrenamientos,
--     lesiones, jugadores), sin poder agregar ni cambiar nada. Lo decide
--     el administrador desde Cuentas; quien crea un club queda adentro solo.
--   · Las políticas de todas las tablas pasan a mirar la membresía además
--     del módulo: ver = estar o haber estado en el club y que la fecha de
--     la fila no pase el último día; cambiar = estar en el club hoy. La
--     vista v_lesiones_excel_v1 (Power Query) respeta lo mismo.
--   · v_mis_clubes: los clubes de quien consulta, con su desde y hasta.
--
-- Todas las cuentas autorizadas quedan adentro de todos los clubes que ya
-- existen: nada deja de verse al correrlo. Se corre en Supabase > SQL
-- Editor, entero y de una vez. Se puede volver a correr.
-- =====================================================================

begin;

-- ------------------------------------------------------------ La tabla --

create table if not exists public.club_miembros (
  equipo_id    uuid not null references public.equipos (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  desde        date not null default current_date,
  hasta        date,
  decidido_por uuid references auth.users (id) on delete set null,
  decidido_en  timestamptz not null default now(),
  creado_en    timestamptz not null default now(),
  primary key (equipo_id, user_id)
);

comment on table public.club_miembros is
  'Quién está (o estuvo) en cada club. hasta vacío = sigue; con fecha = último día en el club, inclusive.';
comment on column public.club_miembros.hasta is
  'Último día en el club (inclusive). Vacío mientras sigue. Quien se fue ve lo cargado hasta ese día y no cambia nada.';

create index if not exists club_miembros_por_usuario on public.club_miembros (user_id);

-- Quién decidió, anotado por la base (nunca por la app).
create or replace function public.club_miembros_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.decidido_por := auth.uid();
  new.decidido_en := now();
  return new;
end;
$$;

drop trigger if exists club_miembros_anotar on public.club_miembros;
create trigger club_miembros_anotar
  before insert or update on public.club_miembros
  for each row execute function public.club_miembros_anotar();

-- Quien crea un club queda adentro.
create or replace function public.equipos_sumar_creador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.club_miembros (equipo_id, user_id)
    values (new.id, auth.uid())
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists equipos_sumar_creador on public.equipos;
create trigger equipos_sumar_creador
  after insert on public.equipos
  for each row execute function public.equipos_sumar_creador();

-- ---------------------------------------------------- Hasta cuándo ve --

-- Hasta qué día ve este club quien consulta: nada si no está ni estuvo (o
-- no está autorizado), infinito si sigue en el club, o su último día.
create or replace function public.acceso_club(p_equipo uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_equipo is null or not public.esta_autorizado() then null
    else (select coalesce(m.hasta, 'infinity'::date)
            from public.club_miembros m
           where m.equipo_id = p_equipo and m.user_id = auth.uid())
  end;
$$;

-- Ve el club: está o estuvo.
create or replace function public.puede_ver(p_equipo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.acceso_club(p_equipo) is not null;
$$;

-- Ve una fila con fecha: hasta su último día. Una fila sin fecha solo la ve
-- quien sigue en el club.
create or replace function public.puede_ver_fecha(p_equipo uuid, p_fecha date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(coalesce(p_fecha, 'infinity'::date) <= public.acceso_club(p_equipo), false);
$$;

-- Cambia cosas: sigue en el club.
create or replace function public.puede_editar(p_equipo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.acceso_club(p_equipo) = 'infinity'::date, false);
$$;

-- Una fecha guardada como texto ("2026-09-20"), o nada si no se entiende.
create or replace function public.fecha_segura(p_texto text)
returns date
language plpgsql
immutable
as $$
begin
  return p_texto::date;
exception when others then
  return null;
end;
$$;

revoke execute on function public.acceso_club(uuid), public.puede_ver(uuid), public.puede_ver_fecha(uuid, date), public.puede_editar(uuid), public.fecha_segura(text) from public, anon;
grant execute on function public.acceso_club(uuid), public.puede_ver(uuid), public.puede_ver_fecha(uuid, date), public.puede_editar(uuid), public.fecha_segura(text) to authenticated;

-- ------------------------------------------------------------ La vista --

drop view if exists public.v_mis_clubes;
create view public.v_mis_clubes
with (security_invoker = true)
as
select e.id, e.nombre, e.creado_en, m.desde, m.hasta
  from public.equipos e
  left join public.club_miembros m
    on m.equipo_id = e.id and m.user_id = auth.uid()
 order by e.nombre;

revoke all on public.v_mis_clubes from anon;
grant select on public.v_mis_clubes to authenticated;

-- ------------------------------------------- Las cuentas que ya están --

-- Solo la primera vez (con la tabla vacía): volver a correr esto después no
-- puede meter a todas las cuentas en todos los clubes.
insert into public.club_miembros (equipo_id, user_id, desde)
select e.id, p.user_id, greatest(e.creado_en, p.creado_en)::date
  from public.equipos e
 cross join public.perfiles p
 where p.estado = 'autorizado'
   and not exists (select 1 from public.club_miembros)
on conflict do nothing;

-- ------------------------------------------------------------ Permisos --

alter table public.club_miembros enable row level security;
revoke all on table public.club_miembros from anon, authenticated;
grant select, insert, update, delete on table public.club_miembros to authenticated;

-- Se sacan todas las políticas que hubiera en estas tablas: las nuevas
-- miran la membresía además del módulo.
do $$
declare
  politica record;
begin
  for politica in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('club_miembros', 'equipos', 'registros_partido', 'jugadores', 'ajustes',
                         'entrenamientos', 'lesiones', 'lesiones_historial', 'lesiones_campos', 'lesiones_opciones')
  loop
    execute format('drop policy if exists %I on %I.%I', politica.policyname, politica.schemaname, politica.tablename);
  end loop;
end $$;

-- Cada uno ve sus membresías; el administrador las ve y las decide todas.
create policy club_miembros_leer on public.club_miembros
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));

create policy club_miembros_decidir on public.club_miembros
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- Clubes: se ven los propios (el administrador, todos); cualquiera
-- autorizado crea uno (y queda adentro); se renombra desde adentro.
create policy equipos_ver on public.equipos
  for select to authenticated
  using ((select public.es_admin()) or public.puede_ver(id));

create policy equipos_crear on public.equipos
  for insert to authenticated
  with check ((select public.esta_autorizado()));

create policy equipos_cambiar on public.equipos
  for update to authenticated
  using (public.puede_editar(id))
  with check (public.puede_editar(id));

create policy equipos_borrar on public.equipos
  for delete to authenticated
  using ((select public.es_admin()));

-- Partido: los partidos hasta el último día; se cargan desde adentro.
create policy registros_ver on public.registros_partido
  for select to authenticated
  using ((select public.puede_usar('partido')) and public.puede_ver_fecha(equipo_id, public.fecha_segura(fecha::text)));

create policy registros_crear on public.registros_partido
  for insert to authenticated
  with check ((select public.puede_usar('partido')) and public.puede_editar(equipo_id));

create policy registros_cambiar on public.registros_partido
  for update to authenticated
  using ((select public.puede_usar('partido')) and public.puede_editar(equipo_id))
  with check ((select public.puede_usar('partido')) and public.puede_editar(equipo_id));

create policy registros_borrar on public.registros_partido
  for delete to authenticated
  using ((select public.puede_usar('partido')) and public.puede_editar(equipo_id));

-- Jugadores: los que ya estaban cargados el último día.
create policy jugadores_ver on public.jugadores
  for select to authenticated
  using ((select public.esta_autorizado()) and public.puede_ver_fecha(equipo_id, creado_en::date));

create policy jugadores_crear on public.jugadores
  for insert to authenticated
  with check ((select public.esta_autorizado()) and public.puede_editar(equipo_id));

create policy jugadores_cambiar on public.jugadores
  for update to authenticated
  using ((select public.esta_autorizado()) and public.puede_editar(equipo_id))
  with check ((select public.esta_autorizado()) and public.puede_editar(equipo_id));

create policy jugadores_borrar on public.jugadores
  for delete to authenticated
  using ((select public.esta_autorizado()) and public.puede_editar(equipo_id));

-- Ajustes generales de la app (sin club): como hasta ahora.
create policy ajustes_acceso_app on public.ajustes
  for all to authenticated
  using ((select public.esta_autorizado()))
  with check ((select public.esta_autorizado()));

-- Flujo diario: los entrenamientos hasta el último día.
create policy entrenamientos_ver on public.entrenamientos
  for select to authenticated
  using ((select public.puede_usar('flujo')) and public.puede_ver_fecha(equipo_id, public.fecha_segura(fecha)));

create policy entrenamientos_crear on public.entrenamientos
  for insert to authenticated
  with check ((select public.puede_usar('flujo')) and public.puede_editar(equipo_id));

create policy entrenamientos_cambiar on public.entrenamientos
  for update to authenticated
  using ((select public.puede_usar('flujo')) and public.puede_editar(equipo_id))
  with check ((select public.puede_usar('flujo')) and public.puede_editar(equipo_id));

create policy entrenamientos_borrar on public.entrenamientos
  for delete to authenticated
  using ((select public.puede_usar('flujo')) and public.puede_editar(equipo_id));

-- Lesiones: las que empezaron hasta el último día; su historial, hasta ese
-- día; cabeceras y listas se ven desde adentro o desde afuera, se cambian
-- desde adentro.
create policy lesiones_ver on public.lesiones
  for select to authenticated
  using ((select public.puede_usar('lesiones')) and public.puede_ver_fecha(equipo_id, fecha_lesion));

create policy lesiones_crear on public.lesiones
  for insert to authenticated
  with check ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id));

create policy lesiones_cambiar on public.lesiones
  for update to authenticated
  using ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id))
  with check ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id));

create policy lesiones_borrar on public.lesiones
  for delete to authenticated
  using ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id));

create policy lesiones_historial_ver on public.lesiones_historial
  for select to authenticated
  using ((select public.puede_usar('lesiones'))
         and exists (select 1 from public.lesiones l
                      where l.id = lesion_id
                        and public.puede_ver_fecha(l.equipo_id, cuando::date)));

create policy lesiones_campos_ver on public.lesiones_campos
  for select to authenticated
  using ((select public.puede_usar('lesiones')) and public.puede_ver(equipo_id));

create policy lesiones_campos_cambiar on public.lesiones_campos
  for all to authenticated
  using ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id))
  with check ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id));

create policy lesiones_opciones_ver on public.lesiones_opciones
  for select to authenticated
  using ((select public.puede_usar('lesiones')) and public.puede_ver(equipo_id));

create policy lesiones_opciones_cambiar on public.lesiones_opciones
  for all to authenticated
  using ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id))
  with check ((select public.puede_usar('lesiones')) and public.puede_editar(equipo_id));

commit;

-- Para ver que quedó bien: cuántas membresías hay y cuántas políticas tiene
-- cada tabla.
select count(*) as miembros from public.club_miembros;
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public'
   and tablename in ('club_miembros', 'equipos', 'registros_partido', 'jugadores', 'ajustes',
                     'entrenamientos', 'lesiones', 'lesiones_historial', 'lesiones_campos', 'lesiones_opciones')
 group by tablename
 order by tablename;
