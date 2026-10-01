-- =====================================================================
-- Lesiones: la base de lesiones entra a la app como módulo propio.
--
--   · perfiles.lesiones: un módulo más que el administrador habilita por
--     cuenta (como partido y flujo). puede_usar('lesiones') lo respeta.
--   · public.lesiones: una fila por lesión, con los códigos del consenso
--     IOC 2020 (dónde pasó, cómo empezó, mecanismo, región, lado, tejido).
--     Las fechas son días (no horas); fecha_alta vacía = lesión activa.
--     Dos lesiones del mismo jugador en la misma región y lado no se pueden
--     pisar en el tiempo (índice de exclusión).
--   · public.lesiones_historial: cada cambio queda anotado por un
--     disparador (quién, cuándo, qué había antes).
--   · v_lesiones: la misma tabla con días de baja, gravedad y si está activa.
--     v_lesiones_excel_v1: columnas fijas, pensada para que Excel la lea.
--     Las dos respetan RLS (security_invoker).
--
-- Requiere 20260930_cuentas.sql y 20260930_partido_solo_autorizados.sql.
-- Se corre en Supabase > SQL Editor, entero y de una vez. Es una sola
-- transacción y se puede volver a correr: no pisa lo que ya está.
-- =====================================================================

begin;

-- ---------------------------------------------------- El módulo en perfiles --

alter table public.perfiles
  add column if not exists lesiones boolean not null default false;

comment on column public.perfiles.lesiones is 'Puede usar Lesiones.';

grant update (lesiones) on table public.perfiles to authenticated;

-- El administrador puede todo, también Lesiones.
create or replace function public.puede_usar(modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.estado = 'autorizado'
            and (p.admin
                 or (modulo = 'partido' and p.partido)
                 or (modulo = 'flujo' and p.flujo)
                 or (modulo = 'lesiones' and p.lesiones))
       from public.perfiles p
      where p.user_id = auth.uid()),
    false);
$$;

-- Una cuenta solo con Lesiones también cuenta como autorizada: necesita leer
-- equipos y jugadores.
create or replace function public.esta_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.estado = 'autorizado' and (p.admin or p.partido or p.flujo or p.lesiones)
       from public.perfiles p
      where p.user_id = auth.uid()),
    false);
$$;

-- Habilitar o quitar Lesiones también es una decisión que queda anotada.
create or replace function public.perfiles_anotar_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado
     or new.partido is distinct from old.partido
     or new.flujo is distinct from old.flujo
     or new.lesiones is distinct from old.lesiones
     or new.admin is distinct from old.admin then
    new.decidido_por := auth.uid();
    new.decidido_en := now();
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

-- Los administradores arrancan con el módulo prendido (igual pueden todo).
update public.perfiles set lesiones = true where admin and not lesiones;

-- ------------------------------------------------------------ La tabla --

-- Para el índice de exclusión por rango de fechas + columnas comunes.
create extension if not exists btree_gist with schema extensions;

create table if not exists public.lesiones (
  id             uuid primary key default gen_random_uuid(),
  equipo_id      uuid not null references public.equipos (id) on delete restrict,
  jugador_id     bigint not null references public.jugadores (id) on delete restrict,
  fecha_lesion   date not null,
  fecha_alta     date,
  contexto       text not null default 'entrenamiento'
                 check (contexto in ('entrenamiento', 'partido', 'otro')),
  modo_inicio    text not null default 'subito'
                 check (modo_inicio in ('subito', 'gradual')),
  mecanismo      text
                 check (mecanismo is null or mecanismo in ('contacto_directo', 'contacto_indirecto', 'sin_contacto')),
  region         text not null
                 check (region in ('cabeza_cuello', 'hombro', 'brazo_codo', 'antebrazo_mano', 'torax_espalda',
                                   'lumbar', 'cadera_ingle', 'muslo_anterior', 'muslo_posterior', 'aductores',
                                   'rodilla', 'pierna', 'tobillo', 'pie')),
  lado           text not null
                 check (lado in ('derecho', 'izquierdo', 'bilateral', 'no_aplica')),
  tejido         text
                 check (tejido is null or tejido in ('muscular', 'tendon', 'ligamento', 'hueso', 'articular', 'contusion', 'otro')),
  diagnostico    text not null default '',
  observaciones  text not null default '',
  recidiva_de    uuid references public.lesiones (id) on delete set null,
  creado_por     uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_por uuid references auth.users (id) on delete set null,
  actualizado_en timestamptz not null default now(),
  -- El alta no puede ser antes de la lesión, y nada se carga a futuro.
  constraint lesiones_alta_despues check (fecha_alta is null or fecha_alta >= fecha_lesion),
  constraint lesiones_sin_futuro check (fecha_lesion <= current_date and (fecha_alta is null or fecha_alta <= current_date)),
  -- La misma región y lado del mismo jugador no puede estar lesionada dos
  -- veces a la vez. El rango es [lesión, alta); sin alta, abierto.
  constraint lesiones_sin_solapar exclude using gist (
    jugador_id with =,
    region with =,
    lado with =,
    daterange(fecha_lesion, fecha_alta, '[)') with &&
  )
);

comment on table public.lesiones is
  'Una fila por lesión. Códigos según el consenso IOC 2020; fecha_alta vacía = lesión activa.';
