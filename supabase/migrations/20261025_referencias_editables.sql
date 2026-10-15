-- =====================================================================
-- Los valores de referencia (V.R.) se cambian desde la app. Santiago,
-- 14/10: «pero no puedo editar nada del vr, ademas acordate que todos los
-- vr van aparte»; «Todos los vr tienen que tener su solapa aparte» (una
-- solapa «Valores de referencia» en cada base); los cambia quien tenga
-- «acceso a las bases y permisos para editarla»; con historial y «volver
-- atrás»; el V.R. de partido de Reglas de carga se une con los de GPS: «El
-- de partido de cada dispositivo».
--
--   · gps_referencias y evaluaciones_referencias se cambian, se suman y se
--     borran desde la app: quien tiene ese módulo en el club y sigue en él.
--     Un número se cambia de a uno, en la base (gps_referencia_cambiar y
--     evaluaciones_referencia_cambiar): dos personas a la vez no se pisan.
--   · referencias_historial: cada cambio, quién y cuándo, cómo estaba y
--     cómo quedó. Lo anota la base (también lo que se cambie por SQL). Lo
--     ve quien puede cambiar esos V.R.
--   · gps_referencias.de_partido: el V.R. de partido de cada dispositivo
--     (uno como mucho). Cargar usa el del dispositivo de la carga. El V.R.
--     de partido que cada club tenía en Reglas de carga pasa a cada uno de
--     sus dispositivos que no tenga uno («PARTIDO · V.R. de partido ·
--     TOTAL»): Cargar sigue dando lo mismo. Sale de las reglas, así queda
--     en un solo lugar (un club sin dispositivos lo conserva en las reglas).
--   · Lo que cambia otra persona aparece sin recargar (Realtime).
--
-- Requiere 20261024_gps_referencias.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez, con la versión de la app que tiene la solapa
-- «Valores de referencia» ya publicada. Se puede volver a correr, salvo
-- después de 20261026_gps_referencias_categorias.sql: ahí se frena sola (le
-- sacaría a la app lo de cambiar las categorías de los V.R. por jugador).
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps_referencias') is null then
    raise exception 'Primero hay que correr 20261024_gps_referencias.sql.';
  end if;
  if to_regclass('public.evaluaciones_referencias') is null then
    raise exception 'Primero hay que correr 20261012_evaluaciones.sql.';
  end if;
  if to_regclass('public.gps_reglas') is null then
    raise exception 'Primero hay que correr 20261020_gps_reglas.sql.';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'gps_referencias' and column_name = 'categorias') then
    raise exception 'Ya está corrida 20261026_gps_referencias_categorias.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

-- --------------------------------------------------------------- GPS --

alter table public.gps_referencias
  add column if not exists de_partido boolean not null default false;

comment on column public.gps_referencias.de_partido is
  'El V.R. de partido de su dispositivo (uno como mucho): Cargar calcula el % vs V.R. de partido con este.';

-- El promedio y el desvío de cada columna son números (un texto no entra).
-- Lo que no es un objeto lo frena gps_referencias_valores.
create or replace function public.gps_referencias_validar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (jsonb_typeof(new.promedio) = 'object' and exists (select 1 from jsonb_each(new.promedio) e where jsonb_typeof(e.value) <> 'number'))
     or (jsonb_typeof(new.desvio) = 'object' and exists (select 1 from jsonb_each(new.desvio) e where jsonb_typeof(e.value) <> 'number')) then
    raise exception 'gps_referencias_numeros' using errcode = '23514', hint = 'Cada valor de un V.R. es un número.';
  end if;
  return new;
end;
$$;
revoke execute on function public.gps_referencias_validar() from public, anon, authenticated;

drop trigger if exists gps_referencias_validar on public.gps_referencias;
create trigger gps_referencias_validar
  before insert or update on public.gps_referencias
  for each row execute function public.gps_referencias_validar();

create unique index if not exists gps_referencias_un_partido
  on public.gps_referencias (equipo_id, dispositivo) where de_partido;

comment on table public.gps_referencias is
  'Los valores de referencia de GPS de este club, por dispositivo. Se ven y se cambian en GPS › Valores de referencia.';

revoke all on table public.gps_referencias from public, anon, authenticated;
grant select on table public.gps_referencias to authenticated;
grant insert (equipo_id, dispositivo, tipo, tabla, grupo, orden, promedio, desvio, de_partido) on table public.gps_referencias to authenticated;
grant update (tipo, tabla, grupo, orden, promedio, desvio, de_partido) on table public.gps_referencias to authenticated;
grant delete on table public.gps_referencias to authenticated;

