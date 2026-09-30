-- =====================================================================
-- Etapa 3 de las cuentas: las tablas de Partido dejan de estar abiertas.
--
-- Hasta acá, equipos, registros_partido, jugadores y ajustes se podían leer
-- y escribir sin usuario (rol anon), porque Partido no pedía login. Ahora la
-- app pide login antes del portal, así que:
--   · registros_partido: solo cuentas autorizadas con Partido (o admin).
--   · equipos y jugadores: cualquier cuenta autorizada (Partido o Flujo
--     diario), porque los dos módulos los usan.
--   · ajustes (tabla vieja, la app no la usa): cualquier cuenta autorizada.
--   · anon: nada.
--
-- Requiere haber corrido 20260930_cuentas.sql (tabla perfiles y puede_usar).
-- Se corre en Supabase > SQL Editor, entero y de una vez. Es una sola
-- transacción y se puede volver a correr. Vuelta atrás:
-- 20260930_partido_abierto_de_nuevo.sql.
-- =====================================================================

begin;

-- Cualquier cuenta autorizada con al menos un módulo (el admin cuenta).
create or replace function public.esta_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.estado = 'autorizado' and (p.admin or p.partido or p.flujo)
       from public.perfiles p
      where p.user_id = auth.uid()),
    false);
$$;

revoke execute on function public.esta_autorizado() from public, anon;
grant execute on function public.esta_autorizado() to authenticated;

-- Sin usuario no se toca nada de Partido.
revoke all on table public.equipos, public.registros_partido, public.jugadores, public.ajustes from anon;
revoke all on all sequences in schema public from anon;

grant select, insert, update, delete
  on table public.equipos, public.registros_partido, public.jugadores, public.ajustes
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.equipos enable row level security;
alter table public.registros_partido enable row level security;
alter table public.jugadores enable row level security;
alter table public.ajustes enable row level security;

-- Se sacan TODAS las políticas que hubiera en estas cuatro tablas (quedaron
-- de distintas épocas y con distintos nombres): con RLS alcanza una política
-- abierta para que la tabla siga abierta.
do $$
declare
  politica record;
begin
  for politica in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('equipos', 'registros_partido', 'jugadores', 'ajustes')
  loop
    execute format('drop policy if exists %I on %I.%I', politica.policyname, politica.schemaname, politica.tablename);
  end loop;
end $$;

create policy registros_acceso_app
  on public.registros_partido
  for all to authenticated
  using ((select public.puede_usar('partido')))
  with check ((select public.puede_usar('partido')));

create policy equipos_acceso_app
  on public.equipos
  for all to authenticated
  using ((select public.esta_autorizado()))
  with check ((select public.esta_autorizado()));

create policy jugadores_acceso_app
  on public.jugadores
  for all to authenticated
  using ((select public.esta_autorizado()))
  with check ((select public.esta_autorizado()));

create policy ajustes_acceso_app
  on public.ajustes
  for all to authenticated
  using ((select public.esta_autorizado()))
  with check ((select public.esta_autorizado()));

commit;

-- Lo que quedó: una política por tabla, todas "to authenticated".
select tablename, policyname, roles, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('equipos', 'registros_partido', 'jugadores', 'ajustes')
 order by tablename;
