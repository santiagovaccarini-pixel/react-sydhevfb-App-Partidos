-- =====================================================================
-- GPS: los valores de referencia (V.R.) de cada dispositivo, para la parte
-- de arriba de la Base (nota de Santiago del 12/10: «Sacar de gps todas las
-- filas de arriba y solo dejar las de promedio por dispositivo y agregar
-- todos los vr de gps asi como los % vs vr de partido»; 14/10: «Revisa la
-- base de gps y te vas a dar cuenta de donde salen», «Cada uno tiene el
-- suyo», «Futbol 2 es de sport y el otro es de catapult»).
--
--   · gps_referencias: una fila por V.R. del club, como la hoja «Valores
--     Referenciales» del Excel: de qué dispositivo es (el código de su lista
--     Dispositivo), el tipo (FUTBOL, DINAMICA, REDUCIDO), la tabla («Oficial
--     EdLP», «FUTBOL 2»…), el grupo («TOTAL FUTBOL», una posición…) y el
--     promedio y el desvío de cada columna (jsonb: { clave de la columna:
--     número }; el tiempo, en segundos).
--   · Los valores los pasa Claude por SQL en el chat (no van en el código,
--     como los de Evaluaciones). La app solo los lee: editarlos es la nota
--     «Poder editar los Valores referenciales y poder borrarlos».
--   · Los ve quien tiene GPS en el club (también quien se fue, para mirar,
--     como las reglas de la carga). Anon, nada.
--
-- Requiere 20261016_gps.sql. Se corre en Supabase > SQL Editor, entera y de
-- una vez. Solo agrega: la app de antes sigue andando. Se puede volver a
-- correr, salvo después de 20261025_referencias_editables.sql: ahí se frena
-- sola (le sacaría a la app lo de cambiar los V.R.).
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null then
    raise exception 'Primero hay que correr 20261016_gps.sql.';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'gps_referencias' and column_name = 'de_partido') then
    raise exception 'Ya está corrida 20261025_referencias_editables.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

create table if not exists public.gps_referencias (
  id             uuid primary key default gen_random_uuid(),
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  dispositivo    text not null,
  tipo           text not null,
  tabla          text not null,
  grupo          text not null,
  orden          integer not null default 0,
  promedio       jsonb not null default '{}'::jsonb,
  desvio         jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  constraint gps_referencias_una unique (equipo_id, dispositivo, tipo, tabla, grupo),
  constraint gps_referencias_textos check (
    char_length(dispositivo) between 1 and 80 and char_length(tipo) between 1 and 80
    and char_length(tabla) between 1 and 120 and char_length(grupo) between 1 and 120),
  constraint gps_referencias_valores check (
    jsonb_typeof(promedio) = 'object' and jsonb_typeof(desvio) = 'object'
    and pg_column_size(promedio) <= 4096 and pg_column_size(desvio) <= 4096)
);

comment on table public.gps_referencias is
  'Los valores de referencia de GPS de este club, por dispositivo (la hoja «Valores Referenciales» del Excel). Los carga un SQL; la app los lee.';

create index if not exists gps_referencias_club on public.gps_referencias (equipo_id, dispositivo, orden);

alter table public.gps_referencias enable row level security;
revoke all on table public.gps_referencias from public, anon, authenticated;
grant select on table public.gps_referencias to authenticated;

drop policy if exists gps_referencias_ver on public.gps_referencias;
create policy gps_referencias_ver on public.gps_referencias
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_ver(equipo_id));

-- La fecha del último cambio la pone la base.
create or replace function public.gps_referencias_fecha()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
revoke execute on function public.gps_referencias_fecha() from public, anon, authenticated;

drop trigger if exists gps_referencias_fecha on public.gps_referencias;
create trigger gps_referencias_fecha
  before insert or update on public.gps_referencias
  for each row execute function public.gps_referencias_fecha();

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.gps_referencias'::regclass) then
    raise exception 'gps_referencias quedó sin RLS.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gps_referencias') <> 1 then
    raise exception 'gps_referencias no tiene su política.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_referencias') then
    raise exception 'anon no puede tener permisos en gps_referencias.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee = 'authenticated' and table_schema = 'public' and table_name = 'gps_referencias'
                and privilege_type <> 'SELECT') then
    raise exception 'Desde la app, gps_referencias solo se lee.';
  end if;
end $$;

commit;

-- Que la app vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: la tabla, con su política.
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public' and tablename = 'gps_referencias'
 group by tablename;
