-- =====================================================================
-- Evaluaciones: las reglas de duplicados en la base y la Regla 1 (parte A3
-- de la nota «cargar sin señal y a la vez que otra persona»; Santiago, 20/10:
-- «Es repetida si coincide nombre, fecha, y todos los datos son iguales» y la
-- Regla 1 también en Evaluaciones: «Si coincide fecha y jugador pero no datos
-- se avisa…», con «Ir a la Base» o cargarlo directamente, que «Reemplaza»).
--
--   · evaluaciones_sin_repetir: no puede haber dos evaluaciones iguales del
--     mismo test (la misma persona, la misma fecha y los mismos datos), las
--     cargue quien las cargue y como sea. En la base del club no había
--     ninguna (20/10, contando sin leer datos).
--   · evaluaciones_guardar guarda varias evaluaciones de un test de una vez
--     (Cargar y Pegar desde una planilla; la app manda de a tandas): las de
--     una tanda, todas o ninguna. Cada día del test queda bloqueado mientras
--     se revisa y se guarda: dos personas que guardan a la vez no pasan las
--     dos.
--   · Una igual a una que ya está no se guarda: «Ya está en la app».
--   · Regla 1: una evaluación de un jugador (o persona) que ese día ya tiene
--     otra de ese test, con otros datos. Así no se guarda nada
--     (evaluaciones_con_otras) y la app pregunta: «Ir a la Base» o
--     «Reemplazar y cargar». Con reemplazar se borran las de esos jugadores
--     esos días en ese test y se guardan las nuevas. Lo borrado queda en las
--     versiones, como todo borrado. (En la base del club nunca hubo dos del
--     mismo test, del mismo jugador, el mismo día.)
--   · Con los permisos de quien la llama (RLS de evaluaciones y el
--     consentimiento de las personas, como siempre). Anon, nada.
--
-- Requiere 20261012_evaluaciones.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.evaluaciones') is null then
    raise exception 'Primero hay que correr 20261012_evaluaciones.sql.';
  end if;
end $$;

-- Dos iguales, nunca (sin fecha cuenta como la misma fecha).
create unique index if not exists evaluaciones_sin_repetir
  on public.evaluaciones (equipo_id, test, (coalesce('j:' || jugador_id::text, 'p:' || lower(btrim(persona)))), fecha, (md5(datos::text)))
  nulls not distinct;

