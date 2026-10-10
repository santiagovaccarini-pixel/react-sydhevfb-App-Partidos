-- =====================================================================
-- GPS: la base del GPS (la hoja BD_GPS del Excel GPS_BD_CAM) dentro de
-- Bases de Datos, con su propio permiso (pedido de Santiago del 10/10).
--
--   · Permiso gps: un módulo más de la membresía de cada club
--     (club_miembros y club_invitaciones), aparte de Lesiones y
--     Evaluaciones. Arranca apagado para todos: lo prende el administrador
--     del club en Cuentas (o al aceptar un pedido de acceso).
--   · gps: una fila por fila de BD_GPS: de un jugador de Datos básicos
--     (jugador_id), de una persona que no está (persona) o el promedio del
--     equipo de una tarea o de la sesión (promedio: parcial o sesion); uno
--     solo de los tres. En datos van los valores de cada columna, como
--     estaban en el Excel (los tiempos y las horas en segundos). orden es el
--     orden de carga (el del Excel, dentro de cada fecha).
--   · gps_campos y gps_opciones: los Ajustes del club (el nombre de cada
--     columna, si se ve, las columnas que suma el club y las opciones de
--     cada lista), como Evaluaciones › Ajustes. Una fila solo para lo que el
--     club cambió o sumó.
--   · Quien se fue del club ve la base en la foto de su último día
--     (datos_al_dia), si tenía el permiso.
--
-- Requiere 20261014_duenos_y_pedidos.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. Solo agrega: la app de antes sigue andando.
-- Se puede volver a correr. Después de esta, 20261014 ya no se vuelve a
-- correr (se frena sola: desharía el permiso nuevo).
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.plataforma') is null or to_regprocedure('public.datos_al_dia(text, uuid)') is null then
    raise exception 'Primero hay que correr 20261014_duenos_y_pedidos.sql.';
  end if;
end $$;

-- ------------------------------------------------- El permiso por club --

alter table public.club_miembros
  add column if not exists gps boolean not null default false;
alter table public.club_invitaciones
  add column if not exists gps boolean not null default false;

comment on column public.club_miembros.gps is 'Puede usar GPS (Bases de Datos) en este club.';
comment on column public.club_invitaciones.gps is 'Entra con GPS (Bases de Datos).';

-- Tiene ese módulo en ese club (la de 20261012, con gps). Quien se fue lo
-- conserva para mirar; escribir lo frena puede_editar.
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
                          when 'gps' then m.gps
                          else false end);
$$;

-- Tiene ese módulo en algún club donde sigue (la de 20261012, con gps).
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
                          when 'gps' then m.gps
                          else false end);
$$;

-- Las invitaciones (la de 20261014) también llevan el permiso.
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
    insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones, gps, decidido_por)
    values (v_inv.equipo_id, p_user, current_date, null, v_inv.rol, v_inv.partido, v_inv.flujo, v_inv.lesiones,
            v_inv.evaluaciones, v_inv.gps, v_inv.creado_por)
    on conflict (equipo_id, user_id) do update
      set desde = current_date, hasta = null, rol = excluded.rol, partido = excluded.partido,
          flujo = excluded.flujo, lesiones = excluded.lesiones,
          evaluaciones = excluded.evaluaciones, gps = excluded.gps, decidido_por = excluded.decidido_por
      where public.club_miembros.hasta is not null;
    update public.club_invitaciones set usada_en = now(), usada_por = p_user where id = v_inv.id;
    update public.club_pedidos
       set estado = 'aceptado', decidido_por = v_inv.creado_por, decidido_en = now()
     where user_id = p_user and equipo_id = v_inv.equipo_id and estado = 'abierto';
    v_cuantas := v_cuantas + 1;
  end loop;
  if v_cuantas > 0 then
    update public.perfiles set estado = 'autorizado' where user_id = p_user and estado = 'pendiente';
  end if;
  return v_cuantas;
end;
$$;

-- La historia de cada membresía (la de 20261012) anota también este permiso.
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
                                    'lesiones', new.lesiones, 'evaluaciones', new.evaluaciones, 'gps', new.gps,
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
       or old.lesiones is distinct from new.lesiones or old.evaluaciones is distinct from new.evaluaciones
       or old.gps is distinct from new.gps then
      v_acciones := v_acciones || 'modulos'::text;
      v_detalle := v_detalle || jsonb_build_object('partido', new.partido, 'flujo', new.flujo, 'lesiones', new.lesiones,
                                                   'evaluaciones', new.evaluaciones, 'gps', new.gps);
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

