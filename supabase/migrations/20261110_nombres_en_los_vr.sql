-- =====================================================================
-- Un nombre cambiado, también en los V.R. por jugador del GPS (Santiago,
-- 20/10, en un cuestionario: «Sí, que cambien»). Los V.R. por jugador
-- (los del Excel, 20261026) llevan el nombre del jugador escrito en `grupo`
-- (tipo «Microciclo», tabla «Partidos», grupo: el jugador). Al cambiarle el
-- nombre a un jugador en Datos básicos, como en los partidos (20261022):
--
--   · Los V.R. del GPS del club con un nombre anterior de ese jugador en
--     `grupo` pasan al de hoy. Queda en los últimos cambios de Valores de
--     referencia, como cualquier cambio de nombre (con quién lo hizo y
--     «Volver»).
--   · Los mismos cuidados que en los partidos: un nombre anterior que hoy
--     es de otro jugador, o que tuvieron dos, no se cambia; el tipo y la
--     tabla no se tocan.
--   · Si en esa tabla ya hay un V.R. con el nombre nuevo, ese V.R. queda
--     como está (no puede haber dos iguales).
--   · Nunca frena el cambio de nombre: si algo fallara en este paso, el
--     nombre se cambia igual y los V.R. quedan como estaban.
--   · Al correr esto, los V.R. que quedaron con un nombre anterior pasan al
--     de hoy.
--
-- Requiere 20261024_gps_referencias.sql y 20261109_nombres_con_listas_json.sql.
-- Se corre en Supabase > SQL Editor, entera y de una vez. Solo cambia
-- nombres anteriores por el de hoy en los V.R., como al cambiar un nombre.
-- Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps_referencias') is null then
    raise exception 'Primero hay que correr 20261024_gps_referencias.sql.';
  end if;
  if coalesce((select position('unnest(r.titulares)' in p.prosrc) = 0 from pg_proc p
                where p.oid = to_regprocedure('public.partido_con_nombres_de_hoy(public.registros_partido, jsonb)')), false) is false then
    raise exception 'Primero hay que correr 20261109_nombres_con_listas_json.sql.';
  end if;
end $$;

-- Los V.R. del GPS de un club con un nombre anterior en `grupo`, al de hoy.
-- Devuelve cuántos cambió.
create or replace function public.gps_referencias_con_nombres_de_hoy(p_equipo uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapa jsonb := public.nombres_de_hoy(p_equipo);
  v_cuantos integer := 0;
begin
  if p_equipo is null or v_mapa = '{}'::jsonb then
    return 0;
  end if;
  with candidatos as (
    select r.id, r.dispositivo, r.tipo, r.tabla, v_mapa ->> lower(btrim(r.grupo)) as nuevo
      from public.gps_referencias r
     where r.equipo_id = p_equipo
       and btrim(r.grupo) <> ''
       and v_mapa ? lower(btrim(r.grupo))
       and r.grupo is distinct from v_mapa ->> lower(btrim(r.grupo))
  ),
  cambian as (
    select c.id, c.nuevo,
           row_number() over (partition by c.dispositivo, c.tipo, c.tabla, c.nuevo order by c.id) as n
      from candidatos c
     where char_length(c.nuevo) between 1 and 120
       and not exists (select 1 from public.gps_referencias otro
                        where otro.equipo_id = p_equipo and otro.dispositivo = c.dispositivo
                          and otro.tipo = c.tipo and otro.tabla = c.tabla and otro.grupo = c.nuevo)
  )
  update public.gps_referencias r
     set grupo = c.nuevo
    from cambian c
   where r.id = c.id
     and c.n = 1;
  get diagnostics v_cuantos = row_count;
  return v_cuantos;
end;
$$;

-- Al cambiarle el nombre a un jugador: lo de 20261022 (el anterior queda
-- anotado y los partidos del club pasan al nuevo) y, además, los V.R. del
-- GPS. Con los permisos de la base, como los partidos.
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
  -- Los V.R. nunca frenan el cambio de nombre.
  begin
    perform public.gps_referencias_con_nombres_de_hoy(new.equipo_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- Los permisos, como en 20261022: solo la base las usa.
revoke execute on function public.gps_referencias_con_nombres_de_hoy(uuid),
                           public.jugadores_nombre_cambiado()
  from public, anon, authenticated;

-- Y los V.R. de cada club, al nombre de hoy.
do $$
begin
  perform public.gps_referencias_con_nombres_de_hoy(e.id) from public.equipos e;
end $$;

commit;
