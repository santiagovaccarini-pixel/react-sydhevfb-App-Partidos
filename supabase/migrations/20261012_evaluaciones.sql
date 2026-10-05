-- =====================================================================
-- Evaluaciones: la base de evaluaciones físicas (el Excel BD_evaluaciones)
-- dentro de Bases de Datos, con su propio permiso (pedido de Santiago del
-- 05/10).
--
--   · Permiso evaluaciones: un módulo más de la membresía de cada club
--     (club_miembros y club_invitaciones), aparte de Lesiones. Arranca
--     apagado para todos: lo prende el administrador del club en Cuentas.
--   · evaluaciones: una fila por evaluación de cada test (test: zona_media,
--     y los que se sumen). De un jugador de Datos básicos (jugador_id) o de
--     una persona que no está (persona), nunca de los dos. En datos va solo
--     lo cargado a mano (los tiempos en segundos); lo que el Excel calcula
--     lo calcula la app cada vez que se mira. orden es el orden de carga:
--     con la misma fecha, desempata cuál es la evaluación anterior.
--   · evaluaciones_referencias: los valores de referencia (V.R.) de cada
--     test en cada club, con los valores exactos del Excel. La app solo los
--     lee; se cargan con un SQL aparte (no van al repositorio).
--   · Quien se fue del club ve las dos en la foto de su último día
--     (datos_al_dia), si tenía el permiso.
--
-- Requiere 20261005_foto_al_dia.sql. Se corre en Supabase > SQL Editor,
-- entero y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.datos_al_dia(text, uuid)') is null then
    raise exception 'Primero hay que correr 20261005_foto_al_dia.sql.';
  end if;
end $$;

-- ------------------------------------------------- El permiso por club --

alter table public.club_miembros
  add column if not exists evaluaciones boolean not null default false;
alter table public.club_invitaciones
  add column if not exists evaluaciones boolean not null default false;

comment on column public.club_miembros.evaluaciones is 'Puede usar Evaluaciones (Bases de Datos) en este club.';
comment on column public.club_invitaciones.evaluaciones is 'Entra con Evaluaciones (Bases de Datos).';

