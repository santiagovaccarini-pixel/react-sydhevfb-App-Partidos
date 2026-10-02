-- =====================================================================
-- Cuentas v2: quién está en cada club, con qué rol y qué módulos, cómo se
-- entra (invitación) y la historia de cada cuenta en cada club.
--
--   · club_miembros suma rol (admin del club o staff) y módulos por club
--     (partido, flujo, lesiones). Lo que alguien puede usar sale de su
--     membresía en ese club, no de la cuenta. perfiles.admin queda como
--     dueño de la plataforma: autoriza o bloquea cuentas, crea clubes y ve
--     las membresías; los datos de un club solo los ve quien está o estuvo.
--   · club_invitaciones: el admin del club carga correo, rol y módulos. Si
--     la cuenta existe y tiene el correo confirmado, entra en el acto; si
--     no, entra sola al confirmar ese correo (y queda autorizada).
--   · club_miembros_historial: cada alta, baja, reincorporación y cambio de
--     rol o módulos, con quién y cuándo. Lo escribe la base.
--   · Un club nunca queda sin un administrador activo. La fecha de salida
--     no puede ser futura. Una membresía no se pasa a otro club ni a otra
--     cuenta.
--
-- Requiere 20261003_club_miembros.sql. Se corre en Supabase > SQL Editor,
-- entero y de una vez. Se puede volver a correr, salvo después de
-- 20261005_foto_al_dia.sql: ahí se frena sola (desharía la foto).
-- =====================================================================

begin;

-- Una migración vieja corrida después de una nueva deshace lo nuevo: se frena.
do $$
begin
  if to_regclass('public.versiones_datos') is not null then
    raise exception 'Ya está corrida 20261005_foto_al_dia.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

-- Marcas de lo que se hace una sola vez. Nadie desde la app la ve ni la toca.
create table if not exists public.migraciones_hechas (
  nombre   text primary key,
  hecha_en timestamptz not null default now()
);
alter table public.migraciones_hechas enable row level security;
revoke all on table public.migraciones_hechas from anon, authenticated;

-- ------------------------------------- Un partido repetido es por club --
-- Antes, dos clubes distintos no podían cargar un partido el mismo día
-- contra un rival del mismo nombre. Ahora la regla es por club.
do $$
begin
  if not exists (
    select 1 from public.registros_partido
     group by equipo_id, fecha, lower(trim(rival))
    having count(*) > 1
  ) then
    drop index if exists public.registros_partido_fecha_rival_unicos;
    create unique index if not exists registros_partido_club_fecha_rival_unicos
      on public.registros_partido (equipo_id, fecha, lower(trim(rival)));
  else
    raise notice 'No se cambió el índice de partidos repetidos: hay partidos duplicados para revisar.';
  end if;
end $$;

-- ------------------------------------------------- Rol y módulos por club --

alter table public.club_miembros
  add column if not exists rol text not null default 'staff',
  add column if not exists partido boolean not null default true,
  add column if not exists flujo boolean not null default true,
  add column if not exists lesiones boolean not null default false;

alter table public.club_miembros drop constraint if exists club_miembros_rol_valido;
alter table public.club_miembros
  add constraint club_miembros_rol_valido check (rol in ('admin', 'staff'));

comment on column public.club_miembros.rol is 'admin (administra la gente del club) o staff.';
comment on column public.club_miembros.partido is 'Puede usar Partido en este club.';
comment on column public.club_miembros.flujo is 'Puede usar Flujo diario en este club.';
comment on column public.club_miembros.lesiones is 'Puede usar Lesiones en este club.';

-- La primera vez: lo que decía cada cuenta pasa a cada una de sus
-- membresías, y un club sin administrador activo nombra al más antiguo.
do $$
begin
  if not exists (select 1 from public.migraciones_hechas where nombre = 'cuentas_v2_modulos') then
    update public.club_miembros m
       set partido = (p.partido or p.admin),
           flujo = (p.flujo or p.admin),
           lesiones = (p.lesiones or p.admin),
           rol = case when p.admin then 'admin' else 'staff' end
      from public.perfiles p
     where p.user_id = m.user_id;

    update public.club_miembros m
       set rol = 'admin'
     where m.hasta is null
       and not exists (select 1 from public.club_miembros a
                        where a.equipo_id = m.equipo_id and a.rol = 'admin' and a.hasta is null)
       and m.user_id = (select x.user_id from public.club_miembros x
                         where x.equipo_id = m.equipo_id and x.hasta is null
                         order by x.creado_en, x.user_id limit 1);

    insert into public.migraciones_hechas (nombre) values ('cuentas_v2_modulos');
  end if;