-- A un dueño nadie le cambia los módulos (la de 20261014, con gps).
create or replace function public.club_miembros_proteger_duenos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() = old.user_id
     or not (exists (select 1 from public.plataforma p where p.dueno_principal = old.user_id)
             or exists (select 1 from public.plataforma_subduenos s where s.user_id = old.user_id)) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Se está borrando el club entero: no hay nada que cuidar.
    if not exists (select 1 from public.equipos e where e.id = old.equipo_id) then
      return old;
    end if;
    raise exception 'dueno_protegido' using errcode = 'P0001';
  end if;
  if old.hasta is not null and new.hasta is null
     and exists (select 1 from public.club_pedidos cp
                  where cp.user_id = old.user_id and cp.equipo_id = old.equipo_id and cp.estado = 'aceptado'
                    and cp.decidido_por = auth.uid() and cp.decidido_en = now()) then
    return new;
  end if;
  if (new.hasta, new.rol, new.desde, new.creado_en) is distinct from (old.hasta, old.rol, old.desde, old.creado_en)
     or (new.partido, new.flujo, new.lesiones, new.evaluaciones, new.gps)
        is distinct from (old.partido, old.flujo, old.lesiones, old.evaluaciones, old.gps) then
    raise exception 'dueno_protegido' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Aceptar un pedido de acceso (la de 20261014) también da GPS. El permiso
-- nuevo va al final y con valor por defecto: la app de antes la sigue
-- llamando con los cuatro módulos.
drop function if exists public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean);
create or replace function public.aceptar_pedido(p_id uuid, p_partido boolean, p_flujo boolean,
                                                 p_lesiones boolean, p_evaluaciones boolean,
                                                 p_gps boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.club_pedidos;
begin
  select * into v_pedido from public.club_pedidos cp where cp.id = p_id for update;
  if not found or v_pedido.equipo_id is null or not public.es_admin_de_club(v_pedido.equipo_id) then
    raise exception 'solo_admin' using errcode = '42501';
  end if;
  if v_pedido.estado <> 'abierto' then
    raise exception 'pedido_cerrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.perfiles pf where pf.user_id = v_pedido.user_id and pf.estado = 'bloqueado') then
    raise exception 'cuenta_bloqueada' using errcode = 'P0001';
  end if;
  -- Primero el pedido: así, si es un dueño que se había ido,
  -- club_miembros_proteger_duenos ve que volver lo pidió él.
  update public.club_pedidos set estado = 'aceptado', decidido_por = auth.uid(), decidido_en = now() where id = p_id;
  insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones, gps)
  values (v_pedido.equipo_id, v_pedido.user_id, current_date, null, 'staff', coalesce(p_partido, false),
          coalesce(p_flujo, false), coalesce(p_lesiones, false), coalesce(p_evaluaciones, false), coalesce(p_gps, false))
  on conflict (equipo_id, user_id) do update
    set desde = current_date, hasta = null, rol = 'staff', partido = excluded.partido, flujo = excluded.flujo,
        lesiones = excluded.lesiones, evaluaciones = excluded.evaluaciones, gps = excluded.gps
    where public.club_miembros.hasta is not null;
  update public.perfiles set estado = 'autorizado' where user_id = v_pedido.user_id and estado = 'pendiente';
end;
$$;

-- Las vistas de los clubes de cada uno y de la gente de un club, con la
-- columna nueva al final.
create or replace view public.v_mis_clubes
with (security_invoker = true)
as
select e.id, e.nombre, e.creado_en, m.desde, m.hasta, m.rol, m.partido, m.flujo, m.lesiones, m.evaluaciones, m.gps
  from public.equipos e
  left join public.club_miembros m
    on m.equipo_id = e.id and m.user_id = auth.uid()
 order by e.nombre;

create or replace view public.v_miembros_club
with (security_invoker = true)
as
select m.equipo_id, m.user_id, m.desde, m.hasta, m.rol, m.partido, m.flujo, m.lesiones,
       m.decidido_en, m.creado_en, p.email, p.estado, p.confirmado_en, m.evaluaciones,
       public.miembro_protegido(m.user_id) as protegido, m.gps
  from public.club_miembros m
  join public.perfiles p on p.user_id = m.user_id;

revoke all on public.v_mis_clubes, public.v_miembros_club from anon, authenticated;
grant select on public.v_mis_clubes, public.v_miembros_club to authenticated;

-- El administrador prende y apaga el permiso; la invitación lo lleva.
grant update (gps) on table public.club_miembros to authenticated;
grant insert (gps) on table public.club_invitaciones to authenticated;

