-- =====================================================================
-- Cuentas, paso 2: los dueños de la plataforma, los pedidos de acceso y
-- cada club manejado solo por su gente.
--
--   · Dueños: un dueño principal (plataforma, una sola fila) y sub-dueños
--     (plataforma_subduenos). Hacen lo mismo (crear clubes, poner o cambiar
--     el correo de la entidad de un club, ver el panel y los movimientos),
--     menos sumar, quitar o pasar el lugar de dueño: eso, solo el principal.
--     Todo pasa por funciones que revisan quién llama y lo anotan
--     (plataforma_historial). Ninguna política de una tabla los menciona:
--     un dueño no ve gente, datos, historia ni invitaciones de un club donde
--     no está. Del panel ve, por club, nombre, correo de la entidad, correo
--     del administrador y cuánta gente hay.
--   · Pedidos de acceso (club_pedidos): quien no tiene invitación escribe el
--     club al que quiere entrar y espera. Si el nombre es el de un club de
--     la app con administrador, lo decide ese administrador; si no (o si el
--     club se queda sin administrador), los dueños lo mandan a un club con
--     administrador o lo rechazan. La persona ve lo mismo en todos los casos.
--     Dos clubes no se escriben igual (sin contar tildes, mayúsculas ni
--     espacios de más), tampoco al cambiar el nombre.
--   · Se termina la aprobación global: perfiles.admin queda en false para
--     todos (sigue legible: la app de antes la lee hasta que se publique la
--     nueva) y nadie cambia el estado de una cuenta desde la app. Bloquear
--     una cuenta en toda la app queda solo por SQL.
--   · El administrador de un club suma gente (invita como staff, acepta
--     pedidos), da y saca módulos y da de baja, pero no toca a otro
--     administrador ni a sí mismo. A los dueños (el principal y los
--     sub-dueños) nadie los saca de un club ni les cambia los módulos, ni
--     siquiera otro dueño: cada uno se va solo (salir_del_club). Una
--     invitación solo se cancela: no se reabre ni cambia de rol.
--   · Catapult: el token del servidor es de un solo club
--     (plataforma.catapult_equipo). Flujo diario lo usa solo quien tiene
--     Flujo en ese club (mi_cuenta, para el servidor).
--   · Nada para anon en public; authenticated, tabla por tabla, lo justo.
--     Antes del COMMIT se revisa todo y, si algo no da, no queda nada.
--
-- Requiere 20261013_seguridad.sql. Antes de correrla: correr
-- 20261014_revisar_duenos.sql y mirar lo que sale.
--
-- ANTES DE CORRER: completar las tres líneas de "Marcadores" (los correos no
-- van al repositorio). Se corre en Supabase > SQL Editor, entero y de una
-- vez. Es una sola transacción. Se puede volver a correr: los dueños se
-- cargan solo la primera vez (después se cambian desde la app).
-- =====================================================================

begin;

-- ------------------------------------------------------------ Marcadores --
-- Valen solo dentro de esta transacción; no quedan guardados.
--   · El correo del dueño principal (una cuenta que ya existe, con el correo
--     confirmado). Si hoy hay cuentas con perfiles.admin, tiene que ser una.
--   · Los correos de los sub-dueños, separados por coma (vacío = ninguno).
--   · El nombre del club del token de Catapult del servidor
--     (OPENFIELD_API_TOKEN), tal como está en la app. Obligatorio si alguien
--     tiene Flujo diario.
select set_config('app.dueno_principal', 'CORREO_DEL_DUENO_PRINCIPAL', true);
select set_config('app.subduenos', 'CORREOS_DE_SUBDUENOS', true);
select set_config('app.club_catapult', 'NOMBRE_DEL_CLUB_DEL_TOKEN_CATAPULT', true);

-- ---------------------------------------------------------------- Frenos --

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lesiones_historial' and column_name = 'equipo_id') then
    raise exception 'Primero hay que correr 20261013_seguridad.sql.';
  end if;
  if to_regprocedure('public.es_entidad_de(uuid)') is not null then
    raise exception 'Ya está corrida 20261015_entidad_y_admin.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

-- ------------------------------------------------------- Tablas nuevas --
-- Ninguna se lee ni se toca desde la API: solo las funciones de abajo.

-- La plataforma: una sola fila, con el dueño principal y el club del token
-- de Catapult. Borrar la cuenta del principal en Auth falla (restrict).
create table if not exists public.plataforma (
  unica           boolean primary key default true check (unica),
  dueno_principal uuid not null references auth.users (id) on delete restrict,
  catapult_equipo uuid references public.equipos (id) on delete set null,
  cambiado_por    uuid,
  cambiado_en     timestamptz not null default now()
);

comment on table public.plataforma is
  'Una sola fila: el dueño principal de la plataforma y el club del token de Catapult del servidor. El principal se cambia con traspasar_principal; el club, por SQL.';
comment on column public.plataforma.catapult_equipo is
  'El club dueño de OPENFIELD_API_TOKEN: Flujo diario lo usa solo quien tiene Flujo en este club. Se cambia por SQL.';

create table if not exists public.plataforma_subduenos (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  agregado_por uuid references auth.users (id) on delete set null,
  agregado_en  timestamptz not null default now()
);

comment on table public.plataforma_subduenos is
  'Los sub-dueños: hacen lo mismo que el principal menos sumar, quitar o pasar el lugar de dueño.';

-- Lo que hacen los dueños. Sin claves foráneas: queda aunque se borre la
-- cuenta o el club.
create table if not exists public.plataforma_historial (
  id          bigint generated always as identity primary key,
  cuando      timestamptz not null default now(),
  quien       uuid,
  quien_email text not null default '',
  accion      text not null check (accion in ('semilla', 'crear_club', 'entidad', 'sumar_subdueno', 'quitar_subdueno',
                                              'traspaso', 'derivar_pedido', 'rechazar_pedido')),
  equipo_id   uuid,
  objetivo    uuid,
  email       text,
  detalle     jsonb not null default '{}'::jsonb
);

comment on table public.plataforma_historial is
  'Movimientos de los dueños (clubes creados, entidades, dueños, pedidos derivados o rechazados). La escriben las funciones; se lee con panel_historial().';

-- El correo de la entidad de cada club. En este paso es solo un dato: se
-- vincula a una cuenta en el paso 3. Una entidad, un club.
create table if not exists public.club_entidades (
  equipo_id   uuid primary key references public.equipos (id) on delete cascade,
  email       text not null
              check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  asignada_por uuid references auth.users (id) on delete set null,
  asignada_en timestamptz not null default now()
);

create unique index if not exists club_entidades_correo_unico on public.club_entidades (email);

comment on table public.club_entidades is
  'El correo de la entidad de cada club, que cargan los dueños desde el panel. En el paso 2 es solo un dato.';

-- Los pedidos de acceso. equipo_id vacío = el nombre escrito no es el de
-- ningún club de la app con administrador (lo ven los dueños, como los de un
-- club que se quedó sin administrador). Un solo pedido abierto por cuenta.
create table if not exists public.club_pedidos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  email        text not null,
  club_escrito text not null check (char_length(club_escrito) between 1 and 80),
  pais_escrito text check (pais_escrito is null or char_length(pais_escrito) <= 60),
  equipo_id    uuid references public.equipos (id) on delete cascade,
  estado       text not null default 'abierto' check (estado in ('abierto', 'aceptado', 'rechazado', 'cancelado')),
  creado_en    timestamptz not null default now(),
  decidido_por uuid,
  decidido_en  timestamptz,
  derivado_por uuid
);