end $$;

-- Quién decidió y cuándo (lo anota la base). La salida no puede ser futura
-- y una membresía no se muda a otro club ni a otra cuenta.
create or replace function public.club_miembros_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.equipo_id <> old.equipo_id or new.user_id <> old.user_id) then
    raise exception 'membresia_fija' using errcode = 'P0001';
  end if;
  if new.hasta is not null and new.hasta > current_date then
    raise exception 'hasta_futura' using errcode = 'P0001';
  end if;
  new.decidido_por := coalesce(auth.uid(), new.decidido_por);
  new.decidido_en := now();
  return new;
end;
$$;

-- Quien crea un club (el dueño de la plataforma) lo administra.
create or replace function public.equipos_sumar_creador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.club_miembros (equipo_id, user_id, rol, partido, flujo, lesiones)
    values (new.id, auth.uid(), 'admin', true, true, true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- --------------------------------------------------------- Historial --

create table if not exists public.club_miembros_historial (
  id          bigint generated always as identity primary key,
  equipo_id   uuid not null,
  user_id     uuid not null,
  accion      text not null,
  detalle     jsonb not null default '{}'::jsonb,
  quien       uuid,
  quien_email text not null default '',
  cuando      timestamptz not null default now()
);

comment on table public.club_miembros_historial is
  'Cada alta, baja, reincorporación, cambio de rol o de módulos de una cuenta en un club, con quién y cuándo. Lo escribe la base.';

create index if not exists club_miembros_historial_por_miembro
  on public.club_miembros_historial (equipo_id, user_id, cuando desc);

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
                                    'lesiones', new.lesiones, 'desde', new.desde, 'hasta', new.hasta);
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
       or old.lesiones is distinct from new.lesiones then
      v_acciones := v_acciones || 'modulos'::text;
      v_detalle := v_detalle || jsonb_build_object('partido', new.partido, 'flujo', new.flujo, 'lesiones', new.lesiones);
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

drop trigger if exists club_miembros_historial on public.club_miembros;
create trigger club_miembros_historial
  after insert or update or delete on public.club_miembros
  for each row execute function public.club_miembros_historial_anotar();

-- Las membresías que ya estaban arrancan su historia con el alta (y la baja
-- si ya se habían ido).
insert into public.club_miembros_historial (equipo_id, user_id, accion, detalle, quien, cuando)
select m.equipo_id, m.user_id, 'alta',
       jsonb_build_object('rol', m.rol, 'partido', m.partido, 'flujo', m.flujo, 'lesiones', m.lesiones, 'desde', m.desde),
       m.decidido_por, m.creado_en
  from public.club_miembros m
 where not exists (select 1 from public.club_miembros_historial h
                    where h.equipo_id = m.equipo_id and h.user_id = m.user_id);

insert into public.club_miembros_historial (equipo_id, user_id, accion, detalle, quien, cuando)
select m.equipo_id, m.user_id, 'baja', jsonb_build_object('hasta', m.hasta), m.decidido_por, m.decidido_en
  from public.club_miembros m
 where m.hasta is not null
   and not exists (select 1 from public.club_miembros_historial h
                    where h.equipo_id = m.equipo_id and h.user_id = m.user_id and h.accion = 'baja');

-- ------------------------------------------- El último administrador --

-- Un club no puede quedar sin un administrador activo. Si se está borrando
-- el club entero o la cuenta, no hay nada que cuidar.
create or replace function public.club_miembros_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.rol = 'admin' and old.hasta is null
     and (tg_op = 'DELETE' or new.rol <> 'admin' or new.hasta is not null)
     and exists (select 1 from public.equipos e where e.id = old.equipo_id)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (select 1 from public.club_miembros m
                      where m.equipo_id = old.equipo_id and m.user_id <> old.user_id
                        and m.rol = 'admin' and m.hasta is null) then
    raise exception 'ultimo_admin' using errcode = 'P0001',
      hint = 'Nombrá otro administrador del club antes.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists club_miembros_ultimo_admin on public.club_miembros;
create trigger club_miembros_ultimo_admin
  before update or delete on public.club_miembros
  for each row execute function public.club_miembros_ultimo_admin();

-- ------------------------------------------------------- Invitaciones --

