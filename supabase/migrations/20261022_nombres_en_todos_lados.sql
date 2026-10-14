-- =====================================================================
-- Un nombre cambiado, cambiado en todos lados (nota de Santiago del 12/10:
-- «Si se cambia un nombre u opcion dentro de ajustes de cada modulo o dentro
-- de datos basicos se tiene que reemplazar en todos los lugares donde este
-- ese nombre u opcion»; 14/10: «es automatico cuando se cambie algo» y, en
-- Partido, «se reemplaza con el nuevo nombre»).
--
--   · Lesiones, Evaluaciones, GPS y Flujo diario guardan quién es cada
--     jugador (su número) y las listas guardan el código de cada opción: ahí
--     un nombre nuevo ya se ve solo. Partido guarda los nombres escritos en
--     cada partido: esto es para Partido.
--   · jugadores_nombres_anteriores: los nombres que tuvo cada jugador. Los
--     anota la base al cambiarle el nombre; al correr esto se suman los que
--     quedaron en la foto al día (desde el 05/10).
--   · Al cambiar el nombre de un jugador, la base lo cambia en todos los
--     partidos del club: titulares, convocados, cambios (también los de la
--     guía de la transmisión) y formación. Los del rival no se tocan.
--   · Un partido que llega con un nombre anterior (cargado sin señal antes
--     del cambio y subido después) se guarda con el nombre de hoy. Si algo
--     fallara en ese paso, el partido se guarda igual, como vino.
--   · Al correr esto, los partidos que quedaron con un nombre anterior pasan
--     al de hoy.
--   · Un nombre anterior que hoy es de otro jugador, o que tuvieron dos
--     jugadores, no se cambia: no se sabe de quién es.
--   · gps_cambiar_en_descripciones: al renombrar una opción de estrategia de
--     GPS, la app cambia también el texto ya guardado en la Descripción, con
--     los permisos de quien la llama (GPS en el club).
--   · La app lee los nombres anteriores para reconocerlos al pegar una
--     planilla o cargar el CSV del GPS: los ve quien ve el plantel; nadie los
--     escribe a mano. Anon, nada.
--
-- Requiere 20261021_gps_en_curso.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps_en_curso') is null then
    raise exception 'Primero hay que correr 20261021_gps_en_curso.sql.';
  end if;
end $$;

-- ------------------------------------------- Los nombres que tuvo cada uno --

create table if not exists public.jugadores_nombres_anteriores (
  jugador_id bigint not null references public.jugadores (id) on delete cascade,
  equipo_id  uuid references public.equipos (id) on delete cascade,
  nombre     text not null,
  hasta      timestamptz not null default now(),
  primary key (jugador_id, nombre)
);

create index if not exists jugadores_nombres_anteriores_por_club
  on public.jugadores_nombres_anteriores (equipo_id);

comment on table public.jugadores_nombres_anteriores is
  'Los nombres que tuvo cada jugador (hasta: cuándo dejó de llamarse así). Los anota la base al cambiar el nombre; con ellos los partidos pasan al nombre de hoy y la app reconoce un nombre anterior al pegar.';

alter table public.jugadores_nombres_anteriores enable row level security;
revoke all on table public.jugadores_nombres_anteriores from anon, authenticated;
grant select on table public.jugadores_nombres_anteriores to authenticated;

drop policy if exists jugadores_nombres_anteriores_ver on public.jugadores_nombres_anteriores;
create policy jugadores_nombres_anteriores_ver on public.jugadores_nombres_anteriores
  for select to authenticated
  using (public.puede_editar(equipo_id));

-- ------------------------------------------------ El nombre de hoy de cada uno --

