-- =====================================================================
-- GPS › Cargar un día: las reglas de duplicados en la base y reemplazar un
-- día (nota «cargar sin señal y a la vez que otra persona»; Santiago, 20/10,
-- en cuestionarios: «resolvamos los puntos debiles de hoy y las reglas de
-- duplicados», la regla de hoy «en la base» y la «Regla 1»).
--
--   · gps_guardar_dia guarda las filas de un día (las de un CSV, ya
--     calculadas) de una vez: todas o ninguna. Mientras revisa y guarda,
--     ese día del club queda bloqueado un instante: dos personas que guardan
--     a la vez no pasan las dos.
--   · Si el CSV ya está en la Base no se guarda (la regla de la app desde el
--     12/10, ahora también en la base): alguna fila con la misma distancia,
--     el mismo tiempo y la misma hora de inicio que una de ese día
--     (gps_ya_esta). Va comparando el CSV con lo que ya está, no fila por
--     fila: una tarea y el total de quien hizo una sola tarea coinciden y no
--     están repetidas.
--   · Regla 1 («Jugador, fecha y hora de incio para preguntar si es
--     duplicado»): si algún jugador (o persona) del CSV ya tiene ese día, con
--     el mismo dispositivo, una fila con la misma hora de inicio y el CSV no
--     es el mismo, es la misma sesión con otros datos: no se guarda
--     (gps_dia_con_otras) y la app pregunta: «Ir a la Base» o «Reemplazar y
--     cargar». Otra hora de inicio es otro turno: se suma sin preguntar. Con
--     reemplazar, las filas de ese día y ese dispositivo de los jugadores del
--     CSV (sus tareas y su total, que no tiene hora de inicio) y el promedio
--     del equipo de ese día y ese dispositivo se borran y quedan las nuevas
--     (Santiago: «Reemplaza», «Las del mismo dispositivo», el promedio «Sí,
--     con el nuevo»). Lo borrado queda en las versiones, como todo borrado.
--   · Con los permisos de quien la llama (RLS de gps: GPS en el club). Anon,
--     nada.
--
-- Requiere 20261019_gps_rapido.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null or to_regprocedure('public.clubes_donde_puedo(text)') is null then
    raise exception 'Primero hay que correr 20261019_gps_rapido.sql.';
  end if;
end $$;