create table if not exists public.club_invitaciones (
  id           uuid primary key default gen_random_uuid(),
  equipo_id    uuid not null references public.equipos (id) on delete cascade,
  email        text not null,
  rol          text not null default 'staff' check (rol in ('admin', 'staff')),
  partido      boolean not null default true,
  flujo        boolean not null default true,
  lesiones     boolean not null default false,
  creado_por   uuid references auth.users (id) on delete set null,
  creado_en    timestamptz not null default now(),
  vence_en     timestamptz not null default now() + interval '14 days',
  usada_en     timestamptz,
  usada_por    uuid,
  cancelada_en timestamptz
);

comment on table public.club_invitaciones is
  'Invitaciones a un club por correo. Si la cuenta existe (correo confirmado) entra en el acto; si no, entra sola al confirmar ese correo.';

create unique index if not exists club_invitaciones_abierta_unica
  on public.club_invitaciones (equipo_id, email)
  where usada_en is null and cancelada_en is null;

create index if not exists club_invitaciones_por_correo on public.club_invitaciones (email);

-- El correo se guarda limpio y queda anotado quién invitó.
create or replace function public.club_invitaciones_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'correo_invalido' using errcode = 'P0001';
  end if;
  new.creado_por := coalesce(auth.uid(), new.creado_por);
  return new;
end;
$$;

drop trigger if exists club_invitaciones_preparar on public.club_invitaciones;
create trigger club_invitaciones_preparar
  before insert on public.club_invitaciones
  for each row execute function public.club_invitaciones_preparar();

-- Aplica a una cuenta las invitaciones abiertas y vigentes de su correo,
-- solo si el correo está confirmado (que nadie entre registrándose con un
-- correo ajeno): la mete o la reincorpora en cada club, marca la invitación
-- como usada y, si la cuenta estaba pendiente, la autoriza.
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
    insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, decidido_por)
    values (v_inv.equipo_id, p_user, current_date, null, v_inv.rol, v_inv.partido, v_inv.flujo, v_inv.lesiones, v_inv.creado_por)
    on conflict (equipo_id, user_id) do update
      set desde = case when public.club_miembros.hasta is not null then current_date else public.club_miembros.desde end,
          hasta = null, rol = excluded.rol, partido = excluded.partido,
          flujo = excluded.flujo, lesiones = excluded.lesiones, decidido_por = excluded.decidido_por;
    update public.club_invitaciones set usada_en = now(), usada_por = p_user where id = v_inv.id;
    v_cuantas := v_cuantas + 1;
  end loop;
  if v_cuantas > 0 then
    update public.perfiles set estado = 'autorizado' where user_id = p_user and estado = 'pendiente';
  end if;
  return v_cuantas;
end;
$$;

-- Si la cuenta invitada ya existe (y confirmó el correo), entra en el acto.
create or replace function public.club_invitaciones_aplicar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select u.id into v_user
    from auth.users u
   where lower(btrim(u.email)) = new.email and u.email_confirmed_at is not null
   limit 1;
  if v_user is not null then
    perform public.aplicar_invitaciones(v_user);
  end if;
  return new;
end;
$$;

drop trigger if exists club_invitaciones_aplicar on public.club_invitaciones;
create trigger club_invitaciones_aplicar
  after insert on public.club_invitaciones
  for each row execute function public.club_invitaciones_aplicar();

-- Al registrarse el perfil aparece como siempre (pendiente); si el correo ya
-- viene confirmado y había invitación, entra al club.
create or replace function public.perfiles_alta_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (user_id, email, confirmado_en)
  values (new.id, lower(coalesce(new.email, '')), new.email_confirmed_at)
  on conflict (user_id) do nothing;
  perform public.aplicar_invitaciones(new.id);
  return new;
end;
$$;

-- Al confirmar el correo (o cambiarlo por otro confirmado), se aplican las
-- invitaciones que esperaban.
create or replace function public.perfiles_sincronizar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfiles
     set email = lower(coalesce(new.email, '')),
         confirmado_en = new.email_confirmed_at,
         actualizado_en = now()
   where user_id = new.id;
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or lower(coalesce(old.email, '')) is distinct from lower(coalesce(new.email, ''))) then
    perform public.aplicar_invitaciones(new.id);
  end if;
  return new;
end;
$$;

-- ------------------------------------------------- Quién puede qué --

-- Autorizado: la cuenta está habilitada. Qué usa, lo dice cada membresía.
create or replace function public.esta_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.estado = 'autorizado' from public.perfiles p where p.user_id = auth.uid()),
    false);
$$;

