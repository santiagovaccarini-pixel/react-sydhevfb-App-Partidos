-- =====================================================================
-- GPS: los V.R. por jugador, con sus cinco categorías. Santiago, 15/10:
-- «en el caso de jugador ya tiene las 5 categorias entonces no se usa
-- desvio» y «agarres todos los VR de los jugadores y los pongas en un SQL
-- para poder cargarlo». En la hoja «Valores Referenciales» del Excel cada
-- jugador tiene Excelente, Muy Bueno, Bueno, Regular y Malo; en la tabla
-- «Partidos» no salen del promedio y el desvío (el tiempo no baja de 95
-- minutos y algunas medidas se ajustaron a mano), así que se guardan las
-- cinco tal cual.
--
--   · gps_referencias.categorias: { excelente, muy_bueno, regular, malo },
--     cada una { clave de la columna: número } (el tiempo, en segundos). El
--     Bueno es el promedio. Un V.R. sin categorías sigue como hasta ahora:
--     sus franjas salen del promedio y el desvío.
--   · gps_referencia_cambiar cambia también un número de una categoría
--     (p_cual: 'excelente', 'muy_bueno', 'regular' o 'malo'); sin número, se
--     borra. Queda en el historial, como lo demás (la base anota la fila
--     entera).
--
-- Requiere 20261025_referencias_editables.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. Solo agrega: la app de antes sigue andando.
-- Se puede volver a correr. Después de esta, 20261025 ya no se vuelve a
-- correr (se frena sola: le sacaría a la app lo de cambiar las categorías).
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'gps_referencias' and column_name = 'de_partido') then
    raise exception 'Primero hay que correr 20261025_referencias_editables.sql.';
  end if;
end $$;

alter table public.gps_referencias
  add column if not exists categorias jsonb not null default '{}'::jsonb;

comment on column public.gps_referencias.categorias is
  'Las categorías de un V.R. por jugador: excelente, muy_bueno, regular y malo, cada una { columna: número }; el Bueno es el promedio. Vacío: las franjas salen del promedio y el desvío.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gps_referencias_categorias') then
    alter table public.gps_referencias
      add constraint gps_referencias_categorias check (
        jsonb_typeof(categorias) = 'object' and pg_column_size(categorias) <= 16384);
  end if;
end $$;

-- Solo las cuatro categorías, cada una con números. Lo que no es un objeto
-- lo frena gps_referencias_categorias.
create or replace function public.gps_referencias_validar_categorias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if jsonb_typeof(new.categorias) = 'object' and exists (
       select 1
         from jsonb_each(new.categorias) c
        where c.key not in ('excelente', 'muy_bueno', 'regular', 'malo')
           or case when jsonb_typeof(c.value) = 'object'
                   then exists (select 1 from jsonb_each(c.value) e where jsonb_typeof(e.value) <> 'number')
                   else true
              end) then
    raise exception 'gps_referencias_numeros' using errcode = '23514',
      hint = 'Las categorías de un V.R. son excelente, muy_bueno, regular y malo, cada una con números.';
  end if;
  return new;
end;
$$;
revoke execute on function public.gps_referencias_validar_categorias() from public, anon, authenticated;

drop trigger if exists gps_referencias_validar_categorias on public.gps_referencias;
create trigger gps_referencias_validar_categorias
  before insert or update on public.gps_referencias
  for each row execute function public.gps_referencias_validar_categorias();

-- Se suman y se cambian desde la app, como el promedio y el desvío.
grant insert (categorias) on table public.gps_referencias to authenticated;
grant update (categorias) on table public.gps_referencias to authenticated;

-- Un número de un V.R. (p_cual: 'promedio', 'desvio' o una categoría;
-- p_clave: la columna). Sin número, se borra (y una categoría que se queda
-- sin números, también). Con los permisos de quien lo pide.
create or replace function public.gps_referencia_cambiar(p_id uuid, p_cual text, p_clave text, p_valor numeric)
returns public.gps_referencias
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fila public.gps_referencias;
begin
  if p_cual is null or p_cual not in ('promedio', 'desvio', 'excelente', 'muy_bueno', 'regular', 'malo')
     or p_clave is null or p_clave !~ '^[a-z][a-z0-9_]{0,59}$' then
    raise exception 'referencia_invalida' using errcode = '22023';
  end if;
  if p_cual = 'promedio' then
    update public.gps_referencias r
       set promedio = case when p_valor is null then r.promedio - p_clave else jsonb_set(r.promedio, array[p_clave], to_jsonb(p_valor), true) end
     where r.id = p_id
    returning * into v_fila;
  elsif p_cual = 'desvio' then
    update public.gps_referencias r
       set desvio = case when p_valor is null then r.desvio - p_clave else jsonb_set(r.desvio, array[p_clave], to_jsonb(p_valor), true) end
     where r.id = p_id
    returning * into v_fila;
  else
    update public.gps_referencias r
       set categorias = case
             when p_valor is not null then
               jsonb_set(r.categorias, array[p_cual], coalesce(r.categorias -> p_cual, '{}'::jsonb) || jsonb_build_object(p_clave, to_jsonb(p_valor)), true)
             when not (r.categorias ? p_cual) then r.categorias
             when (r.categorias -> p_cual) - p_clave = '{}'::jsonb then r.categorias - p_cual
             else jsonb_set(r.categorias, array[p_cual], (r.categorias -> p_cual) - p_clave, true)
           end
     where r.id = p_id
    returning * into v_fila;
  end if;
  if v_fila.id is null then
    raise exception 'referencia_sin_permiso' using errcode = '42501';
  end if;
  return v_fila;
end;
$$;

revoke execute on function public.gps_referencia_cambiar(uuid, text, text, numeric) from public, anon;
grant execute on function public.gps_referencia_cambiar(uuid, text, text, numeric) to authenticated;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  -- Sus cuatro políticas, por nombre: después se suman otras (las de los
  -- niveles de permiso, 20261029), y así se puede correr también más tarde.
  if not (select relrowsecurity from pg_class where oid = 'public.gps_referencias'::regclass)
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gps_referencias'
          and policyname in ('gps_referencias_ver', 'gps_referencias_sumar', 'gps_referencias_cambiar', 'gps_referencias_borrar')) <> 4 then
    raise exception 'gps_referencias no tiene sus cuatro políticas.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_referencias') then
    raise exception 'anon no puede tener permisos en los V.R.';
  end if;
  if exists (select 1 from information_schema.column_privileges
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_referencias') then
    raise exception 'anon no puede tener permisos en las columnas de los V.R.';
  end if;
  if not exists (select 1 from information_schema.column_privileges
                  where grantee = 'authenticated' and table_schema = 'public' and table_name = 'gps_referencias'
                    and column_name = 'categorias' and privilege_type = 'UPDATE') then
    raise exception 'Las categorías de los V.R. no se pueden cambiar desde la app.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'referencias_historial_anotar'
                  and tgrelid = 'public.gps_referencias'::regclass) then
    raise exception 'Los cambios de los V.R. de GPS quedaron sin historial.';
  end if;
end $$;

commit;

-- Que la app vea la columna nueva sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: los V.R. de cada club, cuántos tienen categorías.
select e.nombre as club, r.dispositivo, count(*) as vr, count(*) filter (where r.categorias <> '{}'::jsonb) as con_categorias
  from public.gps_referencias r
  join public.equipos e on e.id = r.equipo_id
 group by e.nombre, r.dispositivo
 order by e.nombre, r.dispositivo;
