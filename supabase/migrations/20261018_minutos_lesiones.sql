-- =====================================================================
-- Las horas de Lesiones c/1000h salen del GPS (Santiago, 03/10: «después
-- vamos a meter todas las bases dentro de la web y ahí se van a conectar
-- entre sí»; 11/10, la nota de los tiempos de selección).
--
--   · Los minutos de un jugador en un día: «Minutos Campo» + «Minutos
--     Fuerza Metabólico» de todas sus filas del GPS de ese día (las de cada
--     tarea y las del total de la sesión), como la hoja «BD GPS» del Excel de
--     lesiones (sus columnas C y D). El promedio del equipo (Team Average) no
--     es de nadie: no cuenta. Los minutos van exactos, como están en el GPS
--     (en el Excel quedaron redondeados al copiarlos).
--   · La selección: las filas de un jugador convocado son solo suyas. Se
--     marcan aparte (seleccion) para que cuenten en las horas de ese jugador
--     y no en las del plantel (Santiago, 11/10). Hasta que se defina una
--     marca fija, se reconocen por la Descripción, que dice «Selección».
--   · minutos_de_entrenamiento(club) da, por jugador (o persona fuera de
--     Datos básicos), día y si es de la selección, los minutos sumados: nada
--     más del GPS. La ve quien tiene Lesiones en el club, aunque no tenga GPS.
--     Quien ya se fue ve la foto de su último día. Anon, nada.
--
-- Requiere 20261016_gps.sql. Se corre en Supabase > SQL Editor, entera y de
-- una vez. Solo agrega: la app de antes sigue andando. Se puede volver a
-- correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null or to_regclass('public.versiones_datos') is null then
    raise exception 'Primero hay que correr 20261016_gps.sql.';
  end if;
end $$;

-- Los minutos de entrenamiento de una fila del GPS (sus datos).
create or replace function public.gps_minutos_de_fila(p_datos jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(case when jsonb_typeof(p_datos -> 'min_campo') = 'number' then (p_datos ->> 'min_campo')::numeric end, 0)
       + coalesce(case when jsonb_typeof(p_datos -> 'min_fuerza') = 'number' then (p_datos ->> 'min_fuerza')::numeric end, 0);
$$;

-- Si una fila del GPS es de la selección: por ahora, la Descripción dice
-- «Selección» (con o sin tilde, en mayúsculas o no).
create or replace function public.gps_es_de_seleccion(p_datos jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(translate(lower(p_datos ->> 'descripcion'), 'áéíóúü', 'aeiouu') like '%seleccion%', false);
$$;

create or replace function public.minutos_de_entrenamiento(p_equipo uuid)
returns table (jugador_id bigint, persona text, fecha date, seleccion boolean, minutos numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hasta date;
  v_corte timestamptz;
begin
  v_hasta := public.acceso_club(p_equipo);
  if v_hasta is null or not public.puede_usar_en(p_equipo, 'lesiones') then
    return;
  end if;
  -- Quien sigue en el club: el GPS de hoy.
  if v_hasta = 'infinity'::date then
    return query
      select g.jugador_id, g.persona, g.fecha, public.gps_es_de_seleccion(g.datos),
             sum(public.gps_minutos_de_fila(g.datos))
        from public.gps g
       where g.equipo_id = p_equipo
         and g.promedio is null
       group by 1, 2, 3, 4
      having sum(public.gps_minutos_de_fila(g.datos)) <> 0
       order by 3, 1, 2, 4;
    return;
  end if;
  -- Quien ya se fue: la última versión de cada fila antes del corte, como la
  -- foto de datos_al_dia('gps', …).
  v_corte := (v_hasta + 1)::timestamp at time zone public.zona_del_club(p_equipo);
  return query
    select (x.fila ->> 'jugador_id')::bigint, x.fila ->> 'persona', (x.fila ->> 'fecha')::date,
           public.gps_es_de_seleccion(x.fila -> 'datos'),
           sum(public.gps_minutos_de_fila(x.fila -> 'datos'))
      from (select distinct on (v.fila_id) v.fila, v.accion, v.equipo_id
              from public.versiones_datos v
             where v.tabla = 'gps'
               and v.cuando < v_corte
               and v.fila_id in (select w.fila_id from public.versiones_datos w
                                  where w.tabla = 'gps' and w.equipo_id = p_equipo and w.cuando < v_corte)
             order by v.fila_id, v.cuando desc, v.id desc) x
     where x.accion <> 'borrada'
       and x.equipo_id = p_equipo
       and x.fila ->> 'promedio' is null
       and x.fila ->> 'fecha' is not null
     group by 1, 2, 3, 4
    having sum(public.gps_minutos_de_fila(x.fila -> 'datos')) <> 0
     order by 3, 1, 2, 4;
end;
$$;

comment on function public.minutos_de_entrenamiento(uuid) is
  'Los minutos de entrenamiento del GPS por jugador (o persona), día y si son de la selección, para Lesiones c/1000h. Solo con Lesiones en el club.';

-- Toda función nueva nace ejecutable por PUBLIC: se saca y se da solo lo que
-- usa la app.
revoke execute on function public.gps_minutos_de_fila(jsonb), public.gps_es_de_seleccion(jsonb) from public, anon, authenticated;
revoke execute on function public.minutos_de_entrenamiento(uuid) from public, anon;
grant execute on function public.minutos_de_entrenamiento(uuid) to authenticated;

commit;

-- Para ver que quedó bien: la función, lista para la app.
select 'minutos_de_entrenamiento' as funcion, has_function_privilege('authenticated', 'public.minutos_de_entrenamiento(uuid)', 'execute') as la_usa_la_app;