-- Administra la gente de este club (y sigue en él).
create or replace function public.es_admin_de_club(p_equipo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.esta_autorizado()
     and exists (select 1 from public.club_miembros m
                  where m.equipo_id = p_equipo and m.user_id = auth.uid()
                    and m.rol = 'admin' and m.hasta is null);
$$;

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
                          else false end);
$$;

-- Tiene ese módulo en algún club donde sigue (para lo que no es de un club,
-- como la cuenta de Catapult).
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
                          else false end);
$$;

revoke execute on function public.aplicar_invitaciones(uuid) from public, anon, authenticated;
revoke execute on function public.es_admin_de_club(uuid), public.puede_usar_en(uuid, text) from public, anon;
grant execute on function public.es_admin_de_club(uuid), public.puede_usar_en(uuid, text) to authenticated;

-- ------------------------------------------------------------ Vistas --

drop view if exists public.v_mis_clubes;
create view public.v_mis_clubes
with (security_invoker = true)
as
select e.id, e.nombre, e.creado_en, m.desde, m.hasta, m.rol, m.partido, m.flujo, m.lesiones
  from public.equipos e
  left join public.club_miembros m
    on m.equipo_id = e.id and m.user_id = auth.uid()
 order by e.nombre;

-- La gente de un club con su cuenta, para la pantalla Cuentas del club.
drop view if exists public.v_miembros_club;
create view public.v_miembros_club
with (security_invoker = true)
as
select m.equipo_id, m.user_id, m.desde, m.hasta, m.rol, m.partido, m.flujo, m.lesiones,
       m.decidido_en, m.creado_en, p.email, p.estado, p.confirmado_en
  from public.club_miembros m
  join public.perfiles p on p.user_id = m.user_id;

revoke all on public.v_mis_clubes, public.v_miembros_club from anon;
grant select on public.v_mis_clubes, public.v_miembros_club to authenticated;

-- ------------------------------------------------------------ Permisos --

alter table public.club_miembros_historial enable row level security;
alter table public.club_invitaciones enable row level security;
revoke all on table public.club_miembros_historial, public.club_invitaciones from anon, authenticated;
grant select on table public.club_miembros_historial to authenticated;
grant select, insert, update, delete on table public.club_invitaciones to authenticated;

do $$
declare
  politica record;
begin
  for politica in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('perfiles', 'club_miembros', 'club_miembros_historial', 'club_invitaciones',
                         'equipos', 'registros_partido', 'jugadores', 'ajustes', 'entrenamientos',
                         'lesiones', 'lesiones_historial', 'lesiones_campos', 'lesiones_opciones',
                         'catapult_cuentas')
  loop
    execute format('drop policy if exists %I on %I.%I', politica.policyname, politica.schemaname, politica.tablename);
  end loop;
end $$;

-- Cuentas: cada uno ve la suya; el dueño, todas; el admin de un club, las
-- de la gente de su club. Decide solo el dueño, nunca sobre la suya.
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (user_id = (select auth.uid())
         or (select public.es_admin())
         or exists (select 1 from public.club_miembros m
                     where m.user_id = perfiles.user_id and public.es_admin_de_club(m.equipo_id)));

create policy perfiles_decidir on public.perfiles
  for update to authenticated
  using ((select public.es_admin()) and user_id <> (select auth.uid()))
  with check ((select public.es_admin()) and user_id <> (select auth.uid()));

-- Membresías: cada uno ve las suyas; el dueño y el admin del club ven y
-- deciden las del club.
create policy club_miembros_leer on public.club_miembros
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()) or public.es_admin_de_club(equipo_id));

create policy club_miembros_crear on public.club_miembros
  for insert to authenticated
  with check ((select public.es_admin()) or public.es_admin_de_club(equipo_id));

create policy club_miembros_cambiar on public.club_miembros
  for update to authenticated
  using ((select public.es_admin()) or public.es_admin_de_club(equipo_id))
  with check ((select public.es_admin()) or public.es_admin_de_club(equipo_id));

create policy club_miembros_borrar on public.club_miembros
  for delete to authenticated
  using ((select public.es_admin()) or public.es_admin_de_club(equipo_id));

create policy club_miembros_historial_leer on public.club_miembros_historial
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()) or public.es_admin_de_club(equipo_id));

create policy club_invitaciones_todo on public.club_invitaciones
  for all to authenticated
  using ((select public.es_admin()) or public.es_admin_de_club(equipo_id))
  with check ((select public.es_admin()) or public.es_admin_de_club(equipo_id));