-- -------------------------------------------------------- Las tablas --

create table if not exists public.gps (
  id              uuid primary key default gen_random_uuid(),
  equipo_id       uuid not null references public.equipos (id) on delete restrict,
  orden           bigint generated always as identity,
  fecha           date not null,
  jugador_id      bigint references public.jugadores (id) on delete restrict,
  persona         text,
  promedio        text,
  datos           jsonb not null default '{}'::jsonb,
  creado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid references auth.users (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  constraint gps_de_quien check (
    num_nonnulls(jugador_id, persona, promedio) = 1
    and (persona is null or length(btrim(persona)) between 1 and 120)),
  constraint gps_promedio check (promedio is null or promedio in ('parcial', 'sesion')),
  constraint gps_datos check (jsonb_typeof(datos) = 'object')
);

comment on table public.gps is
  'Una fila por fila de la base del GPS (la hoja BD_GPS del Excel): de un jugador, de una persona fuera de Datos básicos o el promedio del equipo.';
comment on column public.gps.orden is 'Orden de carga (el del Excel dentro de cada fecha). No cambia.';
comment on column public.gps.persona is
  'El nombre de quien no está en Datos básicos (vino pegado del Excel). Sin jugador_id ni promedio.';
comment on column public.gps.promedio is
  'El promedio del equipo (Team Average): parcial (de una tarea o un tiempo) o sesion. Sin jugador_id ni persona.';
comment on column public.gps.datos is
  'Los valores de cada columna, por su clave. Los tiempos y las horas van en segundos; las listas, con su código.';

create index if not exists gps_por_fecha on public.gps (equipo_id, fecha, orden);
create index if not exists gps_por_jugador on public.gps (jugador_id) where jugador_id is not null;

-- Una fila no se muda de club, el jugador es del mismo club, la fecha no es
-- futura (en la zona del club) y queda anotado quién la cargó y quién la
-- cambió.
create or replace function public.gps_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.equipo_id <> old.equipo_id then
    raise exception 'gps_fija' using errcode = 'P0001';
  end if;
  -- La base sola, sin nadie conectado y sin tocar lo cargado: es el "on
  -- delete set null" de creado_por o actualizado_por al borrar una cuenta.
  if tg_op = 'UPDATE' and auth.uid() is null
     and (new.fecha, new.jugador_id, new.persona, new.promedio, new.datos)
         is not distinct from (old.fecha, old.jugador_id, old.persona, old.promedio, old.datos) then
    new.creado_por := case when exists (select 1 from auth.users u where u.id = old.creado_por) then old.creado_por end;
    new.actualizado_por := case when exists (select 1 from auth.users u where u.id = old.actualizado_por) then old.actualizado_por end;
    new.creado_en := old.creado_en;
    new.actualizado_en := old.actualizado_en;
    return new;
  end if;
  if (tg_op = 'INSERT' or new.fecha is distinct from old.fecha)
     and new.fecha > (now() at time zone public.zona_del_club(new.equipo_id))::date then
    raise exception 'gps_sin_futuro' using errcode = 'P0001';
  end if;
  if new.jugador_id is not null
     and (tg_op = 'INSERT' or new.jugador_id is distinct from old.jugador_id)
     and not exists (select 1 from public.jugadores j where j.id = new.jugador_id and j.equipo_id = new.equipo_id) then
    raise exception 'jugador_de_otro_club' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en := now();
  else
    new.creado_por := case when exists (select 1 from auth.users u where u.id = old.creado_por) then old.creado_por end;
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists gps_preparar on public.gps;
create trigger gps_preparar
  before insert or update on public.gps
  for each row execute function public.gps_preparar();

create table if not exists public.gps_campos (
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  campo          text not null,
  etiqueta_es    text not null default '',
  etiqueta_pt    text not null default '',
  oculto         boolean not null default false,
  orden          integer not null default 0,
  tipo           text,
  actualizado_en timestamptz not null default now(),
  primary key (equipo_id, campo),
  constraint gps_campos_campo check (char_length(campo) between 1 and 80),
  constraint gps_campos_etiquetas check (char_length(etiqueta_es) <= 120 and char_length(etiqueta_pt) <= 120),
  constraint gps_campos_tipo check (tipo is null or tipo in ('numero', 'texto', 'tiempo', 'hora'))
);

comment on table public.gps_campos is
  'Cómo se llama cada columna de GPS en este club (en español y portugués) y si se ve. Sin fila, vale el nombre del Excel. Una fila con tipo es una columna que sumó el club.';

create table if not exists public.gps_opciones (
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  lista          text not null,
  codigo         text not null,
  etiqueta_es    text not null default '',
  etiqueta_pt    text not null default '',
  oculto         boolean not null default false,
  orden          integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (equipo_id, lista, codigo),
  constraint gps_opciones_lista check (char_length(lista) between 1 and 80),
  constraint gps_opciones_codigo check (char_length(codigo) between 1 and 80),
  constraint gps_opciones_etiquetas check (char_length(etiqueta_es) <= 120 and char_length(etiqueta_pt) <= 120)
);

comment on table public.gps_opciones is
  'Las opciones de cada lista de GPS en este club (tipo de sesión, dispositivo…). Las filas guardan el código; acá está el texto.';

-- -------------------------------------------- La foto al día de salida --

drop trigger if exists anotar_version on public.gps;
create trigger anotar_version after insert or update or delete on public.gps
  for each row execute function public.anotar_version();

-- La de 20261012 con gps (con su módulo: sin él, quien se fue no la ve).
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
                     'evaluaciones', 'evaluaciones_referencias', 'gps') then
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
                           when 'evaluaciones_referencias' then 'evaluaciones'
                           when 'gps' then 'gps' end;
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