create unique index if not exists club_pedidos_uno_abierto on public.club_pedidos (user_id) where estado = 'abierto';
create index if not exists club_pedidos_por_club on public.club_pedidos (equipo_id) where estado = 'abierto';

comment on table public.club_pedidos is
  'Pedidos de acceso a un club de quien no tiene invitación. Lo decide el administrador del club; sin club (equipo_id vacío) o con un club sin administrador, los dueños lo derivan o lo rechazan. La persona nunca ve equipo_id.';
comment on column public.club_pedidos.email is 'Copia del correo de la cuenta al pedir (lo ve quien decide).';

alter table public.plataforma enable row level security;
alter table public.plataforma_subduenos enable row level security;
alter table public.plataforma_historial enable row level security;
alter table public.club_entidades enable row level security;
alter table public.club_pedidos enable row level security;
revoke all on table public.plataforma, public.plataforma_subduenos, public.plataforma_historial,
                    public.club_entidades, public.club_pedidos
  from public, anon, authenticated;
revoke all on sequence public.plataforma_historial_id_seq from public, anon, authenticated;

-- La historia de un club suma movimientos que no son de una persona (la
-- entidad que pone un dueño): ahí user_id queda vacío.
alter table public.club_miembros_historial alter column user_id drop not null;

-- ---------------------------------------------------- Funciones internas --
-- Nadie las llama desde la API (EXECUTE revocado más abajo): las usan las
-- funciones de los dueños y de los pedidos.

-- El nombre de un club para compararlo: minúsculas, sin tildes y con un
-- solo espacio entre palabras ("  Atlético  MINEIRO " = "atletico mineiro").
-- Las tildes se sacan antes de pasar a minúsculas, en mayúscula y en
-- minúscula: así no depende del idioma de la base (con el de "C", lower() no
-- toca la "Ó").
create or replace function public.normalizar_nombre_club(p_nombre text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
           lower(translate(coalesce(p_nombre, ''),
                           'áàâãäåéèêëíìîïóòôõöúùûüýÿñçÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝŸÑÇ',
                           'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC')),
           '\s+', ' ', 'g'));
$$;

-- Un dueño cuenta como tal solo con la cuenta autorizada y el correo
-- confirmado.
create or replace function public.es_dueno_principal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pf.estado = 'autorizado' and u.email_confirmed_at is not null
       from public.plataforma p
       join public.perfiles pf on pf.user_id = p.dueno_principal
       join auth.users u on u.id = p.dueno_principal
      where p.dueno_principal = auth.uid()),
    false);
$$;

create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pf.estado = 'autorizado' and u.email_confirmed_at is not null
       from public.perfiles pf
       join auth.users u on u.id = pf.user_id
      where pf.user_id = auth.uid()
        and (exists (select 1 from public.plataforma p where p.dueno_principal = pf.user_id)
             or exists (select 1 from public.plataforma_subduenos s where s.user_id = pf.user_id))),
    false);
$$;

-- El club tiene administrador: alguien con rol admin que sigue en el club y
-- tiene la cuenta autorizada (como lo pide es_admin_de_club). Los pedidos a
-- un club sin administrador los ven los dueños.
create or replace function public.club_tiene_admin(p_equipo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.club_miembros m
                   join public.perfiles pf on pf.user_id = m.user_id
                  where m.equipo_id = p_equipo and m.rol = 'admin' and m.hasta is null
                    and pf.estado = 'autorizado');
$$;

-- Anota un movimiento de los dueños, con quién y cuándo.
create or replace function public.plataforma_anotar(p_accion text, p_equipo uuid, p_objetivo uuid, p_email text,
                                                    p_detalle jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.plataforma_historial (quien, quien_email, accion, equipo_id, objetivo, email, detalle)
  values (auth.uid(),
          coalesce((select pf.email from public.perfiles pf where pf.user_id = auth.uid()), ''),
          p_accion, p_equipo, p_objetivo, p_email, coalesce(p_detalle, '{}'::jsonb));
$$;

-- ------------------------------------------------------- Disparadores --

-- La plataforma siempre tiene un principal: la fila no se borra ni se
-- vacía, y el principal nuevo tiene que estar autorizado y confirmado.
create or replace function public.plataforma_cuidar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'dueno_principal' using errcode = 'P0001',
      hint = 'La plataforma siempre tiene un dueño principal: se pasa con traspasar_principal.';
  end if;
  if not exists (select 1 from public.perfiles pf join auth.users u on u.id = pf.user_id
                  where pf.user_id = new.dueno_principal and pf.estado = 'autorizado'
                    and u.email_confirmed_at is not null) then
    raise exception 'dueno_principal_invalido' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists plataforma_cuidar on public.plataforma;
create trigger plataforma_cuidar
  before delete or update of dueno_principal on public.plataforma
  for each row execute function public.plataforma_cuidar();

drop trigger if exists plataforma_sin_vaciar on public.plataforma;
create trigger plataforma_sin_vaciar
  before truncate on public.plataforma
  for each statement execute function public.plataforma_cuidar();

-- El principal no deja de estar autorizado (ni por SQL): para bloquear esa
-- cuenta, primero pasa su lugar. Espera a un traspaso que esté en curso.
create or replace function public.perfiles_proteger_principal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_principal uuid;
begin
  if old.estado = 'autorizado' and new.estado is distinct from 'autorizado' then
    select p.dueno_principal into v_principal from public.plataforma p for update;
    if v_principal = new.user_id then
      raise exception 'dueno_principal' using errcode = 'P0001',
        hint = 'Es el dueño principal de la plataforma: primero tiene que pasar su lugar.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_proteger_principal on public.perfiles;
create trigger perfiles_proteger_principal
  before update of estado on public.perfiles
  for each row execute function public.perfiles_proteger_principal();

-- Quién decidió y cuándo (la de 20261004), y además: con una sesión, la
-- fecha de entrada cambia solo al reincorporar (que queda en la historia);
-- si no, sigue la que estaba. La de creación no se toca desde la API.
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
  if tg_op = 'UPDATE' and auth.uid() is not null and not (old.hasta is not null and new.hasta is null) then
    new.desde := old.desde;
  end if;
  new.decidido_por := coalesce(auth.uid(), new.decidido_por);
  new.decidido_en := now();
  return new;
end;
$$;

-- A un dueño (el principal o un sub-dueño) nadie lo saca de un club ni le
-- cambia el rol, los módulos ni las fechas, ni siquiera otro dueño: solo él
-- se va (salir_del_club). Volver también lo decide él: otro lo reincorpora
-- solo con aceptar_pedido, sobre un pedido suyo a ese club (aceptado en esa
-- misma operación); una invitación de otro no lo mete
-- (club_invitaciones_aplicar). Sin sesión (el SQL Editor), no frena. Un
-- sub-dueño que deja de serlo (quitar_subdueno) pasa a ser uno más del club.
-- Reemplaza a club_miembros_proteger_principal, que cuidaba solo al
-- principal.
drop trigger if exists club_miembros_proteger_principal on public.club_miembros;
drop function if exists public.club_miembros_proteger_principal();

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
     or (new.partido, new.flujo, new.lesiones, new.evaluaciones)
        is distinct from (old.partido, old.flujo, old.lesiones, old.evaluaciones) then
    raise exception 'dueno_protegido' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists club_miembros_proteger_duenos on public.club_miembros;
create trigger club_miembros_proteger_duenos
  before update or delete on public.club_miembros
  for each row execute function public.club_miembros_proteger_duenos();

-- Un club no queda sin un administrador activo. Cuenta solo los que pueden
-- actuar: un administrador con la cuenta bloqueada no sirve de reemplazo.
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
                       join public.perfiles p on p.user_id = m.user_id
                      where m.equipo_id = old.equipo_id and m.user_id <> old.user_id
                        and m.rol = 'admin' and m.hasta is null and p.estado = 'autorizado') then
    raise exception 'ultimo_admin' using errcode = 'P0001',
      hint = 'El club tiene que quedar con otro administrador habilitado.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Las invitaciones (la de 20261012): a quien ya está en el club no le
