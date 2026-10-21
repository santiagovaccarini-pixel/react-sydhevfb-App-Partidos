-- =====================================================================
-- GPS: cambiar una fila sin pisar a otra persona (paso 2 de la nota «cargar
-- sin señal y a la vez que otra persona», «la fila de espera de cambios»;
-- Santiago, 20/10: si dos cambian la misma fila, «Se juntan; si es la misma
-- celda, aviso»; 21/10, la misma celda: «Gana el último, con aviso»; una
-- fila que otro borró, «Queda borrada y te aviso»). Lo mismo que
-- 20261114_evaluaciones_cambiar.sql y 20261115_lesiones_cambiar.sql, para
-- GPS, con una diferencia: los «por minuto».
--
--   · gps_cambiar cambia solo lo que se cambió (p_cambios), no la fila
--     entera: dos personas que cambian celdas distintas de la misma fila a
--     la vez quedan las dos. La fila queda bloqueada mientras se cambia: los
--     cambios entran de a uno, en orden.
--   · Los «por minuto» (Distancia/min = Distancia ÷ los minutos de la fila)
--     los calcula la base al juntar, con lo que quedó en la fila: si una
--     persona cambia la Distancia y otra el Tiempo a la vez, la
--     Distancia/min sale de las dos. Como en la app (Santiago, 10/10: «lo
--     traído del Excel queda como está; lo que se cambia, se recalcula»): se
--     recalcula el de la medida cambiada y, si cambió el Tiempo, todos los de
--     la fila. p_por_minuto dice cuál es cada uno: { "d": "d_min", … } (las
--     columnas de la app, gps/columnas.js). Sin Tiempo, 0 si la medida es 0 y
--     vacío si no.
--   · Con p_antes (lo que se veía de cada celda), si otra persona cambió esa
--     misma celda mientras tanto, gana el último y la base lo dice
--     (pisadas, con lo que había), para avisar.
--   · Si la fila ya no está (otra persona la borró), no se cambia nada y la
--     base lo dice (fila_borrada).
--   · Con los permisos de quien la llama (RLS de gps, como siempre; lo que
--     no puede ver, no está; lo que solo puede mirar, no se cambia). Las
--     reglas de la tabla (de quién es, sin fecha futura, jugador del club,
--     consentimiento) siguen igual. Anon, nada.
--
-- p_cambios y p_antes: { "fecha": "2026-06-01", "jugador_id": 7, "persona":
-- null, "promedio": null, "datos.d": 5200 }; en datos, null o "" borra el
-- dato. Devuelve { fila: la fila como quedó, pisadas: [{ clave, habia }] }.
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

create or replace function public.gps_cambiar(p_id uuid, p_cambios jsonb, p_antes jsonb default '{}'::jsonb,
                                              p_por_minuto jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fila public.gps%rowtype;
  v_como_estaba jsonb;
  v_datos jsonb;
  v_clave text;
  v_nuevo jsonb;
  v_habia jsonb;
  v_pisadas jsonb := '[]'::jsonb;
  v_de text;
  v_por_minuto text;
  v_tiempo float8;
  v_quedo jsonb;
begin
  if p_id is null or jsonb_typeof(p_cambios) is distinct from 'object' or p_cambios = '{}'::jsonb
     or jsonb_typeof(coalesce(p_antes, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_por_minuto, '{}'::jsonb)) <> 'object'
     or exists (select 1 from jsonb_each(coalesce(p_por_minuto, '{}'::jsonb)) m
                 where jsonb_typeof(m.value) <> 'string' or m.value #>> '{}' in ('', 'tiempo') or m.value #>> '{}' = m.key) then
    raise exception 'gps_cambios' using errcode = 'P0001';
  end if;

  -- Si ya no está (o no se ve), otra persona la borró.
  perform 1 from public.gps where id = p_id;
  if not found then
    raise exception 'fila_borrada' using errcode = 'P0001';
  end if;
  -- La fila, bloqueada hasta terminar: los cambios entran de a uno. Se ve
  -- pero no se puede cambiar: sin permiso.
  select * into v_fila from public.gps where id = p_id for update;
  if not found then
    raise exception 'permission denied for table gps' using errcode = '42501';
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
    elsif v_clave in ('fecha', 'jugador_id', 'persona', 'promedio') then
      v_habia := coalesce(v_como_estaba -> v_clave, 'null'::jsonb);
    else
      raise exception 'gps_cambios' using errcode = 'P0001';
    end if;
    -- Otra persona la cambió mientras tanto (y no a lo mismo): gana el último.
    if p_antes ? v_clave and v_habia is distinct from p_antes -> v_clave and v_habia is distinct from v_nuevo then
      v_pisadas := v_pisadas || jsonb_build_array(jsonb_build_object('clave', v_clave, 'habia', v_habia));
    end if;
  end loop;

  -- Los «por minuto» de lo cambiado, con lo que quedó en la fila (como
  -- porMinuto y datosConCambio en gps/valores.js; float8, como en la app).
  v_tiempo := case when jsonb_typeof(v_datos -> 'tiempo') = 'number' then (v_datos ->> 'tiempo')::float8 end;
  for v_de, v_por_minuto in select m.key, m.value #>> '{}' from jsonb_each(coalesce(p_por_minuto, '{}'::jsonb)) m loop
    continue when not (p_cambios ? 'datos.tiempo' or p_cambios ? ('datos.' || v_de));
    continue when not (v_datos ? v_de or v_datos ? v_por_minuto);
    if jsonb_typeof(v_datos -> v_de) = 'number' and v_tiempo > 0 then
      v_datos := jsonb_set(v_datos, array[v_por_minuto], to_jsonb((v_datos ->> v_de)::float8 / (v_tiempo / 60)), true);
    elsif jsonb_typeof(v_datos -> v_de) = 'number' and (v_datos ->> v_de)::float8 = 0 then
      v_datos := jsonb_set(v_datos, array[v_por_minuto], '0'::jsonb, true);
    else
      v_datos := v_datos - v_por_minuto;
    end if;
  end loop;

  update public.gps g
     set fecha = case when p_cambios ? 'fecha' then nullif(p_cambios ->> 'fecha', '')::date else g.fecha end,
         jugador_id = case when p_cambios ? 'jugador_id' then nullif(p_cambios ->> 'jugador_id', '')::bigint else g.jugador_id end,
         persona = case when p_cambios ? 'persona' then nullif(btrim(regexp_replace(coalesce(p_cambios ->> 'persona', ''), '\s+', ' ', 'g')), '') else g.persona end,
         promedio = case when p_cambios ? 'promedio' then nullif(p_cambios ->> 'promedio', '') else g.promedio end,
         datos = v_datos
   where g.id = p_id
  returning jsonb_build_object('id', g.id, 'equipo_id', g.equipo_id, 'orden', g.orden, 'fecha', g.fecha, 'jugador_id', g.jugador_id,
                               'persona', g.persona, 'promedio', g.promedio, 'datos', g.datos, 'actualizado_en', g.actualizado_en)
    into v_quedo;
  if v_quedo is null then
    raise exception 'fila_borrada' using errcode = 'P0001';
  end if;

  return jsonb_build_object('fila', v_quedo, 'pisadas', v_pisadas);
end;
$$;

revoke execute on function public.gps_cambiar(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.gps_cambiar(uuid, jsonb, jsonb, jsonb) to authenticated;

commit;