-- Los nombres anteriores de un club que pasan al de hoy:
-- { "nombre anterior, en minúsculas y sin espacios de más": "Nombre de hoy" }.
-- No van los que hoy son de otro jugador ni los que tuvieron dos jugadores.
create or replace function public.nombres_de_hoy(p_equipo uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with anteriores as (
    select lower(btrim(a.nombre)) as llave, min(a.jugador_id) as jugador_id
      from public.jugadores_nombres_anteriores a
     where a.equipo_id = p_equipo
       and btrim(a.nombre) <> ''
     group by lower(btrim(a.nombre))
    having count(distinct a.jugador_id) = 1
  )
  select coalesce(jsonb_object_agg(an.llave, j.nombre), '{}'::jsonb)
    from anteriores an
    join public.jugadores j on j.id = an.jugador_id and j.equipo_id = p_equipo
   where btrim(j.nombre) <> ''
     and not exists (
           select 1
             from public.jugadores otro
            where otro.equipo_id = p_equipo
              and otro.id <> an.jugador_id
              and lower(btrim(otro.nombre)) = an.llave);
$$;

create or replace function public.nombre_de_hoy(p_mapa jsonb, p_nombre text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_nombre is null or p_mapa is null then p_nombre
              else coalesce(p_mapa ->> lower(btrim(p_nombre)), p_nombre) end;
$$;

-- Los cambios de una lista (los de la fila y los de la guía de la
-- transmisión): cada uno con quién sale y quién entra.
create or replace function public.cambios_con_nombres_de_hoy(p_cambios jsonb, p_mapa jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_cambios) is distinct from 'array' then p_cambios
    else coalesce((
      select jsonb_agg(
               case when jsonb_typeof(e) = 'object' then
                 e || jsonb_strip_nulls(jsonb_build_object(
                   'sale', case when jsonb_typeof(e -> 'sale') = 'string' then to_jsonb(public.nombre_de_hoy(p_mapa, e ->> 'sale')) end,
                   'entra', case when jsonb_typeof(e -> 'entra') = 'string' then to_jsonb(public.nombre_de_hoy(p_mapa, e ->> 'entra')) end))
               else e end
               order by i)
        from jsonb_array_elements(p_cambios) with ordinality as t (e, i)), p_cambios)
  end;
$$;

-- Un partido con los nombres de hoy: lo nuestro (titulares, convocados,
-- cambios y formación). Lo del rival queda como está.
create or replace function public.partido_con_nombres_de_hoy(r public.registros_partido, p_mapa jsonb)
returns public.registros_partido
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_mapa is null or p_mapa = '{}'::jsonb then
    return r;
  end if;
  if r.titulares is not null then
    r.titulares := array(select public.nombre_de_hoy(p_mapa, x) from unnest(r.titulares) with ordinality as t (x, i) order by i);
  end if;
  if r.convocados is not null then
    r.convocados := array(select public.nombre_de_hoy(p_mapa, x) from unnest(r.convocados) with ordinality as t (x, i) order by i);
  end if;
  r.cambio_1_sale := public.nombre_de_hoy(p_mapa, r.cambio_1_sale);
  r.cambio_1_entra := public.nombre_de_hoy(p_mapa, r.cambio_1_entra);
  r.cambio_2_sale := public.nombre_de_hoy(p_mapa, r.cambio_2_sale);
  r.cambio_2_entra := public.nombre_de_hoy(p_mapa, r.cambio_2_entra);
  r.cambio_3_sale := public.nombre_de_hoy(p_mapa, r.cambio_3_sale);
  r.cambio_3_entra := public.nombre_de_hoy(p_mapa, r.cambio_3_entra);
  r.cambio_4_sale := public.nombre_de_hoy(p_mapa, r.cambio_4_sale);
  r.cambio_4_entra := public.nombre_de_hoy(p_mapa, r.cambio_4_entra);
  r.cambio_5_sale := public.nombre_de_hoy(p_mapa, r.cambio_5_sale);
  r.cambio_5_entra := public.nombre_de_hoy(p_mapa, r.cambio_5_entra);
  r.cambios_extra := public.cambios_con_nombres_de_hoy(r.cambios_extra, p_mapa);
  if jsonb_typeof(r.captura_tiempo -> 'cambios') = 'array' then
    r.captura_tiempo := jsonb_set(r.captura_tiempo, '{cambios}', public.cambios_con_nombres_de_hoy(r.captura_tiempo -> 'cambios', p_mapa));
  end if;
  if jsonb_typeof(r.formacion_cancha -> 'puestos') = 'object' then
    r.formacion_cancha := jsonb_set(r.formacion_cancha, '{puestos}', coalesce((
      select jsonb_object_agg(k,
               case when jsonb_typeof(v) = 'object' and jsonb_typeof(v -> 'nombre') = 'string'
                    then v || jsonb_build_object('nombre', public.nombre_de_hoy(p_mapa, v ->> 'nombre'))
                    else v end)
        from jsonb_each(r.formacion_cancha -> 'puestos') as p (k, v)), '{}'::jsonb));
  end if;
  return r;
end;
$$;

-- Los partidos de un club que tienen un nombre anterior, al de hoy. Devuelve
-- cuántos cambió.
create or replace function public.partidos_con_nombres_de_hoy(p_equipo uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapa jsonb := public.nombres_de_hoy(p_equipo);
  v_cuantos integer := 0;
  v_fila public.registros_partido;
  v_nueva public.registros_partido;
begin
  if p_equipo is null or v_mapa = '{}'::jsonb then
    return 0;
  end if;
  for v_fila in select * from public.registros_partido where equipo_id = p_equipo for update loop
    v_nueva := public.partido_con_nombres_de_hoy(v_fila, v_mapa);
    if to_jsonb(v_nueva) is distinct from to_jsonb(v_fila) then
      update public.registros_partido
         set titulares = v_nueva.titulares,
             convocados = v_nueva.convocados,
             cambio_1_sale = v_nueva.cambio_1_sale, cambio_1_entra = v_nueva.cambio_1_entra,
             cambio_2_sale = v_nueva.cambio_2_sale, cambio_2_entra = v_nueva.cambio_2_entra,
             cambio_3_sale = v_nueva.cambio_3_sale, cambio_3_entra = v_nueva.cambio_3_entra,
             cambio_4_sale = v_nueva.cambio_4_sale, cambio_4_entra = v_nueva.cambio_4_entra,
             cambio_5_sale = v_nueva.cambio_5_sale, cambio_5_entra = v_nueva.cambio_5_entra,
             cambios_extra = v_nueva.cambios_extra,
             captura_tiempo = v_nueva.captura_tiempo,
             formacion_cancha = v_nueva.formacion_cancha
       where id = v_fila.id;
      v_cuantos := v_cuantos + 1;
    end if;
  end loop;
  return v_cuantos;
end;
$$;

-- Al cambiarle el nombre a un jugador: el anterior queda anotado y los
-- partidos del club pasan al nuevo. Con los permisos de la base: quien puede
-- cambiar el nombre en Datos básicos (cualquiera del club) lo cambia también
-- en Partido, aunque no tenga Partido, como en los otros módulos.
create or replace function public.jugadores_nombre_cambiado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nombre is not distinct from old.nombre or btrim(coalesce(old.nombre, '')) = '' then
    return new;
  end if;
  insert into public.jugadores_nombres_anteriores (jugador_id, equipo_id, nombre, hasta)
  values (new.id, new.equipo_id, old.nombre, now())
  on conflict (jugador_id, nombre) do update set equipo_id = excluded.equipo_id, hasta = excluded.hasta;
  -- El de hoy no es anterior (si vuelve a un nombre que ya tuvo).
  delete from public.jugadores_nombres_anteriores
   where jugador_id = new.id and nombre = new.nombre;
  perform public.partidos_con_nombres_de_hoy(new.equipo_id);
  return new;
end;
$$;

drop trigger if exists jugadores_nombre_cambiado on public.jugadores;
create trigger jugadores_nombre_cambiado
  after update of nombre on public.jugadores
  for each row execute function public.jugadores_nombre_cambiado();

-- Un partido que llega con un nombre anterior se guarda con el de hoy. Nunca
-- frena el guardado: si algo falla, el partido va como vino.
create or replace function public.registros_con_nombres_de_hoy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapa jsonb;
begin
  begin
    if new.equipo_id is null
       or not exists (select 1 from public.jugadores_nombres_anteriores a where a.equipo_id = new.equipo_id) then
      return new;
    end if;
    v_mapa := public.nombres_de_hoy(new.equipo_id);
    return public.partido_con_nombres_de_hoy(new, v_mapa);
  exception when others then
    return new;
  end;
end;
$$;

drop trigger if exists registros_con_nombres_de_hoy on public.registros_partido;
create trigger registros_con_nombres_de_hoy
  before insert or update on public.registros_partido
  for each row execute function public.registros_con_nombres_de_hoy();

-- ------------------------------------------- Lo que ya quedó con otro nombre --

-- Los nombres que se ven en la foto al día (desde el 05/10) y ya no son el de
-- hoy, como nombres anteriores.
insert into public.jugadores_nombres_anteriores (jugador_id, equipo_id, nombre, hasta)
select j.id, j.equipo_id, v.fila ->> 'nombre', max(v.cuando)
  from public.versiones_datos v
  join public.jugadores j on j.id::text = v.fila_id
 where v.tabla = 'jugadores'
   and btrim(coalesce(v.fila ->> 'nombre', '')) <> ''
   and v.fila ->> 'nombre' <> j.nombre
   and v.equipo_id is not distinct from j.equipo_id
 group by j.id, j.equipo_id, v.fila ->> 'nombre'
on conflict (jugador_id, nombre) do nothing;

-- Y los partidos de cada club, al nombre de hoy.
do $$
begin
  perform public.partidos_con_nombres_de_hoy(e.id) from public.equipos e;
end $$;

-- ------------------------------------------ GPS: la Descripción ya guardada --

-- Al renombrar una opción de estrategia, el texto de la Descripción de las
-- filas ya guardadas: donde empieza cada parte (después de la fecha o de
-- « + »), cada nombre de antes pasa al nuevo. Con los permisos de quien la
-- llama: solo las filas que puede cambiar. Devuelve cuántas cambió.
create or replace function public.gps_cambiar_en_descripciones(p_equipo uuid, p_antes text[], p_despues text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_despues text := btrim(coalesce(p_despues, ''));
  v_antes text;
  v_patron text;
  v_reemplazo text;
  v_cuantos integer := 0;
  v_filas integer;
begin
  if p_equipo is null or v_despues = '' or char_length(v_despues) > 120 then
    raise exception 'gps_descripcion_nombre' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_antes, 1), 0) > 10 then
    raise exception 'gps_descripcion_nombre' using errcode = 'P0001';
  end if;
  v_reemplazo := '\1' || replace(v_despues, '\', '\\');
  foreach v_antes in array coalesce(p_antes, '{}'::text[]) loop
    v_antes := btrim(coalesce(v_antes, ''));
    continue when v_antes = '' or v_antes = v_despues or char_length(v_antes) > 120;
    v_patron := '(^[0-9]{4}_[0-9]{2}_[0-9]{2}[_ ]|[[:space:]][+][[:space:]])'
             || regexp_replace(v_antes, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
             || '(?=[[:space:],]|$)';
    update public.gps g
       set datos = jsonb_set(g.datos, '{descripcion}', to_jsonb(regexp_replace(g.datos ->> 'descripcion', v_patron, v_reemplazo, 'g')))
     where g.equipo_id = p_equipo
       and jsonb_typeof(g.datos -> 'descripcion') = 'string'
       and (g.datos ->> 'descripcion') ~ v_patron;
    get diagnostics v_filas = row_count;
    v_cuantos := v_cuantos + v_filas;
  end loop;
  return v_cuantos;
end;
$$;

-- ------------------------------------------------------------- Permisos --

revoke execute on function public.nombres_de_hoy(uuid),
                           public.nombre_de_hoy(jsonb, text),
                           public.cambios_con_nombres_de_hoy(jsonb, jsonb),
                           public.partido_con_nombres_de_hoy(public.registros_partido, jsonb),
                           public.partidos_con_nombres_de_hoy(uuid),
                           public.jugadores_nombre_cambiado(),
                           public.registros_con_nombres_de_hoy()
  from public, anon, authenticated;
revoke execute on function public.gps_cambiar_en_descripciones(uuid, text[], text) from public, anon;
grant execute on function public.gps_cambiar_en_descripciones(uuid, text[], text) to authenticated;

commit;