-- Tiene ese módulo en ese club. Quien se fue lo conserva para mirar;
-- escribir lo frena puede_editar.
create or replace function public.puede_usar_en(p_equipo uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.esta_autorizado()
     and exists (select 1 from public.club_miembros m
                  where m.equipo_id = p_equipo and m.user_id = auth.uid()
                    and case p_modulo
                          when 'partido' then m.partido
                          when 'flujo' then m.flujo
                          when 'lesiones' then m.lesiones
                          when 'evaluaciones' then m.evaluaciones
                          else false end);
$$;

-- Tiene ese módulo en algún club donde sigue.
create or replace function public.puede_usar(modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.esta_autorizado()
     and exists (select 1 from public.club_miembros m
                  where m.user_id = auth.uid() and m.hasta is null
                    and case modulo
                          when 'partido' then m.partido
                          when 'flujo' then m.flujo
                          when 'lesiones' then m.lesiones
                          when 'evaluaciones' then m.evaluaciones
                          else false end);
$$;

-- Las invitaciones también llevan el permiso.
create or replace function public.aplicar_invitaciones(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_inv record;
  v_cuantas integer := 0;
begin
  select lower(btrim(u.email)) into v_email
    from auth.users u
   where u.id = p_user and u.email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return 0;
  end if;
  for v_inv in
    select * from public.club_invitaciones i
     where i.email = v_email and i.usada_en is null and i.cancelada_en is null and i.vence_en > now()
     order by i.creado_en
  loop
    insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones, decidido_por)
    values (v_inv.equipo_id, p_user, current_date, null, v_inv.rol, v_inv.partido, v_inv.flujo, v_inv.lesiones,
            v_inv.evaluaciones, v_inv.creado_por)
    on conflict (equipo_id, user_id) do update
      set desde = case when public.club_miembros.hasta is not null then current_date else public.club_miembros.desde end,
          hasta = null, rol = excluded.rol, partido = excluded.partido,
          flujo = excluded.flujo, lesiones = excluded.lesiones,
          evaluaciones = excluded.evaluaciones, decidido_por = excluded.decidido_por;
    update public.club_invitaciones set usada_en = now(), usada_por = p_user where id = v_inv.id;
    v_cuantas := v_cuantas + 1;
  end loop;
  if v_cuantas > 0 then
    update public.perfiles set estado = 'autorizado' where user_id = p_user and estado = 'pendiente';
  end if;
  return v_cuantas;
end;
$$;

revoke execute on function public.aplicar_invitaciones(uuid) from public, anon, authenticated;

-- Quien crea un club (el dueño de la plataforma) lo administra con todo.
create or replace function public.equipos_sumar_creador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.club_miembros (equipo_id, user_id, rol, partido, flujo, lesiones, evaluaciones)
    values (new.id, auth.uid(), 'admin', true, true, true, true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- La historia de cada membresía anota también este permiso.
create or replace function public.club_miembros_historial_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila record;
  v_quien uuid;
  v_email text;
  v_acciones text[] := '{}';
  v_detalle jsonb := '{}'::jsonb;
  v_accion text;
begin
  if tg_op = 'DELETE' then v_fila := old; else v_fila := new; end if;
  v_quien := coalesce(auth.uid(), case when tg_op = 'DELETE' then null else new.decidido_por end);
  select p.email into v_email from public.perfiles p where p.user_id = v_quien;

  if tg_op = 'INSERT' then
    v_acciones := array['alta'];
    v_detalle := jsonb_build_object('rol', new.rol, 'partido', new.partido, 'flujo', new.flujo,
                                    'lesiones', new.lesiones, 'evaluaciones', new.evaluaciones,
                                    'desde', new.desde, 'hasta', new.hasta);
  elsif tg_op = 'DELETE' then
    v_acciones := array['borrado'];
  else
    if old.hasta is null and new.hasta is not null then
      v_acciones := v_acciones || 'baja'::text;
      v_detalle := v_detalle || jsonb_build_object('hasta', new.hasta);
    elsif old.hasta is not null and new.hasta is null then
      v_acciones := v_acciones || 'reincorporacion'::text;
    elsif old.hasta is distinct from new.hasta then
      v_acciones := v_acciones || 'baja'::text;
      v_detalle := v_detalle || jsonb_build_object('hasta', new.hasta, 'hasta_antes', old.hasta);
    end if;
    if old.rol is distinct from new.rol then
      v_acciones := v_acciones || 'rol'::text;
      v_detalle := v_detalle || jsonb_build_object('rol', new.rol, 'rol_antes', old.rol);
    end if;
    if old.partido is distinct from new.partido or old.flujo is distinct from new.flujo
       or old.lesiones is distinct from new.lesiones or old.evaluaciones is distinct from new.evaluaciones then
      v_acciones := v_acciones || 'modulos'::text;
      v_detalle := v_detalle || jsonb_build_object('partido', new.partido, 'flujo', new.flujo, 'lesiones', new.lesiones,
                                                   'evaluaciones', new.evaluaciones);
    end if;
  end if;

  foreach v_accion in array v_acciones loop
    insert into public.club_miembros_historial (equipo_id, user_id, accion, detalle, quien, quien_email)
    values (v_fila.equipo_id, v_fila.user_id, v_accion, v_detalle, v_quien, coalesce(v_email, ''));
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Las vistas de los clubes de cada uno y de la gente de un club, con la
-- columna nueva al final.
create or replace view public.v_mis_clubes
with (security_invoker = true)
as
select e.id, e.nombre, e.creado_en, m.desde, m.hasta, m.rol, m.partido, m.flujo, m.lesiones, m.evaluaciones
  from public.equipos e
  left join public.club_miembros m
    on m.equipo_id = e.id and m.user_id = auth.uid()
 order by e.nombre;

create or replace view public.v_miembros_club
with (security_invoker = true)
as
select m.equipo_id, m.user_id, m.desde, m.hasta, m.rol, m.partido, m.flujo, m.lesiones,
       m.decidido_en, m.creado_en, p.email, p.estado, p.confirmado_en, m.evaluaciones
  from public.club_miembros m
  join public.perfiles p on p.user_id = m.user_id;

revoke all on public.v_mis_clubes, public.v_miembros_club from anon;
grant select on public.v_mis_clubes, public.v_miembros_club to authenticated;

-- -------------------------------------------------------- Las tablas --

create table if not exists public.evaluaciones (
  id              uuid primary key default gen_random_uuid(),
  equipo_id       uuid not null references public.equipos (id) on delete restrict,
  test            text not null,
  orden           bigint generated always as identity,
  jugador_id      bigint references public.jugadores (id) on delete restrict,
  persona         text,
  fecha           date,
  datos           jsonb not null default '{}'::jsonb,
  creado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid references auth.users (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  constraint evaluaciones_test check (test ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint evaluaciones_de_quien check (
    (jugador_id is null) = (persona is not null)
    and (persona is null or length(btrim(persona)) between 1 and 120)),
  constraint evaluaciones_datos check (jsonb_typeof(datos) = 'object'),
  constraint evaluaciones_sin_futuro check (fecha is null or fecha <= current_date)
);

comment on table public.evaluaciones is
  'Una fila por evaluación de cada test (las hojas del Excel BD_evaluaciones). Solo lo cargado a mano; lo calculado lo calcula la app.';
comment on column public.evaluaciones.test is 'El test (la hoja del Excel): zona_media, …';
comment on column public.evaluaciones.orden is 'Orden de carga. Con la misma fecha, decide cuál es la evaluación anterior. No cambia.';
comment on column public.evaluaciones.persona is
  'El nombre de quien se evaluó cuando no está en Datos básicos (vino pegado del Excel). Sin jugador_id.';
comment on column public.evaluaciones.datos is
  'Lo cargado a mano, por clave de columna del test. Los tiempos van en segundos; las listas, con su código.';

create index if not exists evaluaciones_por_test on public.evaluaciones (equipo_id, test, orden);
create index if not exists evaluaciones_por_jugador on public.evaluaciones (jugador_id) where jugador_id is not null;

-- Una evaluación no se muda de club ni de test, el jugador es del mismo
-- club y queda anotado quién la cargó y quién la cambió.
create or replace function public.evaluaciones_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.equipo_id <> old.equipo_id or new.test <> old.test) then
    raise exception 'evaluacion_fija' using errcode = 'P0001';
  end if;
  if new.jugador_id is not null
     and not exists (select 1 from public.jugadores j where j.id = new.jugador_id and j.equipo_id = new.equipo_id) then
    raise exception 'jugador_de_otro_club' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en := now();
  else
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists evaluaciones_preparar on public.evaluaciones;
create trigger evaluaciones_preparar
  before insert or update on public.evaluaciones
  for each row execute function public.evaluaciones_preparar();

create table if not exists public.evaluaciones_referencias (
  id             uuid primary key default gen_random_uuid(),
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  test           text not null,
  datos          jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  constraint evaluaciones_referencias_test check (test ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint evaluaciones_referencias_datos check (jsonb_typeof(datos) = 'object'),
  constraint evaluaciones_referencias_una unique (equipo_id, test)
);

comment on table public.evaluaciones_referencias is
  'Los valores de referencia (V.R.) de cada test en cada club, con los valores exactos del Excel. La app solo los lee.';

-- -------------------------------------------- La foto al día de salida --

drop trigger if exists anotar_version on public.evaluaciones;
create trigger anotar_version after insert or update or delete on public.evaluaciones
  for each row execute function public.anotar_version();
drop trigger if exists anotar_version on public.evaluaciones_referencias;
create trigger anotar_version after insert or update or delete on public.evaluaciones_referencias
  for each row execute function public.anotar_version();

-- La de 20261005 con las dos tablas nuevas (con su módulo: sin él, quien se
-- fue no las ve) y un orden fijo, para leer de a 1000 sin saltear filas.
create or replace function public.datos_al_dia(p_tabla text, p_equipo uuid)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hasta date;
  v_modulo text;
  v_corte timestamptz;
begin
  if p_tabla not in ('registros_partido', 'entrenamientos', 'jugadores', 'lesiones',
                     'evaluaciones', 'evaluaciones_referencias') then
    raise exception 'tabla_invalida' using errcode = 'P0001';
  end if;
  v_hasta := public.acceso_club(p_equipo);
  if v_hasta is null then
    return;
  end if;
  v_modulo := case p_tabla when 'registros_partido' then 'partido'
                           when 'entrenamientos' then 'flujo'
                           when 'lesiones' then 'lesiones'
                           when 'evaluaciones' then 'evaluaciones'
                           when 'evaluaciones_referencias' then 'evaluaciones' end;
  if v_modulo is not null and not public.puede_usar_en(p_equipo, v_modulo) then
    return;
  end if;
  if v_hasta = 'infinity'::date then
    v_corte := 'infinity'::timestamptz;
  else
    v_corte := (v_hasta + 1)::timestamp at time zone public.zona_del_club(p_equipo);
  end if;
  -- La última versión de cada fila antes del corte, sea del club que sea: si
  -- para entonces la fila ya se había pasado a otro club, no va. Lo más nuevo
  -- primero (y, con la misma hora, por fila): la API devuelve hasta 1000
  -- filas por vez y la app pide las que siguen.
  return query
    select x.fila
      from (select distinct on (v.fila_id) v.fila_id, v.fila, v.accion, v.cuando, v.equipo_id
              from public.versiones_datos v
             where v.tabla = p_tabla
               and v.cuando < v_corte
               and v.fila_id in (select w.fila_id from public.versiones_datos w
                                  where w.tabla = p_tabla and w.equipo_id = p_equipo and w.cuando < v_corte)
             order by v.fila_id, v.cuando desc, v.id desc) x
     where x.accion <> 'borrada'
       and x.equipo_id = p_equipo
     order by x.cuando desc, x.fila_id;
end;
$$;

revoke execute on function public.datos_al_dia(text, uuid) from public, anon;
grant execute on function public.datos_al_dia(text, uuid) to authenticated;
revoke execute on function public.evaluaciones_preparar() from public, anon, authenticated;

-- ------------------------------------------------------------ Permisos --

alter table public.evaluaciones enable row level security;
alter table public.evaluaciones_referencias enable row level security;
revoke all on table public.evaluaciones, public.evaluaciones_referencias from anon, authenticated;
grant select, insert, update, delete on table public.evaluaciones to authenticated;
grant select on table public.evaluaciones_referencias to authenticated;

-- Se leen directo solo estando en el club: quien se fue lee la foto.
drop policy if exists evaluaciones_ver on public.evaluaciones;
create policy evaluaciones_ver on public.evaluaciones
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

drop policy if exists evaluaciones_crear on public.evaluaciones;
create policy evaluaciones_crear on public.evaluaciones
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

drop policy if exists evaluaciones_cambiar on public.evaluaciones;
create policy evaluaciones_cambiar on public.evaluaciones
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

drop policy if exists evaluaciones_borrar on public.evaluaciones;
create policy evaluaciones_borrar on public.evaluaciones
  for delete to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

drop policy if exists evaluaciones_referencias_ver on public.evaluaciones_referencias;
create policy evaluaciones_referencias_ver on public.evaluaciones_referencias
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

commit;

-- Que la app vea las columnas y tablas nuevas sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: quién tiene Evaluaciones en cada club (al
-- principio, nadie) y las políticas de las tablas nuevas.
select e.nombre,
       count(*) filter (where m.evaluaciones and m.hasta is null) as con_evaluaciones
  from public.equipos e
  left join public.club_miembros m on m.equipo_id = e.id
 group by e.nombre
 order by e.nombre;
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public'
   and tablename in ('evaluaciones', 'evaluaciones_referencias')
 group by tablename
 order by tablename;