-- Ver, como antes (también quien se fue, para mirar). Cambiar, sumar y
-- borrar: quien tiene GPS en el club y sigue en él.
drop policy if exists gps_referencias_sumar on public.gps_referencias;
create policy gps_referencias_sumar on public.gps_referencias
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

drop policy if exists gps_referencias_cambiar on public.gps_referencias;
create policy gps_referencias_cambiar on public.gps_referencias
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

drop policy if exists gps_referencias_borrar on public.gps_referencias;
create policy gps_referencias_borrar on public.gps_referencias
  for delete to authenticated
  using (public.puede_usar_en(equipo_id, 'gps') and public.puede_editar(equipo_id));

-- Un número de un V.R. (p_cual: 'promedio' o 'desvio'; p_clave: la
-- columna). Sin número, se borra. Con los permisos de quien lo pide.
create or replace function public.gps_referencia_cambiar(p_id uuid, p_cual text, p_clave text, p_valor numeric)
returns public.gps_referencias
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fila public.gps_referencias;
begin
  if p_cual is null or p_cual not in ('promedio', 'desvio') or p_clave is null or p_clave !~ '^[a-z][a-z0-9_]{0,59}$' then
    raise exception 'referencia_invalida' using errcode = '22023';
  end if;
  if p_cual = 'promedio' then
    update public.gps_referencias r
       set promedio = case when p_valor is null then r.promedio - p_clave else jsonb_set(r.promedio, array[p_clave], to_jsonb(p_valor), true) end
     where r.id = p_id
    returning * into v_fila;
  else
    update public.gps_referencias r
       set desvio = case when p_valor is null then r.desvio - p_clave else jsonb_set(r.desvio, array[p_clave], to_jsonb(p_valor), true) end
     where r.id = p_id
    returning * into v_fila;
  end if;
  if v_fila.id is null then
    raise exception 'referencia_sin_permiso' using errcode = '42501';
  end if;
  return v_fila;
end;
$$;

-- Marca (o desmarca) el V.R. de partido de su dispositivo: el que estaba
-- deja de serlo. Devuelve los V.R. de ese dispositivo.
create or replace function public.gps_referencia_de_partido(p_id uuid, p_marcar boolean)
returns setof public.gps_referencias
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_equipo uuid;
  v_dispositivo text;
begin
  select r.equipo_id, r.dispositivo into v_equipo, v_dispositivo
    from public.gps_referencias r
   where r.id = p_id;
  if v_equipo is null then
    raise exception 'referencia_sin_permiso' using errcode = '42501';
  end if;
  if coalesce(p_marcar, false) then
    update public.gps_referencias r
       set de_partido = false
     where r.equipo_id = v_equipo and r.dispositivo = v_dispositivo and r.de_partido and r.id <> p_id;
  end if;
  update public.gps_referencias r
     set de_partido = coalesce(p_marcar, false)
   where r.id = p_id;
  if not found then
    raise exception 'referencia_sin_permiso' using errcode = '42501';
  end if;
  return query
    select r.* from public.gps_referencias r
     where r.equipo_id = v_equipo and r.dispositivo = v_dispositivo
     order by r.orden, r.id;
end;
$$;

revoke execute on function public.gps_referencia_cambiar(uuid, text, text, numeric) from public, anon;
revoke execute on function public.gps_referencia_de_partido(uuid, boolean) from public, anon;
grant execute on function public.gps_referencia_cambiar(uuid, text, text, numeric) to authenticated;
grant execute on function public.gps_referencia_de_partido(uuid, boolean) to authenticated;

-- ------------------------------------------------------- Evaluaciones --

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evaluaciones_referencias_tamano') then
    alter table public.evaluaciones_referencias
      add constraint evaluaciones_referencias_tamano check (pg_column_size(datos) <= 262144);
  end if;
end $$;

comment on table public.evaluaciones_referencias is
  'Los valores de referencia (V.R.) de cada test en cada club. Se ven y se cambian en Evaluaciones › Valores de referencia.';

-- La fecha del último cambio la pone la base.
create or replace function public.evaluaciones_referencias_fecha()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
revoke execute on function public.evaluaciones_referencias_fecha() from public, anon, authenticated;

drop trigger if exists evaluaciones_referencias_fecha on public.evaluaciones_referencias;
create trigger evaluaciones_referencias_fecha
  before insert or update on public.evaluaciones_referencias
  for each row execute function public.evaluaciones_referencias_fecha();

revoke all on table public.evaluaciones_referencias from public, anon, authenticated;
grant select on table public.evaluaciones_referencias to authenticated;
grant insert (equipo_id, test, datos) on table public.evaluaciones_referencias to authenticated;
grant update (datos) on table public.evaluaciones_referencias to authenticated;
grant delete on table public.evaluaciones_referencias to authenticated;