-- Clubes: los crea y borra el dueño; los renombra su admin.
create policy equipos_ver on public.equipos
  for select to authenticated
  using ((select public.es_admin()) or public.puede_ver(id));

create policy equipos_crear on public.equipos
  for insert to authenticated
  with check ((select public.es_admin()));

create policy equipos_cambiar on public.equipos
  for update to authenticated
  using ((select public.es_admin()) or public.es_admin_de_club(id))
  with check ((select public.es_admin()) or public.es_admin_de_club(id));

create policy equipos_borrar on public.equipos
  for delete to authenticated
  using ((select public.es_admin()));

-- Partido. Las tablas de datos se leen directo solo estando en el club: quien
-- se fue lee la foto de su último día (datos_al_dia, 20261005).
create policy registros_ver on public.registros_partido
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'partido') and public.puede_editar(equipo_id));

create policy registros_crear on public.registros_partido
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'partido') and public.puede_editar(equipo_id));

create policy registros_cambiar on public.registros_partido
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'partido') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'partido') and public.puede_editar(equipo_id));

create policy registros_borrar on public.registros_partido
  for delete to authenticated
  using (public.puede_usar_en(equipo_id, 'partido') and public.puede_editar(equipo_id));

-- Jugadores: cualquiera que esté en el club.
create policy jugadores_ver on public.jugadores
  for select to authenticated
  using (public.puede_editar(equipo_id));

create policy jugadores_crear on public.jugadores
  for insert to authenticated
  with check (public.puede_editar(equipo_id));

create policy jugadores_cambiar on public.jugadores
  for update to authenticated
  using (public.puede_editar(equipo_id))
  with check (public.puede_editar(equipo_id));

create policy jugadores_borrar on public.jugadores
  for delete to authenticated
  using (public.puede_editar(equipo_id));

-- Ajustes generales (sin club): los lee cualquiera autorizado, los cambia
-- el dueño.
create policy ajustes_ver on public.ajustes
  for select to authenticated
  using ((select public.esta_autorizado()));

create policy ajustes_cambiar on public.ajustes
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- Flujo diario.
create policy entrenamientos_ver on public.entrenamientos
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'flujo') and public.puede_editar(equipo_id));

create policy entrenamientos_crear on public.entrenamientos
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'flujo') and public.puede_editar(equipo_id));

create policy entrenamientos_cambiar on public.entrenamientos
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'flujo') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'flujo') and public.puede_editar(equipo_id));

create policy entrenamientos_borrar on public.entrenamientos
  for delete to authenticated
  using (public.puede_usar_en(equipo_id, 'flujo') and public.puede_editar(equipo_id));

create policy catapult_cuentas_propia on public.catapult_cuentas
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.puede_usar('flujo')))
  with check ((select auth.uid()) = user_id and (select public.puede_usar('flujo')));

-- Lesiones.
create policy lesiones_ver on public.lesiones
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

create policy lesiones_crear on public.lesiones
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

create policy lesiones_cambiar on public.lesiones
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

create policy lesiones_borrar on public.lesiones
  for delete to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

create policy lesiones_historial_ver on public.lesiones_historial
  for select to authenticated
  using (exists (select 1 from public.lesiones l
                  where l.id = lesion_id
                    and public.puede_usar_en(l.equipo_id, 'lesiones')
                    and public.puede_editar(l.equipo_id)));

create policy lesiones_campos_ver on public.lesiones_campos
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_ver(equipo_id));

create policy lesiones_campos_cambiar on public.lesiones_campos
  for all to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

create policy lesiones_opciones_ver on public.lesiones_opciones
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_ver(equipo_id));

create policy lesiones_opciones_cambiar on public.lesiones_opciones
  for all to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

commit;

-- Para ver que quedó bien: administradores y miembros activos por club, y
-- cuántas políticas tiene cada tabla.
select e.nombre,
       count(*) filter (where m.rol = 'admin' and m.hasta is null) as administradores,
       count(*) filter (where m.hasta is null) as activos,
       count(*) filter (where m.hasta is not null) as se_fueron
  from public.equipos e
  left join public.club_miembros m on m.equipo_id = e.id
 group by e.nombre
 order by e.nombre;
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public'
   and tablename in ('perfiles', 'club_miembros', 'club_miembros_historial', 'club_invitaciones', 'equipos',
                     'registros_partido', 'jugadores', 'ajustes', 'entrenamientos', 'lesiones',
                     'lesiones_historial', 'lesiones_campos', 'lesiones_opciones', 'catapult_cuentas')
 group by tablename
 order by tablename;
