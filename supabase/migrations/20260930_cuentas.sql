-- =====================================================================
-- Cuentas de la app: quién entra y qué puede usar (Partido, Flujo diario,
-- administrador). Se decide en la base y no en una variable de Vercel.
--
-- Cada cuenta nueva (auth.users) nace "pendiente" en public.perfiles; el
-- administrador la autoriza desde la app y marca qué módulos puede usar.
-- Las tablas de Flujo diario (entrenamientos, catapult_cuentas) solo se
-- abren a cuentas autorizadas con Flujo diario. Las tablas de Partido
-- (equipos, registros_partido, jugadores, ajustes) no se tocan acá.
--
-- Se corre en Supabase > SQL Editor, entero y de una vez (un solo Run, sin
-- texto seleccionado). Es una sola transacción: o queda todo o no queda
-- nada. Se puede volver a correr, salvo después de 20261003_club_miembros.sql:
-- ahí se frena sola.
--
-- ANTES DE CORRER: completar las dos líneas de "Semilla" con el correo del
-- administrador y, separados por coma, los demás correos que hoy están en
-- OPENFIELD_ALLOWED_EMAILS (panel de Vercel). Los correos no van al repo.
-- =====================================================================

begin;

-- Freno: sobre una base con clubes (20261003_club_miembros.sql) esto
-- devolvería permisos viejos (que el dueño decida las cuentas, Flujo diario
-- abierto a quien lo tenga en cualquier club) y un alta de cuentas que no
-- aplica las invitaciones.
do $$
begin
  if to_regclass('public.club_miembros') is not null then
    raise exception 'Ya está corrida 20261003_club_miembros.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

-- ---------------------------------------------------------------- Semilla --
-- Valen solo dentro de esta transacción; no quedan guardados.
select set_config('app.semilla_admin', 'CORREO_DEL_ADMINISTRADOR', true);
select set_config('app.semilla_autorizados', '', true);

-- ------------------------------------------------------ Cuenta de Catapult --
-- Igual que 20260920_cuenta_catapult.sql, por si la base se montó con
-- instalar-desde-cero.sql (que no la creaba). Si ya existe, no hace nada.

create table if not exists public.catapult_cuentas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null,
  secreto text not null,
  pase_secreto text,
  pase_expira timestamptz,
  verificado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.catapult_cuentas enable row level security;
grant select, insert, update, delete on table public.catapult_cuentas to authenticated;

-- ---------------------------------------------------------------- Perfiles --

create table if not exists public.perfiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  email          text not null default '',
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente', 'autorizado', 'bloqueado')),
  partido        boolean not null default false,
  flujo          boolean not null default false,
  admin          boolean not null default false,
  confirmado_en  timestamptz,
  decidido_por   uuid references auth.users (id) on delete set null,
  decidido_en    timestamptz,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.perfiles is
  'Una fila por cuenta de la app: si está autorizada y qué puede usar. La fila la crea un disparador al registrarse; la decide el administrador desde la app.';
comment on column public.perfiles.estado is
  'pendiente (recién creada, no entra), autorizado (entra) o bloqueado (no entra ni ve datos).';
comment on column public.perfiles.partido is 'Puede usar Partido.';
comment on column public.perfiles.flujo is 'Puede usar Flujo diario.';
comment on column public.perfiles.admin is 'Administrador: puede todo y decide las cuentas.';
comment on column public.perfiles.confirmado_en is
  'Cuándo confirmó el correo (copia de auth.users.email_confirmed_at).';
comment on column public.perfiles.decidido_por is
  'Quién tomó la última decisión sobre la cuenta. Lo anota un disparador, no la app.';

create index if not exists perfiles_por_estado on public.perfiles (estado, creado_en);

alter table public.perfiles enable row level security;

-- Supabase le da select/insert/update/delete a anon y authenticated por
-- defecto en toda tabla nueva de public: se saca y se da lo justo. Desde la
-- app solo se decide estado y módulos; ni el correo, ni el user_id, ni la
-- auditoría.
revoke all on table public.perfiles from anon, authenticated;
grant select on table public.perfiles to authenticated;
grant update (estado, partido, flujo, admin) on table public.perfiles to authenticated;

-- ------------------------------------------- Alta y sincronización automática --
--
-- Al crearse una cuenta (auth.users) aparece su perfil, pendiente. Es el
-- patrón handle_new_user de la documentación de Supabase. security definer
-- porque el alta la hace el rol supabase_auth_admin, que no tiene permisos
-- sobre public. `on conflict do nothing` para que nunca frene un registro.
-- Los disparadores van con `create or replace trigger` (Postgres 14+) y no
-- con `drop trigger`: borrar uno de auth.users exige ser dueño de la tabla y
-- crearlo solo pide el privilegio TRIGGER, que el rol postgres tiene.

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
  return new;