-- cambian nada (ni rol ni módulos: un administrador no toca a otro por esta
-- vía); quien se había ido vuelve con lo que dice la invitación. Si la
-- cuenta tenía un pedido abierto a ese club, queda resuelto.
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
      set desde = current_date, hasta = null, rol = excluded.rol, partido = excluded.partido,
          flujo = excluded.flujo, lesiones = excluded.lesiones,
          evaluaciones = excluded.evaluaciones, decidido_por = excluded.decidido_por
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

-- Si la cuenta invitada ya existe (y confirmó el correo), entra en el acto
-- (la de 20261004). Menos un dueño de la app invitado por otro: a un club
-- entra solo si lo pide él (un pedido de acceso). Su invitación queda
-- abierta, como la de un correo sin cuenta: así invitar no sirve para
-- averiguar quién es dueño (protegido) ni para meterlo en un club.
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
  if v_user is null then
    return new;
  end if;
  if auth.uid() is not null and auth.uid() <> v_user
     and (exists (select 1 from public.plataforma p where p.dueno_principal = v_user)
          or exists (select 1 from public.plataforma_subduenos s where s.user_id = v_user)) then
    return new;
  end if;
  perform public.aplicar_invitaciones(v_user);
  return new;
end;
$$;

-- Las invitaciones al cambiarlas (la de 20261013), y además: una cancelada
-- no se vuelve a abrir (ni por SQL) y el rol no se cambia con una sesión (un
-- administrador invita solo como staff).
create or replace function public.club_invitaciones_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.email := lower(btrim(new.email));
    if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'correo_invalido' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
  else
    if old.cancelada_en is not null and new.cancelada_en is null then
      raise exception 'invitacion_cancelada' using errcode = 'P0001';
    end if;
    if new.rol is distinct from old.rol and auth.uid() is not null then
      raise exception 'invitacion_rol_fijo' using errcode = 'P0001';
    end if;
    new.creado_por := case when exists (select 1 from auth.users u where u.id = old.creado_por) then old.creado_por end;
    new.creado_en := old.creado_en;
  end if;
  return new;
end;
$$;

-- Las invitaciones abiertas como administrador (de antes de que se invitara
-- solo como staff) pasan a staff. Cuántas, se ve al final.
do $$
declare
  v_cuantas integer;
begin
  update public.club_invitaciones i
     set rol = 'staff'
   where i.rol = 'admin' and i.usada_en is null and i.cancelada_en is null and i.vence_en > now();
  get diagnostics v_cuantas = row_count;
  perform set_config('app.invitaciones_a_staff', v_cuantas::text, false);
end $$;

-- Dos clubes no se escriben igual (sin contar tildes, mayúsculas ni espacios
-- de más), tampoco al cambiar el nombre: un pedido de acceso no sabría a
-- cuál ir. Las mismas reglas que crear_club. Mira todos los clubes, también
-- los que quien cambia el nombre no ve.
create or replace function public.equipos_nombre_sin_repetir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(regexp_replace(coalesce(new.nombre, ''), '\s+', ' ', 'g'));
  v_normalizado text := public.normalizar_nombre_club(new.nombre);
begin
  if v_nombre = '' or char_length(v_nombre) > 60 then
    raise exception 'nombre_invalido' using errcode = 'P0001';
  end if;
  -- Dos clubes nuevos (o renombrados) con el mismo nombre a la vez: uno
  -- espera al otro.
  perform pg_advisory_xact_lock(hashtext('nombre_de_club:' || v_normalizado));
  if exists (select 1 from public.equipos e
              where e.id <> new.id and public.normalizar_nombre_club(e.nombre) = v_normalizado) then
    raise exception 'nombre_repetido' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Si hoy ya hay clubes que se escriben igual, no se sigue: primero hay que
-- cambiarle el nombre a uno (por SQL) y volver a correr esto.
do $$
declare
  v_repetidos text;
begin
  select string_agg(g.nombres, '; ' order by g.nombres) into v_repetidos
    from (select string_agg(e.nombre, ' = ' order by e.nombre) as nombres
            from public.equipos e
           group by public.normalizar_nombre_club(e.nombre)
          having count(*) > 1) g;
  if v_repetidos is not null then
    raise exception 'Hay clubes que se escriben igual (sin contar tildes, mayúsculas ni espacios): %. Cambiale el nombre a uno y volvé a correr esto.', v_repetidos;
  end if;
end $$;

drop trigger if exists equipos_nombre_sin_repetir on public.equipos;
create trigger equipos_nombre_sin_repetir
  before insert or update of nombre on public.equipos
  for each row execute function public.equipos_nombre_sin_repetir();

-- ---------------------------------------------------------------- Semilla --
-- Solo la primera vez (con plataforma vacía). Después los dueños se cambian
-- desde la app, y el club de Catapult, por SQL.
--
-- Los marcadores se comparan contra su texto armado en partes: así ni el
-- reemplazo de correr.sh ni un "reemplazar todo" del editor (que no
-- distingue mayúsculas) pisan la comparación.
do $$
declare
  v_principal_correo text := lower(btrim(coalesce(current_setting('app.dueno_principal', true), '')));
  v_subs_texto text := lower(coalesce(current_setting('app.subduenos', true), ''));
  v_club_texto text := btrim(coalesce(current_setting('app.club_catapult', true), ''));
  v_principal uuid;
  v_correo text;
  v_sub uuid;
  v_subs uuid[] := '{}';
  v_subs_correos text[] := '{}';
  v_club uuid;
  v_cuantos integer;
  v_estado text;
  v_confirmado timestamptz;