-- p_filas: [{ jugador_id, persona, fecha, datos }], en el orden de carga.
-- Devuelve { filas: [las guardadas, como en la tabla], borradas: [ids],
-- yaEstaban }.
create or replace function public.evaluaciones_guardar(p_equipo uuid, p_test text, p_filas jsonb, p_reemplazar boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fecha text;
  v_iguales bigint[];
  v_pares text[];
  v_borradas jsonb := '[]'::jsonb;
  v_filas jsonb;
begin
  if p_equipo is null or coalesce(p_test, '') !~ '^[a-z][a-z0-9_]{1,39}$' or jsonb_typeof(p_filas) is distinct from 'array'
     or jsonb_array_length(p_filas) not between 1 and 2000 then
    raise exception 'evaluaciones_filas' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_filas) f
              where jsonb_typeof(f) <> 'object'
                 or (f ->> 'fecha') !~ '^\d{4}-\d{2}-\d{2}$'
                 or coalesce(jsonb_typeof(f -> 'datos'), 'object') not in ('object', 'null')) then
    raise exception 'evaluaciones_filas' using errcode = 'P0001';
  end if;

  -- Cada día del test en el club, bloqueado hasta terminar (en orden: dos que
  -- guardan a la vez no se traban entre sí).
  for v_fecha in select distinct coalesce(f ->> 'fecha', '-') from jsonb_array_elements(p_filas) f order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('evaluaciones_guardar|' || p_equipo::text || '|' || p_test || '|' || v_fecha, 0));
  end loop;

  -- Las que ya están: iguales en todo.
  select coalesce(array_agg(t.i), '{}'::bigint[]) into v_iguales
    from jsonb_array_elements(p_filas) with ordinality as t (f, i)
   where exists (
           select 1
             from public.evaluaciones e
            where e.equipo_id = p_equipo and e.test = p_test
              and coalesce('j:' || e.jugador_id::text, 'p:' || lower(btrim(e.persona)))
                  = coalesce('j:' || nullif(t.f ->> 'jugador_id', ''), 'p:' || lower(btrim(t.f ->> 'persona')))
              and e.fecha is not distinct from (t.f ->> 'fecha')::date
              and e.datos = coalesce(nullif(t.f -> 'datos', 'null'::jsonb), '{}'::jsonb));

  -- Regla 1: los jugadores (o personas) y días que ya tienen otra
  -- evaluación de este test, con otros datos.
  select coalesce(array_agg(distinct coalesce('j:' || nullif(t.f ->> 'jugador_id', ''), 'p:' || lower(btrim(t.f ->> 'persona'))) || '|' || coalesce(t.f ->> 'fecha', '-')), '{}'::text[])
    into v_pares
    from jsonb_array_elements(p_filas) with ordinality as t (f, i)
   where not (t.i = any (v_iguales))
     and exists (
           select 1
             from public.evaluaciones e
            where e.equipo_id = p_equipo and e.test = p_test
              and coalesce('j:' || e.jugador_id::text, 'p:' || lower(btrim(e.persona)))
                  = coalesce('j:' || nullif(t.f ->> 'jugador_id', ''), 'p:' || lower(btrim(t.f ->> 'persona')))
              and e.fecha is not distinct from (t.f ->> 'fecha')::date);
  if cardinality(v_pares) > 0 and not coalesce(p_reemplazar, false) then
    raise exception 'evaluaciones_con_otras' using errcode = 'P0001', detail = cardinality(v_pares)::text;
  end if;

  if cardinality(v_pares) > 0 then
    with borradas as (
      delete from public.evaluaciones e
       where e.equipo_id = p_equipo and e.test = p_test
         and coalesce('j:' || e.jugador_id::text, 'p:' || lower(btrim(e.persona))) || '|' || coalesce(e.fecha::text, '-') = any (v_pares)
      returning e.id
    )
    select coalesce(jsonb_agg(b.id), '[]'::jsonb) into v_borradas from borradas b;
  end if;

  -- Las nuevas y, de los jugadores y días que se reemplazan, todas.
  with nuevas as (
    insert into public.evaluaciones (equipo_id, test, jugador_id, persona, fecha, datos)
    select p_equipo, p_test, nullif(t.f ->> 'jugador_id', '')::bigint, nullif(t.f ->> 'persona', ''), (t.f ->> 'fecha')::date,
           coalesce(nullif(t.f -> 'datos', 'null'::jsonb), '{}'::jsonb)
      from jsonb_array_elements(p_filas) with ordinality as t (f, i)
     where not (t.i = any (v_iguales))
        or coalesce('j:' || nullif(t.f ->> 'jugador_id', ''), 'p:' || lower(btrim(t.f ->> 'persona'))) || '|' || coalesce(t.f ->> 'fecha', '-') = any (v_pares)
     order by t.i
    returning id, equipo_id, test, orden, jugador_id, persona, fecha, datos, creado_en, actualizado_en
  )
  select coalesce(jsonb_agg(to_jsonb(n) order by n.orden), '[]'::jsonb) into v_filas from nuevas n;

  return jsonb_build_object('filas', v_filas, 'borradas', v_borradas, 'yaEstaban', jsonb_array_length(p_filas) - jsonb_array_length(v_filas));
end;
$$;

revoke execute on function public.evaluaciones_guardar(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.evaluaciones_guardar(uuid, text, jsonb, boolean) to authenticated;

commit;
