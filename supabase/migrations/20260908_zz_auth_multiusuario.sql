-- Acceso multiusuario seguro.
-- Cada cuenta escribe sólo sus partidos; la cuenta administradora puede leerlos todos.

begin;

alter table public.registros_partido
  add column if not exists owner_id uuid
    default auth.uid()
    references auth.users (id)
    on delete set null;

comment on column public.registros_partido.owner_id is
  'Cuenta propietaria. Los registros anteriores a Auth se asignan con el script de configuración del administrador.';

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.app_admins is
  'Usuarios que pueden consultar el historial completo. Se administra únicamente desde Supabase.';

alter table public.app_admins enable row level security;
alter table public.app_admins force row level security;

revoke all on table public.app_admins from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.es_admin_actual()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.es_admin_actual() from public, anon;
grant execute on function private.es_admin_actual() to authenticated;

-- El índice anterior era global e impedía que dos cuentas registraran el mismo
-- rival en la misma fecha. La unicidad ahora se controla dentro de cada cuenta.
drop index if exists public.registros_partido_fecha_rival_unicos;

create unique index if not exists registros_partido_usuario_fecha_rival_unicos
  on public.registros_partido (owner_id, fecha, lower(trim(rival)))
  where owner_id is not null;

create index if not exists registros_partido_owner_id_idx
  on public.registros_partido (owner_id);

alter table public.registros_partido enable row level security;
alter table public.registros_partido force row level security;

-- Se eliminan políticas históricas para que una regla permisiva anterior no se
-- combine con las nuevas políticas y vuelva públicos los datos.
do $$
declare
  politica record;
begin
  for politica in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'registros_partido'
  loop
    execute format(
      'drop policy if exists %I on public.registros_partido',
      politica.policyname
    );
  end loop;
end $$;

revoke all on table public.registros_partido from anon, authenticated;
grant select, insert, update, delete on table public.registros_partido
  to authenticated;

create policy registros_leer_propios_o_admin
on public.registros_partido
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.es_admin_actual())
);

create policy registros_insertar_propios
on public.registros_partido
for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy registros_actualizar_propios
on public.registros_partido
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy registros_borrar_propios
on public.registros_partido
for delete
to authenticated
using (owner_id = (select auth.uid()));

commit;