comment on column public.lesiones.contexto is 'Dónde pasó: entrenamiento, partido u otro.';
comment on column public.lesiones.modo_inicio is 'subito (de golpe) o gradual (fue apareciendo).';
comment on column public.lesiones.mecanismo is 'contacto_directo, contacto_indirecto o sin_contacto. Vacío si no se sabe.';
comment on column public.lesiones.recidiva_de is 'Si es una recaída, la lesión anterior.';

create index if not exists lesiones_por_equipo on public.lesiones (equipo_id, fecha_lesion desc);
create index if not exists lesiones_por_jugador on public.lesiones (jugador_id, fecha_lesion desc);
create index if not exists lesiones_activas on public.lesiones (equipo_id) where fecha_alta is null;

-- Quién tocó por última vez, lo anota la base.
create or replace function public.lesiones_anotar_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

create or replace trigger lesiones_anotar_cambio
  before update on public.lesiones
  for each row execute function public.lesiones_anotar_cambio();

-- ------------------------------------------------------------ Historial --

create table if not exists public.lesiones_historial (
  id          bigint generated always as identity primary key,
  lesion_id   uuid not null,
  accion      text not null check (accion in ('creada', 'editada', 'borrada')),
  quien       uuid,
  quien_email text not null default '',
  cuando      timestamptz not null default now(),
  antes       jsonb,
  despues     jsonb
);

comment on table public.lesiones_historial is
  'Cada cambio de una lesión: quién, cuándo, cómo estaba antes y cómo quedó. Lo escribe un disparador.';

create index if not exists lesiones_historial_por_lesion on public.lesiones_historial (lesion_id, cuando desc);

create or replace function public.lesiones_historial_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  correo text := coalesce((select p.email from public.perfiles p where p.user_id = auth.uid()), '');
begin
  if tg_op = 'INSERT' then
    insert into public.lesiones_historial (lesion_id, accion, quien, quien_email, despues)
    values (new.id, 'creada', auth.uid(), correo, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.lesiones_historial (lesion_id, accion, quien, quien_email, antes, despues)
    values (new.id, 'editada', auth.uid(), correo, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.lesiones_historial (lesion_id, accion, quien, quien_email, antes)
    values (old.id, 'borrada', auth.uid(), correo, to_jsonb(old));
    return old;
  end if;
end;
$$;

create or replace trigger lesiones_historial_anotar
  after insert or update or delete on public.lesiones
  for each row execute function public.lesiones_historial_anotar();

-- ------------------------------------------------------------ Permisos --

alter table public.lesiones enable row level security;
alter table public.lesiones_historial enable row level security;

revoke all on table public.lesiones, public.lesiones_historial from anon, authenticated;
grant select, insert, update, delete on table public.lesiones to authenticated;
grant select on table public.lesiones_historial to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists lesiones_acceso_app on public.lesiones;
create policy lesiones_acceso_app
  on public.lesiones
  for all to authenticated
  using ((select public.puede_usar('lesiones')))
  with check ((select public.puede_usar('lesiones')));

drop policy if exists lesiones_historial_leer on public.lesiones_historial;
create policy lesiones_historial_leer
  on public.lesiones_historial
  for select to authenticated
  using ((select public.puede_usar('lesiones')));

-- ------------------------------------------------------------ Vistas --

-- Días de baja: hasta el alta, o hasta hoy si sigue activa. Gravedad según
-- los días: mínima (0), leve (1-7), moderada (8-28), grave (más de 28).
create or replace view public.v_lesiones
with (security_invoker = true)
as
select l.*,
       j.nombre as jugador,
       e.nombre as equipo,
       (coalesce(l.fecha_alta, current_date) - l.fecha_lesion) as dias_baja,
       (l.fecha_alta is null) as activa,
       case
         when l.fecha_alta is null then 'activa'
         when l.fecha_alta - l.fecha_lesion = 0 then 'minima'
         when l.fecha_alta - l.fecha_lesion <= 7 then 'leve'
         when l.fecha_alta - l.fecha_lesion <= 28 then 'moderada'
         else 'grave'
       end as gravedad
  from public.lesiones l
  join public.jugadores j on j.id = l.jugador_id
  join public.equipos e on e.id = l.equipo_id;

-- Para Excel (Power Query): columnas fijas y con nombre. Si algún día cambia
-- la forma, se crea v_lesiones_excel_v2 y la v1 sigue igual.
create or replace view public.v_lesiones_excel_v1
with (security_invoker = true)
as
select equipo, jugador, fecha_lesion, fecha_alta, dias_baja, activa, gravedad,
       contexto, modo_inicio, mecanismo, region, lado, tejido, diagnostico, observaciones,
       (recidiva_de is not null) as recidiva, creado_en, actualizado_en
  from public.v_lesiones
 order by fecha_lesion desc;

revoke all on public.v_lesiones, public.v_lesiones_excel_v1 from anon;
grant select on public.v_lesiones, public.v_lesiones_excel_v1 to authenticated;

commit;

-- Lo que quedó: la columna nueva en perfiles y la tabla vacía.
select email, estado, partido, flujo, lesiones, admin from public.perfiles order by creado_en;
select count(*) as lesiones_cargadas from public.lesiones;
