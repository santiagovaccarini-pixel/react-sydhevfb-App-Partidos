-- =====================================================================
-- Lesiones: cambiar una lesión sin pisar a otra persona (paso 2 de la nota
-- «cargar sin señal y a la vez que otra persona», «la fila de espera de
-- cambios»; Santiago, 20/10: si dos cambian la misma fila, «Se juntan; si es
-- la misma celda, aviso»; 21/10, la misma celda: «Gana el último, con
-- aviso»; una fila que otro borró, «Queda borrada y te aviso»). Lo mismo que
-- 20261114_evaluaciones_cambiar.sql, para Lesiones.
--
--   · lesiones_cambiar cambia solo lo que se cambió (p_cambios), no la fila
--     entera: dos personas que cambian celdas distintas de la misma lesión a
--     la vez quedan las dos. La fila queda bloqueada mientras se cambia: los
--     cambios entran de a uno, en orden.
--   · Con p_antes (lo que se veía de cada celda), si otra persona cambió esa
--     misma celda mientras tanto, gana el último y la base lo dice
--     (pisadas, con lo que había), para avisar.
--   · Si la lesión ya no está (otra persona la borró), no se cambia nada y
--     la base lo dice (fila_borrada).
--   · Con los permisos de quien la llama (RLS de lesiones, como siempre; lo
--     que no puede ver, no está; lo que solo puede mirar, no se cambia). Las
--     reglas de la tabla (fechas en orden, sin repetir, jugador del club,
--     consentimiento) siguen igual. Anon, nada.
--
-- p_cambios y p_antes: { "fecha_lesion": "2026-06-01", "fecha_alta": null,
-- "jugador_id": 7, "persona": null, "datos.lado": "direito" }; en datos, null
-- o "" borra el dato. Devuelve { fila: la lesión como quedó, pisadas: [{
-- clave, habia }] }.
--
-- Requiere 20261010_lesiones_sin_fecha_y_personas.sql. Se corre en Supabase
-- > SQL Editor, entera y de una vez. Solo agrega: la app de antes sigue
-- andando. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.lesiones') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'lesiones' and column_name = 'persona') then
    raise exception 'Primero hay que correr 20261010_lesiones_sin_fecha_y_personas.sql.';
  end if;
end $$;

create or replace function public.lesiones_cambiar(p_id uuid, p_cambios jsonb, p_antes jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fila public.lesiones%rowtype;
  v_como_estaba jsonb;
  v_datos jsonb;
  v_clave text;
  v_nuevo jsonb;
  v_habia jsonb;
  v_pisadas jsonb := '[]'::jsonb;
  v_quedo jsonb;
begin
  if p_id is null or jsonb_typeof(p_cambios) is distinct from 'object' or p_cambios = '{}'::jsonb
     or jsonb_typeof(coalesce(p_antes, '{}'::jsonb)) <> 'object' then
    raise exception 'lesiones_cambios' using errcode = 'P0001';
  end if;

  -- Si ya no está (o no se ve), otra persona la borró.
  perform 1 from public.lesiones where id = p_id;
  if not found then
    raise exception 'fila_borrada' using errcode = 'P0001';
  end if;
  -- La fila, bloqueada hasta terminar: los cambios entran de a uno. Se ve
  -- pero no se puede cambiar: sin permiso.
  select * into v_fila from public.lesiones where id = p_id for update;
  if not found then
    raise exception 'permission denied for table lesiones' using errcode = '42501';
  end if;
  v_como_estaba := to_jsonb(v_fila);
  v_datos := coalesce(v_fila.datos, '{}'::jsonb);

  for v_clave, v_nuevo in select c.key, c.value from jsonb_each(p_cambios) c loop
    if v_clave like 'datos.%' and length(v_clave) > 6 then
      v_habia := coalesce(v_datos -> substr(v_clave, 7), 'null'::jsonb);
      if v_nuevo = 'null'::jsonb or v_nuevo = '""'::jsonb then
        v_datos := v_datos - substr(v_clave, 7);
        v_nuevo := 'null'::jsonb;
      else
        v_datos := jsonb_set(v_datos, array[substr(v_clave, 7)], v_nuevo, true);
      end if;
    elsif v_clave in ('jugador_id', 'persona', 'fecha_lesion', 'fecha_transicion', 'fecha_retorno_entrenamiento', 'fecha_alta') then
      v_habia := coalesce(v_como_estaba -> v_clave, 'null'::jsonb);
    else
      raise exception 'lesiones_cambios' using errcode = 'P0001';
    end if;
    -- Otra persona la cambió mientras tanto (y no a lo mismo): gana el último.
    if p_antes ? v_clave and v_habia is distinct from p_antes -> v_clave and v_habia is distinct from v_nuevo then
      v_pisadas := v_pisadas || jsonb_build_array(jsonb_build_object('clave', v_clave, 'habia', v_habia));
    end if;
  end loop;

  update public.lesiones l
     set jugador_id = case when p_cambios ? 'jugador_id' then nullif(p_cambios ->> 'jugador_id', '')::bigint else l.jugador_id end,
         persona = case when p_cambios ? 'persona' then nullif(btrim(regexp_replace(coalesce(p_cambios ->> 'persona', ''), '\s+', ' ', 'g')), '') else l.persona end,
         fecha_lesion = case when p_cambios ? 'fecha_lesion' then nullif(p_cambios ->> 'fecha_lesion', '')::date else l.fecha_lesion end,
         fecha_transicion = case when p_cambios ? 'fecha_transicion' then nullif(p_cambios ->> 'fecha_transicion', '')::date else l.fecha_transicion end,
         fecha_retorno_entrenamiento = case when p_cambios ? 'fecha_retorno_entrenamiento' then nullif(p_cambios ->> 'fecha_retorno_entrenamiento', '')::date else l.fecha_retorno_entrenamiento end,
         fecha_alta = case when p_cambios ? 'fecha_alta' then nullif(p_cambios ->> 'fecha_alta', '')::date else l.fecha_alta end,
         datos = v_datos
   where l.id = p_id
  returning jsonb_build_object('id', l.id, 'equipo_id', l.equipo_id, 'jugador_id', l.jugador_id, 'numero_caso', l.numero_caso,
                               'fecha_lesion', l.fecha_lesion, 'fecha_transicion', l.fecha_transicion,
                               'fecha_retorno_entrenamiento', l.fecha_retorno_entrenamiento, 'fecha_alta', l.fecha_alta,
                               'datos', l.datos, 'creado_en', l.creado_en, 'actualizado_en', l.actualizado_en, 'persona', l.persona)
    into v_quedo;
  if v_quedo is null then
    raise exception 'fila_borrada' using errcode = 'P0001';
  end if;

  return jsonb_build_object('fila', v_quedo, 'pisadas', v_pisadas);
end;
$$;

revoke execute on function public.lesiones_cambiar(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.lesiones_cambiar(uuid, jsonb, jsonb) to authenticated;

commit;