end;
$$;

create or replace trigger perfiles_alta_usuario
  after insert on auth.users
  for each row execute function public.perfiles_alta_usuario();

-- Si la persona confirma o cambia el correo, el perfil lo refleja.
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
  return new;
end;
$$;

create or replace trigger perfiles_sincronizar_usuario
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.perfiles_sincronizar_usuario();

-- Cada decisión (estado o módulos) queda con quién y cuándo. Lo escribe la
-- base, no la app: la app ni tiene permiso sobre esas columnas.
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
     or new.admin is distinct from old.admin then
    new.decidido_por := auth.uid();
    new.decidido_en := now();
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

create or replace trigger perfiles_anotar_decision
  before update on public.perfiles
  for each row execute function public.perfiles_anotar_decision();

-- ------------------------------------------------- Funciones de autorización --
--
-- Leen perfiles con los privilegios del dueño (postgres), así se pueden usar
-- dentro de las políticas de la propia tabla sin recursión (error 42P17).
-- auth.uid() sigue siendo el de quien consulta: sale del JWT del pedido.

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.admin and p.estado = 'autorizado'
       from public.perfiles p
      where p.user_id = auth.uid()),
    false);
$$;

-- puede_usar('partido') o puede_usar('flujo'): autorizado y con ese módulo
-- (el administrador puede todo).
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
                 or (modulo = 'flujo' and p.flujo))
       from public.perfiles p
      where p.user_id = auth.uid()),
    false);
$$;

revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.puede_usar(text) from public, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.puede_usar(text) to authenticated;

-- ------------------------------------------------------ Políticas de perfiles --
-- Cada uno lee su fila; el administrador lee todas y decide sobre las demás
-- (nunca sobre la suya: así no puede dejarse afuera).

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer
  on public.perfiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));

drop policy if exists perfiles_decidir on public.perfiles;
create policy perfiles_decidir
  on public.perfiles
  for update to authenticated
  using ((select public.es_admin()) and user_id <> (select auth.uid()))
  with check ((select public.es_admin()) and user_id <> (select auth.uid()));

-- ------------------------------------- Flujo diario solo para cuentas autorizadas --

drop policy if exists entrenamientos_acceso_app on public.entrenamientos;
create policy entrenamientos_acceso_app
  on public.entrenamientos
  for all to authenticated
  using ((select public.puede_usar('flujo')))
  with check ((select public.puede_usar('flujo')));

drop policy if exists catapult_cuentas_propia on public.catapult_cuentas;
create policy catapult_cuentas_propia
  on public.catapult_cuentas
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.puede_usar('flujo')))
  with check ((select auth.uid()) = user_id and (select public.puede_usar('flujo')));

-- ------------------------------------------------ Cuentas que ya existen --
-- Las cuentas creadas antes de este disparador reciben su fila (pendiente).

insert into public.perfiles (user_id, email, confirmado_en)
select u.id, lower(coalesce(u.email, '')), u.email_confirmed_at
  from auth.users u
on conflict (user_id) do nothing;

-- El administrador y los correos que hoy entran quedan autorizados. Si no
-- queda ningún administrador, la transacción entera se cancela.
do $$
declare
  correo_admin text := lower(trim(coalesce(current_setting('app.semilla_admin', true), '')));
  otros text := lower(coalesce(current_setting('app.semilla_autorizados', true), ''));
begin
  if correo_admin <> '' and correo_admin <> 'correo_del_administrador' then
    update public.perfiles
       set estado = 'autorizado', partido = true, flujo = true, admin = true
     where email = correo_admin;
    if not found then
      raise exception 'No hay ninguna cuenta con el correo %. Creala primero desde la app (y confirmá el correo).', correo_admin;
    end if;
  end if;

  update public.perfiles
     set estado = 'autorizado', partido = true, flujo = true
   where estado = 'pendiente'
     and email = any (string_to_array(regexp_replace(otros, '\s', '', 'g'), ','));

  if not exists (select 1 from public.perfiles where admin and estado = 'autorizado') then
    raise exception 'No quedó ningún administrador: completá el correo del administrador en la línea de Semilla.';
  end if;
end $$;

commit;

-- Lo que quedó: una fila por cuenta.
select email, estado, partido, flujo, admin, confirmado_en, creado_en
  from public.perfiles
 order by creado_en;