begin
  if exists (select 1 from public.plataforma) then
    raise notice 'La plataforma ya tiene dueño principal: los marcadores no se usan. Los dueños se cambian desde la app (Clubes de la app).';
    return;
  end if;

  -- a. El dueño principal: obligatorio, con el correo confirmado y sin bloquear.
  if v_principal_correo in ('', 'correo_del_' || 'dueno_principal') then
    raise exception 'Falta el correo del dueño principal: completalo en la primera línea de Marcadores.';
  end if;
  select u.id, u.email_confirmed_at, pf.estado into v_principal, v_confirmado, v_estado
    from auth.users u
    left join public.perfiles pf on pf.user_id = u.id
   where lower(btrim(u.email)) = v_principal_correo
   limit 1;
  if v_principal is null then
    raise exception 'No hay ninguna cuenta con el correo %. Creala primero desde la app (y confirmá el correo).', v_principal_correo;
  end if;
  if v_confirmado is null then
    raise exception 'La cuenta % todavía no confirmó el correo: confirmalo y volvé a correr esto.', v_principal_correo;
  end if;
  if v_estado = 'bloqueado' then
    raise exception 'La cuenta % está bloqueada: no puede ser el dueño principal.', v_principal_correo;
  end if;

  -- b. Contra un error de tipeo: si hoy hay dueños (perfiles.admin), el
  -- principal es uno de ellos.
  if exists (select 1 from public.perfiles pf where pf.admin)
     and not exists (select 1 from public.perfiles pf where pf.admin and pf.user_id = v_principal) then
    raise exception 'El dueño principal tiene que ser una de las cuentas que hoy son dueñas de la app: %.',
      (select string_agg(pf.email, ', ' order by pf.email) from public.perfiles pf where pf.admin);
  end if;

  -- c. Los sub-dueños: cada uno, confirmado, sin bloquear y distinto del
  -- principal.
  foreach v_correo in array coalesce(string_to_array(regexp_replace(v_subs_texto, '\s', '', 'g'), ','), '{}') loop
    continue when v_correo = '' or v_correo = 'correos_de_' || 'subduenos';
    v_sub := null;
    v_confirmado := null;
    v_estado := null;
    select u.id, u.email_confirmed_at, pf.estado into v_sub, v_confirmado, v_estado
      from auth.users u
      left join public.perfiles pf on pf.user_id = u.id
     where lower(btrim(u.email)) = v_correo
     limit 1;
    if v_sub is null then
      raise exception 'No hay ninguna cuenta con el correo % (sub-dueño). Creala primero desde la app (y confirmá el correo).', v_correo;
    end if;
    if v_confirmado is null then
      raise exception 'La cuenta % (sub-dueño) todavía no confirmó el correo.', v_correo;
    end if;
    if v_estado = 'bloqueado' then
      raise exception 'La cuenta % (sub-dueño) está bloqueada.', v_correo;
    end if;
    if v_sub = v_principal then
      raise exception 'El correo % es el del dueño principal: no va también como sub-dueño.', v_correo;
    end if;
    if not v_sub = any (v_subs) then
      v_subs := v_subs || v_sub;
      v_subs_correos := v_subs_correos || v_correo;
    end if;
  end loop;

  -- d. El club del token de Catapult: por su nombre (sin importar
  -- mayúsculas, tildes ni espacios). Obligatorio si alguien tiene Flujo.
  if v_club_texto = '' or lower(v_club_texto) = ('nombre_del_club_' || 'del_token_catapult') then
    if exists (select 1 from public.club_miembros m where m.flujo and m.hasta is null) then
      raise exception 'Falta el nombre del club del token de Catapult (hay cuentas con Flujo diario). Los clubes que hay: %.',
        (select string_agg(e.nombre, ', ' order by e.nombre) from public.equipos e);
    end if;
  else
    select (array_agg(e.id))[1], count(*) into v_club, v_cuantos
      from public.equipos e
     where public.normalizar_nombre_club(e.nombre) = public.normalizar_nombre_club(v_club_texto);
    if v_cuantos <> 1 then
      raise exception 'No hay un único club que se llame "%". Los clubes que hay: %.', v_club_texto,
        (select string_agg(e.nombre, ', ' order by e.nombre) from public.equipos e);
    end if;
  end if;

  -- e. Los dueños quedan autorizados (si estaban pendientes) y se anota.
  update public.perfiles set estado = 'autorizado'
   where user_id = any (v_subs || v_principal) and estado = 'pendiente';
  insert into public.plataforma (dueno_principal, catapult_equipo) values (v_principal, v_club);
  insert into public.plataforma_subduenos (user_id) select unnest(v_subs) on conflict do nothing;
  insert into public.plataforma_historial (accion, equipo_id, objetivo, email, detalle)
  values ('semilla', v_club, v_principal, v_principal_correo,
          jsonb_build_object('subduenos', to_jsonb(v_subs_correos), 'catapult_equipo', v_club));
end $$;

-- Ya no da ningún permiso (lo leía es_admin): queda en false para todos. La
-- app de antes la sigue leyendo hasta que se publique la nueva.
update public.perfiles set admin = false where admin;

comment on column public.perfiles.admin is
  'Obsoleta (20261014): en false para todos y sin efecto. Los dueños están en plataforma y plataforma_subduenos.';

-- ------------------------------------------------------- Mi cuenta --

-- Flujo diario del servidor: el token de Catapult es de un solo club; lo usa
-- quien tiene Flujo en ese club, hoy.
create or replace function public.puede_usar_catapult_servidor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.esta_autorizado()
     and exists (select 1 from public.plataforma p
                   join public.club_miembros m on m.equipo_id = p.catapult_equipo
                  where m.user_id = auth.uid() and m.hasta is null and m.flujo);
$$;

-- Todo lo que el servidor y la app necesitan saber de quien llama, en una
-- sola consulta. tecnico (las pruebas técnicas de Catapult): el dueño
-- principal, con Flujo en el club del token.
create or replace function public.mi_cuenta()
returns table (estado text, dueno text, flujo boolean, catapult boolean, tecnico boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pf.estado from public.perfiles pf where pf.user_id = auth.uid()), 'pendiente'),
         case when public.es_dueno_principal() then 'principal'
              when public.es_dueno() then 'sub' end,
         public.puede_usar('flujo'),
         public.puede_usar_catapult_servidor(),
         public.es_dueno_principal() and public.puede_usar_catapult_servidor();
$$;

-- ----------------------------------------------------- El panel de dueños --
-- Todas empiezan bloqueando la fila de plataforma: así lo que hacen dos
-- dueños a la vez (o un traspaso y un bloqueo) queda en fila.