drop policy if exists evaluaciones_referencias_sumar on public.evaluaciones_referencias;
create policy evaluaciones_referencias_sumar on public.evaluaciones_referencias
  for insert to authenticated
  with check (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

drop policy if exists evaluaciones_referencias_cambiar on public.evaluaciones_referencias;
create policy evaluaciones_referencias_cambiar on public.evaluaciones_referencias
  for update to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

drop policy if exists evaluaciones_referencias_borrar on public.evaluaciones_referencias;
create policy evaluaciones_referencias_borrar on public.evaluaciones_referencias
  for delete to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

-- Un valor de los V.R. de un test: p_ruta, dónde (por ejemplo
-- {categorias,mayor,bueno,lumbar}); p_valor, un número, un bloque entero
-- (al volver atrás un borrado) o nada (se borra). Si el test todavía no
-- tiene V.R., los empieza. Con los permisos de quien lo pide. Devuelve los
-- V.R. del test como quedaron.
create or replace function public.evaluaciones_referencia_cambiar(p_equipo uuid, p_test text, p_ruta text[], p_valor jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_datos jsonb;
  v_largo integer := coalesce(array_length(p_ruta, 1), 0);
  i integer;
begin
  if v_largo < 2 or v_largo > 6 or p_ruta[1] not in ('categorias', 'resumen')
     or exists (select 1 from unnest(p_ruta) parte where parte is null or char_length(parte) not between 1 and 60) then
    raise exception 'referencia_invalida' using errcode = '22023';
  end if;
  if p_valor is not null and jsonb_typeof(p_valor) not in ('number', 'object', 'null') then
    raise exception 'referencia_invalida' using errcode = '22023';
  end if;

  select r.id, r.datos into v_id, v_datos
    from public.evaluaciones_referencias r
   where r.equipo_id = p_equipo and r.test = p_test
     for update;
  if v_id is null then
    insert into public.evaluaciones_referencias (equipo_id, test, datos)
    values (p_equipo, p_test, '{}'::jsonb)
    returning id, datos into v_id, v_datos;
  end if;

  -- Lo de en medio, si falta, se arma (una categoría nueva, una fila nueva).
  for i in 1 .. v_largo - 1 loop
    if jsonb_typeof(v_datos #> p_ruta[1:i]) is distinct from 'object' then
      v_datos := jsonb_set(v_datos, p_ruta[1:i], '{}'::jsonb, true);
    end if;
  end loop;
  if p_valor is null or jsonb_typeof(p_valor) = 'null' then
    v_datos := v_datos #- p_ruta;
  else
    v_datos := jsonb_set(v_datos, p_ruta, p_valor, true);
  end if;

  update public.evaluaciones_referencias r
     set datos = v_datos
   where r.id = v_id
  returning r.datos into v_datos;
  if not found then
    raise exception 'referencia_sin_permiso' using errcode = '42501';
  end if;
  return v_datos;
end;
$$;

revoke execute on function public.evaluaciones_referencia_cambiar(uuid, text, text[], jsonb) from public, anon;
grant execute on function public.evaluaciones_referencia_cambiar(uuid, text, text[], jsonb) to authenticated;

-- --------------------------------------------------------- Historial --

create table if not exists public.referencias_historial (
  id          bigint generated always as identity primary key,
  tabla       text not null check (tabla in ('gps_referencias', 'evaluaciones_referencias')),
  fila_id     uuid not null,
  equipo_id   uuid,
  accion      text not null check (accion in ('creada', 'editada', 'borrada')),
  quien       uuid,
  quien_email text not null default '',
  cuando      timestamptz not null default now(),
  antes       jsonb,
  despues     jsonb
);

comment on table public.referencias_historial is
  'Cada cambio de los V.R. (GPS y Evaluaciones): quién, cuándo, cómo estaba y cómo quedó. Lo escribe un disparador; se ve en la solapa Valores de referencia, con «Volver».';

create index if not exists referencias_historial_por_club on public.referencias_historial (equipo_id, tabla, cuando desc);

create or replace function public.referencias_historial_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correo text := coalesce((select p.email from public.perfiles p where p.user_id = auth.uid()), '');
begin
  if tg_op = 'INSERT' then
    insert into public.referencias_historial (tabla, fila_id, equipo_id, accion, quien, quien_email, despues)
    values (tg_table_name, new.id, new.equipo_id, 'creada', auth.uid(), v_correo, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    -- Solo la fecha (o nada) no es un cambio.
    if (to_jsonb(old) - 'actualizado_en') = (to_jsonb(new) - 'actualizado_en') then
      return new;
    end if;
    insert into public.referencias_historial (tabla, fila_id, equipo_id, accion, quien, quien_email, antes, despues)
    values (tg_table_name, new.id, new.equipo_id, 'editada', auth.uid(), v_correo, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.referencias_historial (tabla, fila_id, equipo_id, accion, quien, quien_email, antes)
    values (tg_table_name, old.id, old.equipo_id, 'borrada', auth.uid(), v_correo, to_jsonb(old));
    return old;
  end if;
end;
$$;
revoke execute on function public.referencias_historial_anotar() from public, anon, authenticated;

drop trigger if exists referencias_historial_anotar on public.gps_referencias;
create trigger referencias_historial_anotar
  after insert or update or delete on public.gps_referencias
  for each row execute function public.referencias_historial_anotar();

drop trigger if exists referencias_historial_anotar on public.evaluaciones_referencias;
create trigger referencias_historial_anotar
  after insert or update or delete on public.evaluaciones_referencias
  for each row execute function public.referencias_historial_anotar();

alter table public.referencias_historial enable row level security;
revoke all on table public.referencias_historial from public, anon, authenticated;
grant select on table public.referencias_historial to authenticated;

-- Lo ve quien puede cambiar esos V.R. (el módulo en ese club, y seguir en él).
drop policy if exists referencias_historial_ver on public.referencias_historial;
create policy referencias_historial_ver on public.referencias_historial
  for select to authenticated
  using (
    case tabla
      when 'gps_referencias' then public.puede_usar_en(equipo_id, 'gps')
      when 'evaluaciones_referencias' then public.puede_usar_en(equipo_id, 'evaluaciones')
      else false
    end
    and public.puede_editar(equipo_id)
  );

-- ------------------------------------- El V.R. de partido, a GPS --

-- El de Reglas de carga (uno por club) pasa a cada dispositivo del club que
-- no tenga uno de partido, con los mismos números: Cargar sigue dando lo
-- mismo. Después sale de las reglas (si el club no tiene dispositivos,
-- queda: no hay a dónde pasarlo).
do $$
declare
  v_club record;
  v_vr jsonb;
begin
  for v_club in
    select g.equipo_id, g.reglas -> 'vrPartido' as vr
      from public.gps_reglas g
     where g.reglas ? 'vrPartido'
  loop
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_vr
      from jsonb_each(case when jsonb_typeof(v_club.vr) = 'object' then v_club.vr else '{}'::jsonb end) e
     where jsonb_typeof(e.value) = 'number' and (e.value #>> '{}')::numeric > 0 and e.key ~ '^[a-z][a-z0-9_]{0,59}$';
    if v_vr <> '{}'::jsonb then
      if not exists (select 1 from public.gps_opciones o where o.equipo_id = v_club.equipo_id and o.lista = 'dispositivo') then
        continue;
      end if;
      insert into public.gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo, orden, promedio, desvio, de_partido)
      select v_club.equipo_id, o.codigo, 'PARTIDO', 'V.R. de partido', 'TOTAL', 0, v_vr, '{}'::jsonb, true
        from public.gps_opciones o
       where o.equipo_id = v_club.equipo_id and o.lista = 'dispositivo'
         and not exists (select 1 from public.gps_referencias x
                          where x.equipo_id = v_club.equipo_id and x.dispositivo = o.codigo and x.de_partido)
      on conflict (equipo_id, dispositivo, tipo, tabla, grupo) do nothing;
    end if;
    update public.gps_reglas g set reglas = g.reglas - 'vrPartido' where g.equipo_id = v_club.equipo_id;
  end loop;
end $$;

-- ------------------------------------------------- Sin recargar --

do $$
declare
  v_tabla text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach v_tabla in array array['gps_referencias', 'evaluaciones_referencias'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_tabla
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_tabla);
    end if;
  end loop;
end $$;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.referencias_historial'::regclass) then
    raise exception 'referencias_historial quedó sin RLS.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gps_referencias') <> 4 then
    raise exception 'gps_referencias no tiene sus cuatro políticas.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'evaluaciones_referencias') <> 4 then
    raise exception 'evaluaciones_referencias no tiene sus cuatro políticas.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public'
                and table_name in ('gps_referencias', 'evaluaciones_referencias', 'referencias_historial')) then
    raise exception 'anon no puede tener permisos en los V.R.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee = 'authenticated' and table_schema = 'public' and table_name = 'referencias_historial'
                and privilege_type <> 'SELECT') then
    raise exception 'El historial de los V.R. solo se lee.';
  end if;
end $$;

commit;

-- Que la app vea lo nuevo sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: las políticas de cada tabla y los V.R. de partido
-- de cada club.
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public' and tablename in ('gps_referencias', 'evaluaciones_referencias', 'referencias_historial')
 group by tablename
 order by tablename;