-- ------------------------------------------------------------ Permisos --

-- Toda función nueva nace ejecutable por PUBLIC: se saca (como en 20261014)
-- y se da solo lo que usa la app.
revoke execute on function public.gps_preparar() from public, anon, authenticated;
revoke execute on function public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;

alter table public.gps enable row level security;
alter table public.gps_campos enable row level security;
alter table public.gps_opciones enable row level security;
revoke all on table public.gps, public.gps_campos, public.gps_opciones from public, anon, authenticated;
grant select, insert, update, delete on table public.gps, public.gps_campos, public.gps_opciones to authenticated;

-- Se lee directo solo estando en el club: quien se fue lee la foto.
drop policy if exists gps_ver on public.gps;
create policy gps_ver on public.gps
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

drop policy if exists gps_crear on public.gps;
create policy gps_crear on public.gps
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

drop policy if exists gps_cambiar on public.gps;
create policy gps_cambiar on public.gps
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

drop policy if exists gps_borrar on public.gps;
create policy gps_borrar on public.gps
  for delete to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

-- Los Ajustes, como los de Evaluaciones: los ve quien tiene GPS en el club
-- (también quien se fue, para mirar) y los cambia quien sigue.
drop policy if exists gps_campos_ver on public.gps_campos;
create policy gps_campos_ver on public.gps_campos
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_ver(equipo_id));

drop policy if exists gps_campos_cambiar on public.gps_campos;
create policy gps_campos_cambiar on public.gps_campos
  for all to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

drop policy if exists gps_opciones_ver on public.gps_opciones;
create policy gps_opciones_ver on public.gps_opciones
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_ver(equipo_id));

drop policy if exists gps_opciones_cambiar on public.gps_opciones;
create policy gps_opciones_cambiar on public.gps_opciones
  for all to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

-- Antes de guardar, que haya quedado bien: las tablas con RLS, sus
-- políticas, nada para anon y el permiso en las vistas.
do $$
begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname in ('gps', 'gps_campos', 'gps_opciones') and c.relrowsecurity) <> 3 then
    raise exception 'Las tablas de GPS quedaron sin RLS.';
  end if;
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename in ('gps', 'gps_campos', 'gps_opciones')) <> 8 then
    raise exception 'Las tablas de GPS no tienen sus ocho políticas.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public'
                and table_name in ('gps', 'gps_campos', 'gps_opciones', 'v_mis_clubes', 'v_miembros_club')) then
    raise exception 'anon no puede tener permisos en las tablas de GPS.';
  end if;
  if has_function_privilege('anon', 'public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean, boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.gps_preparar()', 'EXECUTE') then
    raise exception 'Una función de GPS quedó ejecutable por quien no debe.';
  end if;
end $$;

commit;

-- Que la app vea las columnas y tablas nuevas sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: quién tiene GPS en cada club (al principio,
-- nadie) y las políticas de las tablas nuevas.
select e.nombre,
       count(*) filter (where m.gps and m.hasta is null) as con_gps
  from public.equipos e
  left join public.club_miembros m on m.equipo_id = e.id
 group by e.nombre
 order by e.nombre;
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public'
   and tablename in ('gps', 'gps_campos', 'gps_opciones')
 group by tablename
 order by tablename;