-- p_filas: [{ fecha, jugador_id, persona, promedio, datos }], en el orden de
-- carga, todas del día y del dispositivo de la carga. Devuelve { creadas,
-- reemplazadas }.
create or replace function public.gps_guardar_dia(p_equipo uuid, p_fecha date, p_dispositivo text, p_filas jsonb, p_reemplazar boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dispositivo text := btrim(coalesce(p_dispositivo, ''));
  v_iguales integer;
  v_otras integer;
  v_otras_ids uuid[];
  v_borradas integer := 0;
  v_promedios integer := 0;
  v_creadas integer;
begin
  if p_equipo is null or p_fecha is null or jsonb_typeof(p_filas) is distinct from 'array'
     or jsonb_array_length(p_filas) not between 1 and 5000 then
    raise exception 'gps_dia_filas' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_filas) f
              where jsonb_typeof(f) <> 'object'
                 or (f ->> 'fecha') is distinct from p_fecha::text
                 or btrim(coalesce(f #>> '{datos,dispositivo}', '')) <> v_dispositivo) then
    raise exception 'gps_dia_filas' using errcode = 'P0001';
  end if;

  -- El día del club, bloqueado hasta terminar.
  perform pg_advisory_xact_lock(hashtextextended('gps_guardar_dia|' || p_equipo::text || '|' || p_fecha::text, 0));

  -- ¿El CSV ya está en la Base?
  select count(*) into v_iguales
    from jsonb_array_elements(p_filas) f
   where jsonb_typeof(f #> '{datos,d}') = 'number' and (f #>> '{datos,d}')::numeric > 0
     and exists (
           select 1
             from public.gps g
            where g.equipo_id = p_equipo and g.fecha = p_fecha
              and jsonb_typeof(g.datos -> 'd') = 'number' and (g.datos ->> 'd')::numeric > 0
              and abs((g.datos ->> 'd')::numeric - (f #>> '{datos,d}')::numeric) <= 0.0001
              and (coalesce(jsonb_typeof(f #> '{datos,tiempo}'), '') <> 'number' or coalesce(jsonb_typeof(g.datos -> 'tiempo'), '') <> 'number'
                   or abs((g.datos ->> 'tiempo')::numeric - (f #>> '{datos,tiempo}')::numeric) <= 0.5)
              and (coalesce(jsonb_typeof(f #> '{datos,inicio}'), '') <> 'number' or coalesce(jsonb_typeof(g.datos -> 'inicio'), '') <> 'number'
                   or abs((g.datos ->> 'inicio')::numeric - (f #>> '{datos,inicio}')::numeric) <= 0.5));
  if v_iguales > 0 then
    raise exception 'gps_ya_esta' using errcode = 'P0001', detail = v_iguales::text;
  end if;

  -- Regla 1: ¿es la misma sesión? Algún jugador (o persona) del CSV ya tiene
  -- ese día, con ese dispositivo, una fila con la misma hora de inicio (otra
  -- hora es otro turno: se suma sin preguntar). Si es la misma, las filas de
  -- ese día y ese dispositivo de los jugadores del CSV (sus tareas y su
  -- total: el total no tiene hora de inicio).
  if exists (
       select 1
         from jsonb_array_elements(p_filas) f
         join public.gps g
           on g.equipo_id = p_equipo and g.fecha = p_fecha and g.promedio is null
          and btrim(coalesce(g.datos ->> 'dispositivo', '')) = v_dispositivo
          and ((nullif(f ->> 'jugador_id', '') is not null and g.jugador_id = (f ->> 'jugador_id')::bigint)
               or (nullif(btrim(f ->> 'persona'), '') is not null and lower(btrim(g.persona)) = lower(btrim(f ->> 'persona'))))
        where coalesce(f ->> 'promedio', '') = ''
          and jsonb_typeof(f #> '{datos,inicio}') = 'number' and jsonb_typeof(g.datos -> 'inicio') = 'number'
          and abs((g.datos ->> 'inicio')::numeric - (f #>> '{datos,inicio}')::numeric) <= 0.5) then
    select coalesce(array_agg(g.id), '{}'::uuid[]) into v_otras_ids
      from public.gps g
     where g.equipo_id = p_equipo and g.fecha = p_fecha and g.promedio is null
       and btrim(coalesce(g.datos ->> 'dispositivo', '')) = v_dispositivo
       and exists (
             select 1
               from jsonb_array_elements(p_filas) f
              where coalesce(f ->> 'promedio', '') = ''
                and ((nullif(f ->> 'jugador_id', '') is not null and g.jugador_id = (f ->> 'jugador_id')::bigint)
                     or (nullif(btrim(f ->> 'persona'), '') is not null and lower(btrim(g.persona)) = lower(btrim(f ->> 'persona')))));
  else
    v_otras_ids := '{}'::uuid[];
  end if;
  v_otras := cardinality(v_otras_ids);
  if v_otras > 0 and not coalesce(p_reemplazar, false) then
    raise exception 'gps_dia_con_otras' using errcode = 'P0001', detail = v_otras::text;
  end if;

  if v_otras > 0 then
    delete from public.gps g where g.id = any (v_otras_ids);
    get diagnostics v_borradas = row_count;
    -- El promedio del equipo de ese día y ese dispositivo, si viene uno nuevo.
    if exists (select 1 from jsonb_array_elements(p_filas) f where coalesce(f ->> 'promedio', '') <> '') then
      delete from public.gps g
       where g.equipo_id = p_equipo and g.fecha = p_fecha and g.promedio is not null
         and btrim(coalesce(g.datos ->> 'dispositivo', '')) = v_dispositivo;
      get diagnostics v_promedios = row_count;
    end if;
  end if;

  insert into public.gps (equipo_id, fecha, jugador_id, persona, promedio, datos)
  select p_equipo, p_fecha, nullif(f ->> 'jugador_id', '')::bigint, nullif(f ->> 'persona', ''), nullif(f ->> 'promedio', ''), coalesce(f -> 'datos', '{}'::jsonb)
    from jsonb_array_elements(p_filas) with ordinality as t (f, i)
   order by i;
  get diagnostics v_creadas = row_count;

  return jsonb_build_object('creadas', v_creadas, 'reemplazadas', v_borradas + v_promedios);
end;
$$;

revoke execute on function public.gps_guardar_dia(uuid, date, text, jsonb, boolean) from public, anon;
grant execute on function public.gps_guardar_dia(uuid, date, text, jsonb, boolean) to authenticated;

commit;
