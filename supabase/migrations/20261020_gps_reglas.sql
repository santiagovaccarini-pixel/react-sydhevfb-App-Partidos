-- =====================================================================
-- GPS › Cargar (paso 2): los números de las reglas de la carga de cada día
-- (la plantilla «Suma de Bloques»), que el club cambia en Ajustes › Reglas
-- de carga (Santiago, 10/10: «Los números de las reglas … quedan en
-- Ajustes»; los cortes del regenerativo y de los que no entrenaron, apagados).
--
--   · gps_reglas: una fila por club con sus reglas (jsonb). Sin fila, valen
--     las de la plantilla (src/domain/gps/cargar.js, REGLAS_CARGA).
--   · Las ve quien tiene GPS en el club (también quien se fue, para mirar);
--     las cambia quien sigue. Anon, nada.
--
-- Requiere 20261016_gps.sql. Se corre en Supabase > SQL Editor, entera y de
-- una vez. Solo agrega: la app de antes sigue andando. Se puede volver a
-- correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null then
    raise exception 'Primero hay que correr 20261016_gps.sql.';
  end if;
end $$;

create table if not exists public.gps_reglas (
  equipo_id      uuid primary key references public.equipos (id) on delete cascade,
  reglas         jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  constraint gps_reglas_objeto check (jsonb_typeof(reglas) = 'object' and pg_column_size(reglas) <= 4096)
);

comment on table public.gps_reglas is
  'Los números de las reglas de GPS › Cargar de este club (la plantilla Suma de Bloques). Sin fila, valen los de la plantilla.';

alter table public.gps_reglas enable row level security;
revoke all on table public.gps_reglas from public, anon, authenticated;
grant select, insert, update on table public.gps_reglas to authenticated;

drop policy if exists gps_reglas_ver on public.gps_reglas;
create policy gps_reglas_ver on public.gps_reglas
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_ver(equipo_id));

drop policy if exists gps_reglas_crear on public.gps_reglas;
create policy gps_reglas_crear on public.gps_reglas
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

drop policy if exists gps_reglas_cambiar on public.gps_reglas;
create policy gps_reglas_cambiar on public.gps_reglas
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

-- La fecha del último cambio la pone la base.
create or replace function public.gps_reglas_fecha()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
revoke execute on function public.gps_reglas_fecha() from public, anon, authenticated;

drop trigger if exists gps_reglas_fecha on public.gps_reglas;
create trigger gps_reglas_fecha
  before insert or update on public.gps_reglas
  for each row execute function public.gps_reglas_fecha();

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.gps_reglas'::regclass) then
    raise exception 'gps_reglas quedó sin RLS.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gps_reglas') <> 3 then
    raise exception 'gps_reglas no tiene sus tres políticas.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_reglas') then
    raise exception 'anon no puede tener permisos en gps_reglas.';
  end if;
end $$;

commit;

-- Que la app vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: la tabla, con sus políticas.
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public' and tablename = 'gps_reglas'
 group by tablename;