-- Por club, solo nombre, correo de la entidad, correo del administrador
-- (activo y habilitado) y cuánta gente hay (activa y habilitada).
create or replace function public.panel_clubes()
returns table (equipo_id uuid, nombre text, correo_entidad text, correo_admin text, personas integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  return query
    select e.id, e.nombre, ce.email,
           (select string_agg(pf.email, ', ' order by pf.email)
              from public.club_miembros m
              join public.perfiles pf on pf.user_id = m.user_id
             where m.equipo_id = e.id and m.rol = 'admin' and m.hasta is null and pf.estado = 'autorizado'),
           (select count(*)::integer
              from public.club_miembros m
              join public.perfiles pf on pf.user_id = m.user_id
             where m.equipo_id = e.id and m.hasta is null and pf.estado = 'autorizado')
      from public.equipos e
      left join public.club_entidades ce on ce.equipo_id = e.id
     order by lower(e.nombre), e.id;
end;
$$;

create or replace function public.panel_duenos()
returns table (user_id uuid, email text, principal boolean, es_mia boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  return query
    select d.id, coalesce(nullif(pf.email, ''), lower(u.email)), d.es_principal, d.id = auth.uid()
      from (select p.dueno_principal as id, true as es_principal from public.plataforma p
            union all
            select s.user_id, false from public.plataforma_subduenos s) d
      left join public.perfiles pf on pf.user_id = d.id
      left join auth.users u on u.id = d.id
     order by 3 desc, 2;
end;
$$;

-- Movimientos: lo más nuevo primero.
create or replace function public.panel_historial(p_limite integer default 50)
returns setof public.plataforma_historial
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  return query
    select h.*
      from public.plataforma_historial h
     order by h.cuando desc, h.id desc
     limit least(greatest(coalesce(p_limite, 50), 1), 500);
end;
$$;

-- Un club nuevo, vacío: quien lo crea no queda adentro. Si viene el correo
-- de la entidad, pasa por las mismas reglas que asignar_entidad.
create or replace function public.crear_club(p_nombre text, p_correo_entidad text default null,
                                             p_zona text default 'America/Sao_Paulo')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_zona text := coalesce(nullif(btrim(p_zona), ''), 'America/Sao_Paulo');
  v_id uuid;
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  if v_nombre = '' or char_length(v_nombre) > 60 then
    raise exception 'nombre_invalido' using errcode = 'P0001';
  end if;
  -- Dos clubes que se escriben igual (sin contar tildes ni mayúsculas) no:
  -- un pedido de acceso no sabría a cuál ir.
  if exists (select 1 from public.equipos e
              where public.normalizar_nombre_club(e.nombre) = public.normalizar_nombre_club(v_nombre)) then
    raise exception 'nombre_repetido' using errcode = 'P0001';
  end if;
  begin
    insert into public.equipos (nombre, zona_horaria) values (v_nombre, v_zona) returning id into v_id;
  exception when unique_violation then
    raise exception 'nombre_repetido' using errcode = 'P0001';
  end;
  perform public.plataforma_anotar('crear_club', v_id, null, null,
                                   jsonb_build_object('nombre', v_nombre, 'zona_horaria', v_zona));
  if btrim(coalesce(p_correo_entidad, '')) <> '' then
    perform public.asignar_entidad(v_id, p_correo_entidad);
  end if;
  return v_id;
end;
$$;

-- Pone, cambia o saca (vacío) el correo de la entidad de un club. Ningún
-- dueño puede ser entidad, y una entidad es de un solo club. Queda en los
-- movimientos de los dueños y en la historia del club.
create or replace function public.asignar_entidad(p_equipo uuid, p_correo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_antes text;
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  if p_equipo is null or not exists (select 1 from public.equipos e where e.id = p_equipo) then
    raise exception 'club_inexistente' using errcode = 'P0001';
  end if;
  select ce.email into v_antes from public.club_entidades ce where ce.equipo_id = p_equipo for update;

  if v_correo = '' then
    if v_antes is null then
      return;
    end if;
    delete from public.club_entidades ce where ce.equipo_id = p_equipo;
  else
    if v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'correo_invalido' using errcode = 'P0001';
    end if;
    -- Que agregar_subdueno con el mismo correo espere (o espere a esta).
    perform pg_advisory_xact_lock(hashtext(v_correo));
    if v_correo = v_antes then
      return;
    end if;
    if exists (select 1 from auth.users u
                where lower(btrim(u.email)) = v_correo
                  and (exists (select 1 from public.plataforma p where p.dueno_principal = u.id)
                       or exists (select 1 from public.plataforma_subduenos s where s.user_id = u.id))) then
      raise exception 'entidad_es_dueno' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.club_entidades ce where ce.email = v_correo and ce.equipo_id <> p_equipo) then
      raise exception 'entidad_repetida' using errcode = 'P0001';
    end if;
    begin
      insert into public.club_entidades (equipo_id, email, asignada_por, asignada_en)
      values (p_equipo, v_correo, auth.uid(), now())
      on conflict (equipo_id) do update
        set email = excluded.email, asignada_por = excluded.asignada_por, asignada_en = excluded.asignada_en;
    exception when unique_violation then
      raise exception 'entidad_repetida' using errcode = 'P0001';
    end;
  end if;

  perform public.plataforma_anotar('entidad', p_equipo, null, nullif(v_correo, ''),
                                   jsonb_build_object('antes', v_antes, 'despues', nullif(v_correo, '')));
  -- En la historia del club, sin quién fue: diría qué cuenta es dueña a un
  -- administrador que no comparte club con ella (quién fue lo ven solo los
  -- dueños, en sus movimientos).
  insert into public.club_miembros_historial (equipo_id, user_id, accion, detalle, quien, quien_email)
  values (p_equipo, null, 'entidad', jsonb_build_object('email', nullif(v_correo, ''), 'antes', v_antes), null, '');
end;
$$;

-- ------------------------------------------------ Los dueños (principal) --

create or replace function public.agregar_subdueno(p_correo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_user uuid;
  v_confirmado timestamptz;
  v_estado text;
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno_principal() then
    raise exception 'solo_dueno_principal' using errcode = '42501';
  end if;
  -- Que asignar_entidad con el mismo correo espere (o espere a esta).
  perform pg_advisory_xact_lock(hashtext(v_correo));
  select u.id, u.email_confirmed_at, pf.estado into v_user, v_confirmado, v_estado
    from auth.users u
    left join public.perfiles pf on pf.user_id = u.id
   where v_correo <> '' and lower(btrim(u.email)) = v_correo
   limit 1;
  if v_user is null then
    raise exception 'cuenta_inexistente' using errcode = 'P0001';
  end if;
  if v_confirmado is null then
    raise exception 'correo_sin_confirmar' using errcode = 'P0001';
  end if;
  if v_estado = 'bloqueado' then
    raise exception 'cuenta_bloqueada' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.plataforma p where p.dueno_principal = v_user)
     or exists (select 1 from public.plataforma_subduenos s where s.user_id = v_user) then
    raise exception 'ya_es_dueno' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.club_entidades ce where ce.email = v_correo) then
    raise exception 'es_entidad' using errcode = 'P0001';
  end if;
  update public.perfiles set estado = 'autorizado' where user_id = v_user and estado = 'pendiente';
  insert into public.plataforma_subduenos (user_id, agregado_por) values (v_user, auth.uid());
  perform public.plataforma_anotar('sumar_subdueno', null, v_user, v_correo);
  return v_user;
end;
$$;

create or replace function public.quitar_subdueno(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correo text;
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno_principal() then
    raise exception 'solo_dueno_principal' using errcode = '42501';
  end if;
  if exists (select 1 from public.plataforma p where p.dueno_principal = p_user) then
    raise exception 'dueno_principal' using errcode = 'P0001';
  end if;
  delete from public.plataforma_subduenos s where s.user_id = p_user;
  if not found then
    raise exception 'no_es_subdueno' using errcode = 'P0001';
  end if;
  select pf.email into v_correo from public.perfiles pf where pf.user_id = p_user;
  perform public.plataforma_anotar('quitar_subdueno', null, p_user, v_correo);
end;
$$;

-- Pasa el lugar de principal a un sub-dueño; el que lo pasa queda como
-- sub-dueño.
create or replace function public.traspasar_principal(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := auth.uid();
  v_estado text;
  v_confirmado timestamptz;
  v_correo text;
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno_principal() then
    raise exception 'solo_dueno_principal' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plataforma_subduenos s where s.user_id = p_user) then
    raise exception 'no_es_subdueno' using errcode = 'P0001';
  end if;
  -- La cuenta del nuevo principal, quieta hasta el final (que nadie la
  -- bloquee en el medio).
  select pf.estado, pf.email into v_estado, v_correo from public.perfiles pf where pf.user_id = p_user for update;
  select u.email_confirmed_at into v_confirmado from auth.users u where u.id = p_user;
  if v_estado = 'bloqueado' then
    raise exception 'cuenta_bloqueada' using errcode = 'P0001';
  end if;
  if v_confirmado is null then
    raise exception 'correo_sin_confirmar' using errcode = 'P0001';
  end if;
  update public.plataforma
     set dueno_principal = p_user, cambiado_por = v_yo, cambiado_en = now()
   where dueno_principal = v_yo;
  if not found then
    raise exception 'solo_dueno_principal' using errcode = '42501';
  end if;
  delete from public.plataforma_subduenos s where s.user_id = p_user;
  insert into public.plataforma_subduenos (user_id, agregado_por) values (v_yo, v_yo)
  on conflict (user_id) do nothing;
  perform public.plataforma_anotar('traspaso', null, p_user, v_correo);
end;
$$;

-- --------------------------------------- Pedidos sin club (los dueños) --

-- Los pedidos abiertos que no coinciden con ningún club de la app, o cuyo
-- club hoy no tiene administrador (nadie más los decidiría).
create or replace function public.pedidos_sin_club()
returns table (id uuid, email text, club_escrito text, pais_escrito text, creado_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  return query
    select cp.id, cp.email, cp.club_escrito, cp.pais_escrito, cp.creado_en
      from public.club_pedidos cp
     where cp.estado = 'abierto' and (cp.equipo_id is null or not public.club_tiene_admin(cp.equipo_id))
     order by cp.creado_en, cp.id;
end;
$$;

-- Lo manda a un club con administrador: desde ahí lo decide ese
-- administrador (los dueños nunca aceptan gente).
create or replace function public.derivar_pedido(p_id uuid, p_equipo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.club_pedidos;
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  select * into v_pedido from public.club_pedidos cp where cp.id = p_id for update;
  if not found or v_pedido.estado <> 'abierto'
     or (v_pedido.equipo_id is not null and public.club_tiene_admin(v_pedido.equipo_id)) then
    raise exception 'pedido_cerrado' using errcode = 'P0001';
  end if;
  if p_equipo is null or not exists (select 1 from public.equipos e where e.id = p_equipo) then
    raise exception 'club_inexistente' using errcode = 'P0001';
  end if;
  if not public.club_tiene_admin(p_equipo) then
    raise exception 'club_sin_admin' using errcode = 'P0001';
  end if;
  update public.club_pedidos set equipo_id = p_equipo, derivado_por = auth.uid() where id = p_id;
  perform public.plataforma_anotar('derivar_pedido', p_equipo, v_pedido.user_id, v_pedido.email,
                                   jsonb_build_object('pedido', p_id, 'club_escrito', v_pedido.club_escrito,
                                                      'pais_escrito', v_pedido.pais_escrito,
                                                      'club_antes', v_pedido.equipo_id));
end;
$$;

create or replace function public.rechazar_pedido_sin_club(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.club_pedidos;
begin
  perform 1 from public.plataforma for update;
  if not public.es_dueno() then
    raise exception 'solo_duenos' using errcode = '42501';
  end if;
  select * into v_pedido from public.club_pedidos cp where cp.id = p_id for update;
  if not found or v_pedido.estado <> 'abierto'
     or (v_pedido.equipo_id is not null and public.club_tiene_admin(v_pedido.equipo_id)) then
    raise exception 'pedido_cerrado' using errcode = 'P0001';
  end if;
  update public.club_pedidos set estado = 'rechazado', decidido_por = auth.uid(), decidido_en = now() where id = p_id;
  perform public.plataforma_anotar('rechazar_pedido', null, v_pedido.user_id, v_pedido.email,
                                   jsonb_build_object('pedido', p_id, 'club_escrito', v_pedido.club_escrito,
                                                      'pais_escrito', v_pedido.pais_escrito));
end;
$$;

-- -------------------------------------------- Pedidos (quien pide entrar) --

-- Pide entrar a un club escribiendo su nombre. Devuelve solo el id: nunca si
-- el club usa la app (ni si ya estaba adentro).
create or replace function public.pedir_acceso(p_club text, p_pais text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_confirmado timestamptz;
  v_club text := btrim(regexp_replace(coalesce(p_club, ''), '\s+', ' ', 'g'));
  v_pais text := left(nullif(btrim(regexp_replace(coalesce(p_pais, ''), '\s+', ' ', 'g')), ''), 60);
  v_nombre text;
  v_equipo uuid;
  v_cuantos integer;
  v_id uuid;
begin
  select lower(btrim(u.email)), u.email_confirmed_at into v_email, v_confirmado
    from auth.users u where u.id = v_user;
  if v_user is null or v_confirmado is null or coalesce(v_email, '') = '' then
    raise exception 'correo_sin_confirmar' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.perfiles pf where pf.user_id = v_user and pf.estado = 'bloqueado') then
    raise exception 'cuenta_bloqueada' using errcode = 'P0001';
  end if;
  v_nombre := public.normalizar_nombre_club(v_club);
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'club_invalido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.club_pedidos cp where cp.user_id = v_user and cp.estado = 'abierto') then
    raise exception 'ya_hay_un_pedido' using errcode = 'P0001';
  end if;
  -- Un solo club con ese nombre y con administrador: va a ese. Ninguno, más
  -- de uno (por algún nombre viejo) o un club sin administrador: a los
  -- dueños.
  select (array_agg(e.id))[1], count(*) into v_equipo, v_cuantos
    from public.equipos e
   where public.normalizar_nombre_club(e.nombre) = v_nombre;
  if v_cuantos <> 1 or not public.club_tiene_admin(v_equipo) then
    v_equipo := null;
  end if;
  begin
    insert into public.club_pedidos (user_id, email, club_escrito, pais_escrito, equipo_id)
    values (v_user, v_email, v_club, v_pais, v_equipo)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya_hay_un_pedido' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

-- Los pedidos propios, el más nuevo primero. Sin el club al que fue.
create or replace function public.mis_pedidos()
returns table (id uuid, club_escrito text, pais_escrito text, estado text, creado_en timestamptz, decidido_en timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.id, cp.club_escrito, cp.pais_escrito, cp.estado, cp.creado_en, cp.decidido_en
    from public.club_pedidos cp
   where cp.user_id = auth.uid()
   order by cp.creado_en desc, cp.id;
$$;

create or replace function public.cancelar_pedido(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.club_pedidos cp
     set estado = 'cancelado', decidido_por = auth.uid(), decidido_en = now()
   where cp.id = p_id and cp.user_id = auth.uid() and cp.estado = 'abierto';
  if not found then
    raise exception 'pedido_cerrado' using errcode = 'P0001';
  end if;
end;
$$;

-- ------------------------------------- Pedidos (el administrador del club) --

create or replace function public.pedidos_del_club(p_equipo uuid)
returns table (id uuid, email text, creado_en timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin_de_club(p_equipo) then
    raise exception 'solo_admin' using errcode = '42501';
  end if;
  return query
    select cp.id, cp.email, cp.creado_en
      from public.club_pedidos cp
     where cp.equipo_id = p_equipo and cp.estado = 'abierto'
     order by cp.creado_en, cp.id;
end;
$$;

-- Acepta un pedido: la cuenta entra como staff con esos módulos (o vuelve,
-- si se había ido; si ya está, no se toca) y queda autorizada.
create or replace function public.aceptar_pedido(p_id uuid, p_partido boolean, p_flujo boolean,
                                                 p_lesiones boolean, p_evaluaciones boolean)
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
  insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones)
  values (v_pedido.equipo_id, v_pedido.user_id, current_date, null, 'staff', coalesce(p_partido, false),
          coalesce(p_flujo, false), coalesce(p_lesiones, false), coalesce(p_evaluaciones, false))
  on conflict (equipo_id, user_id) do update
    set desde = current_date, hasta = null, rol = 'staff', partido = excluded.partido, flujo = excluded.flujo,
        lesiones = excluded.lesiones, evaluaciones = excluded.evaluaciones
    where public.club_miembros.hasta is not null;
  update public.perfiles set estado = 'autorizado' where user_id = v_pedido.user_id and estado = 'pendiente';
end;
$$;

-- Rechazado: sale de la lista del club y la persona puede volver a pedir.
create or replace function public.rechazar_pedido(p_id uuid)
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
  update public.club_pedidos set estado = 'rechazado', decidido_por = auth.uid(), decidido_en = now() where id = p_id;
end;
$$;

-- ---------------------------------------------------- Irse de un club --

-- Quien llama se va de un club donde está (su último día es hoy). Es la
-- única forma de que un dueño (el principal o un sub-dueño) salga de un
-- club. Un club no queda sin administrador (club_miembros_ultimo_admin).
create or replace function public.salir_del_club(p_equipo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.club_miembros m
     set hasta = current_date
   where m.equipo_id = p_equipo and m.user_id = auth.uid() and m.hasta is null;
  if not found then
    raise exception 'no_es_miembro_activo' using errcode = 'P0001';
  end if;
end;
$$;

-- --------------------------------------- La gente del club: los dueños --

-- Si una cuenta es dueña de la app (el principal o un sub-dueño), para que
-- Cuentas muestre su fila sin acciones (club_miembros_proteger_duenos la
-- frena igual). Responde solo por quien está o estuvo en un club donde
-- quien pregunta está o estuvo; por cualquier otra cuenta, false.
create or replace function public.miembro_protegido(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.club_miembros suyo
                   join public.club_miembros mio on mio.equipo_id = suyo.equipo_id
                  where suyo.user_id = p_user and mio.user_id = auth.uid())
     and (exists (select 1 from public.plataforma p where p.dueno_principal = p_user)
          or exists (select 1 from public.plataforma_subduenos s where s.user_id = p_user));
$$;

-- La gente de un club (la de 20261012), con protegido al final (create or
-- replace view no deja cambiar el orden de las columnas).
create or replace view public.v_miembros_club
with (security_invoker = true)
as
select m.equipo_id, m.user_id, m.desde, m.hasta, m.rol, m.partido, m.flujo, m.lesiones,
       m.decidido_en, m.creado_en, p.email, p.estado, p.confirmado_en, m.evaluaciones,
       public.miembro_protegido(m.user_id) as protegido
  from public.club_miembros m
  join public.perfiles p on p.user_id = m.user_id;

-- ------------------------------------------------ Lo que deja de existir --

-- Los clubes los crea crear_club, sin sumar a nadie.
drop trigger if exists equipos_sumar_creador on public.equipos;
drop function if exists public.equipos_sumar_creador();

-- --------------------------------------------------------------- Políticas --
-- Se sacan todas las de estas tablas y se crean las de ahora: ninguna
-- menciona a los dueños.
do $$
declare
  politica record;
begin
  for politica in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('perfiles', 'club_miembros', 'club_miembros_historial', 'club_invitaciones', 'equipos', 'ajustes')
  loop
    execute format('drop policy if exists %I on %I.%I', politica.policyname, politica.schemaname, politica.tablename);
  end loop;
end $$;

-- Cuentas: cada uno ve la suya; el administrador de un club, las de quien
-- está o estuvo en su club. Nadie las cambia desde la app.
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.club_miembros m
                     where m.user_id = perfiles.user_id and public.es_admin_de_club(m.equipo_id)));

-- Membresías: cada uno ve las suyas; el administrador, las de su club.
-- Cambia solo las del staff, nunca la suya ni la de otro administrador. No
-- se suman ni se borran a mano (se entra por invitación o por pedido).
create policy club_miembros_leer on public.club_miembros
  for select to authenticated
  using (user_id = (select auth.uid()) or public.es_admin_de_club(equipo_id));

create policy club_miembros_cambiar on public.club_miembros
  for update to authenticated
  using (public.es_admin_de_club(equipo_id) and user_id <> (select auth.uid()) and rol = 'staff')
  with check (public.es_admin_de_club(equipo_id) and user_id <> (select auth.uid()) and rol = 'staff');

create policy club_miembros_historial_leer on public.club_miembros_historial
  for select to authenticated
  using (user_id = (select auth.uid()) or public.es_admin_de_club(equipo_id));

-- Invitaciones: las ve el administrador del club; invita solo como staff, y
-- de una abierta lo único que hace es cancelarla.
create policy club_invitaciones_ver on public.club_invitaciones
  for select to authenticated
  using (public.es_admin_de_club(equipo_id));

create policy club_invitaciones_crear on public.club_invitaciones
  for insert to authenticated
  with check (public.es_admin_de_club(equipo_id) and rol = 'staff');

create policy club_invitaciones_cancelar on public.club_invitaciones
  for update to authenticated
  using (public.es_admin_de_club(equipo_id) and cancelada_en is null and usada_en is null)
  with check (public.es_admin_de_club(equipo_id) and cancelada_en is not null);

-- Clubes: cada uno ve los suyos (donde está o estuvo); el nombre lo cambia
-- su administrador. Se crean con crear_club y no se borran desde la app.
create policy equipos_ver on public.equipos
  for select to authenticated
  using (public.puede_ver(id));

create policy equipos_cambiar on public.equipos
  for update to authenticated
  using (public.es_admin_de_club(id))
  with check (public.es_admin_de_club(id));

-- Ajustes generales (tabla vieja): solo se leen.
create policy ajustes_ver on public.ajustes
  for select to authenticated
  using ((select public.esta_autorizado()));

-- Sin CASCADE: si alguna política la siguiera usando, esto falla y no queda
-- nada a medias.
drop function if exists public.es_admin();
-- Nadie las usa desde 20261004.
drop function if exists public.puede_ver_fecha(uuid, date);
drop function if exists public.fecha_segura(text);

-- ------------------------------------------------------------- Privilegios --

-- anon: nada en public. authenticated: nunca TRUNCATE, REFERENCES ni
-- TRIGGER, y las secuencias sin UPDATE (setval).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke update on all sequences in schema public from authenticated;

-- Tabla por tabla, lo justo.
revoke all on table public.perfiles, public.club_miembros, public.club_miembros_historial, public.club_invitaciones,
                    public.equipos, public.ajustes, public.registros_partido, public.jugadores,
                    public.entrenamientos, public.catapult_cuentas
  from authenticated;
grant select on table public.perfiles, public.club_miembros_historial, public.ajustes to authenticated;
-- La gente del club: el administrador cambia fechas y módulos (el rol queda
-- en staff: lo frena la política). Cuándo se creó la fila y quién decidió,
-- los anota la base.
grant select on table public.club_miembros to authenticated;
grant update (desde, hasta, rol, partido, flujo, lesiones, evaluaciones) on table public.club_miembros to authenticated;
grant select on table public.club_invitaciones to authenticated;
grant insert (equipo_id, email, rol, partido, flujo, lesiones, evaluaciones) on table public.club_invitaciones to authenticated;
grant update (cancelada_en) on table public.club_invitaciones to authenticated;
grant select on table public.equipos to authenticated;
grant update (nombre) on table public.equipos to authenticated;
grant select, insert, update, delete
  on table public.registros_partido, public.jugadores, public.entrenamientos, public.catapult_cuentas
  to authenticated;

revoke all on public.v_mis_clubes, public.v_miembros_club, public.v_lesiones, public.v_lesiones_excel_v1 from authenticated;
grant select on public.v_mis_clubes, public.v_miembros_club, public.v_lesiones, public.v_lesiones_excel_v1 to authenticated;

-- Funciones. Toda función nueva nace ejecutable por PUBLIC (y así por anon):
-- es un privilegio por defecto global que no se saca por esquema. Por eso
-- se revoca acá a todas, y cada migración que cree funciones lo tiene que
-- repetir (y volver a dar la lista de abajo).
revoke execute on all functions in schema public from public, anon;

-- Los disparadores no piden EXECUTE para dispararse, y las internas las
-- llaman solo otras funciones: nadie las ejecuta desde la API.
do $$
declare
  v_funcion regprocedure;
begin
  for v_funcion in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from authenticated', v_funcion);
  end loop;
end $$;
revoke execute on function public.aplicar_invitaciones(uuid), public.zona_del_club(uuid), public.es_dueno(),
                           public.es_dueno_principal(), public.normalizar_nombre_club(text),
                           public.plataforma_anotar(text, uuid, uuid, text, jsonb), public.club_tiene_admin(uuid)
  from authenticated;

-- Lo que authenticated ejecuta: lo que usan las políticas y las vistas, la
-- foto al día y las funciones de esta migración.
grant execute on function
  public.esta_autorizado(), public.puede_usar(text), public.puede_usar_en(uuid, text), public.puede_ver(uuid),
  public.puede_editar(uuid), public.acceso_club(uuid), public.es_admin_de_club(uuid),
  public.datos_al_dia(text, uuid), public.lesiones_etiqueta(uuid, text, text, text), public.lesiones_horas_imagen(text, date),
  public.mi_cuenta(), public.puede_usar_catapult_servidor(),
  public.panel_clubes(), public.panel_duenos(), public.panel_historial(integer),
  public.crear_club(text, text, text), public.asignar_entidad(uuid, text),
  public.agregar_subdueno(text), public.quitar_subdueno(uuid), public.traspasar_principal(uuid),
  public.pedidos_sin_club(), public.derivar_pedido(uuid, uuid), public.rechazar_pedido_sin_club(uuid),
  public.pedir_acceso(text, text), public.mis_pedidos(), public.cancelar_pedido(uuid),
  public.pedidos_del_club(uuid), public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean),
  public.rechazar_pedido(uuid), public.salir_del_club(uuid), public.miembro_protegido(uuid)
  to authenticated;

-- Para lo que se cree de acá en adelante (tablas, secuencias y funciones del
-- rol postgres en public): nada para anon y authenticated sin TRUNCATE,
-- REFERENCES, TRIGGER ni setval. Si alguna no se puede, avisa y sigue.
do $$
declare
  v_sentencia text;
begin
  foreach v_sentencia in array array[
    'alter default privileges for role postgres in schema public revoke all on tables from anon',
    'alter default privileges for role postgres in schema public revoke all on sequences from anon',
    'alter default privileges for role postgres in schema public revoke all on functions from anon',
    'alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated',
    'alter default privileges for role postgres in schema public revoke update on sequences from authenticated'
  ] loop
    begin
      execute v_sentencia;
    exception when others then
      raise warning 'No se pudo cambiar un privilegio por defecto (%): %', v_sentencia, sqlerrm;
    end;
  end loop;
end $$;

-- -------------------------------------------------------- Autoverificación --
-- Si algo no da, se cancela todo y se dice qué.
do $$
declare
  v_fallas text[] := '{}';
  v_fila record;
begin
  for v_fila in
    select c.oid, c.relname, c.relkind, c.relrowsecurity, coalesce(c.reloptions, '{}') as opciones
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
     order by c.relname
  loop
    if v_fila.relkind = 'S' then
      if has_sequence_privilege('anon', v_fila.oid, 'USAGE, SELECT, UPDATE') then
        v_fallas := v_fallas || format('anon tiene permisos en la secuencia %s', v_fila.relname);
      end if;
      if has_sequence_privilege('authenticated', v_fila.oid, 'UPDATE') then
        v_fallas := v_fallas || format('authenticated puede cambiar la secuencia %s', v_fila.relname);
      end if;
      continue;
    end if;
    if has_table_privilege('anon', v_fila.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       or has_any_column_privilege('anon', v_fila.oid, 'SELECT, INSERT, UPDATE, REFERENCES') then
      v_fallas := v_fallas || format('anon tiene permisos en %s', v_fila.relname);
    end if;
    if has_table_privilege('authenticated', v_fila.oid, 'TRUNCATE, REFERENCES, TRIGGER')
       or has_any_column_privilege('authenticated', v_fila.oid, 'REFERENCES') then
      v_fallas := v_fallas || format('authenticated tiene TRUNCATE, REFERENCES o TRIGGER en %s', v_fila.relname);
    end if;
    if v_fila.relkind in ('r', 'p') and not v_fila.relrowsecurity then
      v_fallas := v_fallas || format('la tabla %s no tiene RLS', v_fila.relname);
    end if;
    if v_fila.relkind = 'v'
       and not v_fila.opciones && array['security_invoker=true', 'security_invoker=on', 'security_invoker=1', 'security_invoker=yes'] then
      v_fallas := v_fallas || format('la vista %s no tiene security_invoker', v_fila.relname);
    end if;
  end loop;

  if has_any_column_privilege('authenticated', 'public.club_miembros', 'INSERT')
     or has_table_privilege('authenticated', 'public.club_miembros', 'DELETE') then
    v_fallas := v_fallas || 'authenticated puede sumar o borrar membresías'::text;
  end if;
  if has_any_column_privilege('authenticated', 'public.equipos', 'INSERT')
     or has_table_privilege('authenticated', 'public.equipos', 'DELETE') then
    v_fallas := v_fallas || 'authenticated puede crear o borrar clubes'::text;
  end if;
  if has_any_column_privilege('authenticated', 'public.perfiles', 'UPDATE') then
    v_fallas := v_fallas || 'authenticated puede cambiar perfiles'::text;
  end if;

  for v_fila in
    select p.oid::regprocedure as funcion
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (has_function_privilege('anon', p.oid, 'EXECUTE')
            or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
     order by 1
  loop
    v_fallas := v_fallas || format('la función %s se puede ejecutar sin cuenta (PUBLIC o anon)', v_fila.funcion);
  end loop;

  if to_regprocedure('public.es_admin()') is not null then
    v_fallas := v_fallas || 'sigue existiendo es_admin()'::text;
  end if;

  if (select count(*) from public.plataforma) <> 1 then
    v_fallas := v_fallas || 'plataforma no tiene exactamente una fila'::text;
  elsif not exists (select 1 from public.plataforma p
                      join public.perfiles pf on pf.user_id = p.dueno_principal
                      join auth.users u on u.id = p.dueno_principal
                     where pf.estado = 'autorizado' and u.email_confirmed_at is not null) then
    v_fallas := v_fallas || 'el dueño principal no está autorizado o no confirmó el correo'::text;
  end if;

  if array_length(v_fallas, 1) > 0 then
    raise exception 'No se cambió nada. La revisión final encontró: %', array_to_string(v_fallas, '; ');
  end if;
end $$;

commit;

-- Que la app vea las funciones y tablas nuevas sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: los dueños, lo mismo que muestra el panel (por
-- consulta directa: el panel pide la sesión de un dueño), cuántas
-- invitaciones pasaron a staff y el club del token de Catapult.
select pf.email, d.principal
  from (select p.dueno_principal as user_id, true as principal from public.plataforma p
        union all
        select s.user_id, false from public.plataforma_subduenos s) d
  left join public.perfiles pf on pf.user_id = d.user_id
 order by d.principal desc, pf.email;
select e.nombre,
       coalesce(ce.email, 'sin entidad') as entidad,
       coalesce((select string_agg(pf.email, ', ' order by pf.email)
                   from public.club_miembros m join public.perfiles pf on pf.user_id = m.user_id
                  where m.equipo_id = e.id and m.rol = 'admin' and m.hasta is null and pf.estado = 'autorizado'),
                'sin administrador') as administrador,
       (select count(*) from public.club_miembros m join public.perfiles pf on pf.user_id = m.user_id
         where m.equipo_id = e.id and m.hasta is null and pf.estado = 'autorizado') as personas
  from public.equipos e
  left join public.club_entidades ce on ce.equipo_id = e.id
 order by e.nombre;
-- Las invitaciones abiertas como administrador que pasaron a staff en esta
-- corrida (al volver a correrla, 0).
select coalesce(nullif(current_setting('app.invitaciones_a_staff', true), ''), '0')::integer
         as invitaciones_de_admin_pasadas_a_staff;
select coalesce(e.nombre, 'ninguno') as club_del_token_catapult
  from public.plataforma p
  left join public.equipos e on e.id = p.catapult_equipo;
