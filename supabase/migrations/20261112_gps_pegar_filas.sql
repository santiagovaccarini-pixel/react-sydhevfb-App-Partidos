-- =====================================================================
-- GPS › Pegar desde una planilla: las reglas de duplicados en la base y
-- reemplazar días (parte A2 de la nota «cargar sin señal y a la vez que otra
-- persona»; Santiago, 20/10: la Regla 1 también en «Pegar desde una
-- planilla», «Reemplaza», «Las del mismo dispositivo», el promedio «Sí, con
-- el nuevo» y «Jugador, fecha y hora de incio para preguntar si es
-- duplicado»).
--
--   · gps_pegar_filas guarda filas pegadas de uno o más días (la app manda
--     los días enteros, de a tandas): las de una tanda, todas o ninguna. Cada
--     día queda bloqueado mientras se revisa y se guarda (el mismo bloqueo
--     que gps_guardar_dia, de 20261111: Cargar y Pegar no pasan a la vez).
--   · Una fila igual en todo a una que ya está (la misma persona, el mismo
--     día y los mismos datos; el dispositivo no cuenta, como en la app) no se
--     guarda: «Ya está en la app». Dos iguales en lo pegado se guardan las
--     dos, como están en el Excel (decisión de antes, que sigue).
--   · Regla 1: un día de lo pegado es una sesión que ya está con otros datos
--     si alguna fila pegada (que no ya está) es de un jugador (o persona) que
--     ese día, con el mismo dispositivo, tiene una fila con la misma hora de
--     inicio. Esos días no se guardan (gps_dia_con_otras) y la app pregunta:
--     «Ir a la Base» o «Reemplazar y cargar». Con reemplazar, en esos días se
--     borran las filas de los jugadores pegados con ese dispositivo (sus
--     tareas y su total, que no tiene hora) y, si lo pegado trae el promedio
--     del equipo de ese día, el promedio de ese día con ese dispositivo; y se
--     guardan todas las pegadas de ese día (también las que ya estaban
--     iguales). Lo borrado queda en las versiones, como todo borrado. Otra
--     hora de inicio es otro turno: se suma sin preguntar.
--   · Con los permisos de quien la llama (RLS de gps: GPS en el club). Anon,
--     nada.
--
-- Requiere 20261111_gps_guardar_dia.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.gps_guardar_dia(uuid, date, text, jsonb, boolean)') is null then
    raise exception 'Primero hay que correr 20261111_gps_guardar_dia.sql.';
  end if;
end $$;

-- p_filas: [{ fecha, jugador_id, persona, promedio, datos }], en el orden del
-- Excel, todas con el dispositivo elegido al pegar (o ninguno). Devuelve {
-- creadas, yaEstaban, reemplazadas }.
create or replace function public.gps_pegar_filas(p_equipo uuid, p_dispositivo text, p_filas jsonb, p_reemplazar boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dispositivo text := btrim(coalesce(p_dispositivo, ''));
  v_fecha date;
  v_iguales bigint[];
  v_dias date[];
  v_borradas integer := 0;
  v_promedios integer := 0;
  v_creadas integer;
  v_ya_estaban integer;
begin
  if p_equipo is null or jsonb_typeof(p_filas) is distinct from 'array'
     or jsonb_array_length(p_filas) not between 1 and 2000 then
    raise exception 'gps_dia_filas' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_filas) f
              where jsonb_typeof(f) <> 'object'
                 or coalesce(f ->> 'fecha', '') !~ '^\d{4}-\d{2}-\d{2}$'
                 or btrim(coalesce(f #>> '{datos,dispositivo}', '')) <> v_dispositivo) then
    raise exception 'gps_dia_filas' using errcode = 'P0001';
  end if;

  -- Cada día del club, bloqueado hasta terminar (en orden: dos que pegan a
  -- la vez no se traban entre sí).
  for v_fecha in select distinct (f ->> 'fecha')::date from jsonb_array_elements(p_filas) f order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('gps_guardar_dia|' || p_equipo::text || '|' || v_fecha::text, 0));
  end loop;

  -- Las que ya están: iguales en todo menos el dispositivo.
  select coalesce(array_agg(t.i), '{}'::bigint[]) into v_iguales
    from jsonb_array_elements(p_filas) with ordinality as t (f, i)
   where exists (
           select 1
             from public.gps g
            where g.equipo_id = p_equipo and g.fecha = (t.f ->> 'fecha')::date
              and ((nullif(t.f ->> 'jugador_id', '') is not null and g.jugador_id = (t.f ->> 'jugador_id')::bigint)
                   or (nullif(t.f ->> 'promedio', '') is not null and g.promedio = t.f ->> 'promedio')
                   or (nullif(btrim(t.f ->> 'persona'), '') is not null and lower(btrim(g.persona)) = lower(btrim(t.f ->> 'persona'))))
              and (g.datos - 'dispositivo') = (coalesce(t.f -> 'datos', '{}'::jsonb) - 'dispositivo'));

  -- Regla 1: los días con la misma sesión y otros datos.
  select coalesce(array_agg(distinct (t.f ->> 'fecha')::date), '{}'::date[]) into v_dias
    from jsonb_array_elements(p_filas) with ordinality as t (f, i)
    join public.gps g
      on g.equipo_id = p_equipo and g.fecha = (t.f ->> 'fecha')::date and g.promedio is null
     and btrim(coalesce(g.datos ->> 'dispositivo', '')) = v_dispositivo
     and ((nullif(t.f ->> 'jugador_id', '') is not null and g.jugador_id = (t.f ->> 'jugador_id')::bigint)
          or (nullif(btrim(t.f ->> 'persona'), '') is not null and lower(btrim(g.persona)) = lower(btrim(t.f ->> 'persona'))))
   where not (t.i = any (v_iguales)) and coalesce(t.f ->> 'promedio', '') = ''
     and jsonb_typeof(t.f #> '{datos,inicio}') = 'number' and jsonb_typeof(g.datos -> 'inicio') = 'number'
     and abs((g.datos ->> 'inicio')::numeric - (t.f #>> '{datos,inicio}')::numeric) <= 0.5;
  if cardinality(v_dias) > 0 and not coalesce(p_reemplazar, false) then
    raise exception 'gps_dia_con_otras' using errcode = 'P0001', detail = cardinality(v_dias)::text;
  end if;

  if cardinality(v_dias) > 0 then
    delete from public.gps g
     where g.equipo_id = p_equipo and g.fecha = any (v_dias) and g.promedio is null
       and btrim(coalesce(g.datos ->> 'dispositivo', '')) = v_dispositivo
       and exists (
             select 1
               from jsonb_array_elements(p_filas) f
              where (f ->> 'fecha')::date = g.fecha and coalesce(f ->> 'promedio', '') = ''
                and ((nullif(f ->> 'jugador_id', '') is not null and g.jugador_id = (f ->> 'jugador_id')::bigint)
                     or (nullif(btrim(f ->> 'persona'), '') is not null and lower(btrim(g.persona)) = lower(btrim(f ->> 'persona')))));
    get diagnostics v_borradas = row_count;
    delete from public.gps g
     where g.equipo_id = p_equipo and g.fecha = any (v_dias) and g.promedio is not null
       and btrim(coalesce(g.datos ->> 'dispositivo', '')) = v_dispositivo
       and exists (select 1 from jsonb_array_elements(p_filas) f where (f ->> 'fecha')::date = g.fecha and coalesce(f ->> 'promedio', '') <> '');
    get diagnostics v_promedios = row_count;
  end if;

  -- Las nuevas y, en los días que se reemplazan, todas las pegadas.
  insert into public.gps (equipo_id, fecha, jugador_id, persona, promedio, datos)
  select p_equipo, (t.f ->> 'fecha')::date, nullif(t.f ->> 'jugador_id', '')::bigint, nullif(t.f ->> 'persona', ''), nullif(t.f ->> 'promedio', ''), coalesce(t.f -> 'datos', '{}'::jsonb)
    from jsonb_array_elements(p_filas) with ordinality as t (f, i)
   where not (t.i = any (v_iguales)) or (t.f ->> 'fecha')::date = any (v_dias)
   order by t.i;
  get diagnostics v_creadas = row_count;
  v_ya_estaban := jsonb_array_length(p_filas) - v_creadas;

  return jsonb_build_object('creadas', v_creadas, 'yaEstaban', v_ya_estaban, 'reemplazadas', v_borradas + v_promedios);
end;
$$;

revoke execute on function public.gps_pegar_filas(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.gps_pegar_filas(uuid, text, jsonb, boolean) to authenticated;

commit;
