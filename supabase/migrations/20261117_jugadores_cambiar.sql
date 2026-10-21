-- =====================================================================
-- Datos básicos: cambiar un jugador sin pisar a otra persona (paso 2 de la
-- nota «cargar sin señal y a la vez que otra persona», «la fila de espera de
-- cambios»; Santiago, 20/10: si dos cambian la misma fila, «Se juntan; si es
-- la misma celda, aviso»; 21/10, la misma celda: «Gana el último, con
-- aviso»; una fila que otro borró, «Queda borrada y te aviso»). Lo mismo que
-- 20261114, 20261115 y 20261116, para los jugadores de Datos básicos.
--
--   · jugadores_cambiar cambia solo las columnas cambiadas (p_cambios),
--     como ya hacía la app: dos personas que cambian columnas distintas del
--     mismo jugador quedan las dos. La fila queda bloqueada mientras se
--     cambia: los cambios entran de a uno, en orden.
--   · Con p_antes (lo que se veía de cada columna), si otra persona cambió
--     esa misma columna mientras tanto, gana el último y la base lo dice
--     (pisadas, con lo que había), para avisar.
--   · Si el jugador ya no está (otra persona lo borró), no se cambia nada y
--     la base lo dice (fila_borrada).
--   · Con los permisos de quien la llama (RLS de jugadores, como siempre: lo
--     que no puede ver, no está; con Datos básicos solo para mirar, no se
--     cambia). Las reglas de la tabla (el nombre no se repite en el club,
--     horas previas no negativas, los nombres anteriores al cambiar el
--     nombre) siguen igual. Anon, nada.
--
-- Columnas: nombre, categoria, fecha_nacimiento, pie_dominante, posicion,
-- foto_url, horas_previas y actual. p_cambios y p_antes: { "categoria":
-- "sub20", "horas_previas": 12, "actual": false }; un texto vacío queda
-- vacío (null). Devuelve { fila: el jugador como quedó, pisadas: [{ clave,
-- habia }] }.
--
-- Requiere las columnas horas_previas y actual (20261007 y 20261011). Se
-- corre en Supabase > SQL Editor, entera y de una vez. Solo agrega: la app
-- de antes sigue andando. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'jugadores'
         and column_name in ('categoria', 'fecha_nacimiento', 'pie_dominante', 'posicion', 'foto_url', 'horas_previas', 'actual')) <> 7 then
    raise exception 'Primero hay que correr las migraciones de Datos básicos (horas previas y jugadores actuales).';
  end if;
end $$;

create or replace function public.jugadores_cambiar(p_id bigint, p_cambios jsonb, p_antes jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_habia jsonb;
  v_quedo jsonb;
  v_clave text;
  v_pisadas jsonb := '[]'::jsonb;
begin
  if p_id is null or jsonb_typeof(p_cambios) is distinct from 'object' or p_cambios = '{}'::jsonb
     or jsonb_typeof(coalesce(p_antes, '{}'::jsonb)) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_cambios) k
                 where k not in ('nombre', 'categoria', 'fecha_nacimiento', 'pie_dominante', 'posicion', 'foto_url', 'horas_previas', 'actual'))
     or (p_cambios ? 'nombre' and btrim(coalesce(p_cambios ->> 'nombre', '')) = '') then
    raise exception 'jugadores_cambios' using errcode = 'P0001';
  end if;

  -- Si ya no está (o no se ve), otra persona lo borró.
  perform 1 from public.jugadores where id = p_id;
  if not found then
    raise exception 'fila_borrada' using errcode = 'P0001';
  end if;
  -- La fila, bloqueada hasta terminar: los cambios entran de a uno. Se ve
  -- pero no se puede cambiar: sin permiso.
  select jsonb_build_object('nombre', j.nombre, 'categoria', j.categoria, 'fecha_nacimiento', j.fecha_nacimiento,
                            'pie_dominante', j.pie_dominante, 'posicion', j.posicion, 'foto_url', j.foto_url,
                            'horas_previas', j.horas_previas, 'actual', j.actual)
    into v_habia
    from public.jugadores j
   where j.id = p_id
     for update;
  if not found then
    raise exception 'permission denied for table jugadores' using errcode = '42501';
  end if;

  update public.jugadores j
     set nombre = case when p_cambios ? 'nombre' then btrim(p_cambios ->> 'nombre') else j.nombre end,
         categoria = case when p_cambios ? 'categoria' then nullif(p_cambios ->> 'categoria', '') else j.categoria end,
         fecha_nacimiento = case when p_cambios ? 'fecha_nacimiento' then nullif(p_cambios ->> 'fecha_nacimiento', '')::date else j.fecha_nacimiento end,
         pie_dominante = case when p_cambios ? 'pie_dominante' then nullif(p_cambios ->> 'pie_dominante', '') else j.pie_dominante end,
         posicion = case when p_cambios ? 'posicion' then nullif(p_cambios ->> 'posicion', '') else j.posicion end,
         foto_url = case when p_cambios ? 'foto_url' then nullif(btrim(coalesce(p_cambios ->> 'foto_url', '')), '') else j.foto_url end,
         horas_previas = case when p_cambios ? 'horas_previas' then nullif(p_cambios ->> 'horas_previas', '')::numeric else j.horas_previas end,
         actual = case when p_cambios ? 'actual' then coalesce((p_cambios ->> 'actual')::boolean, true) else j.actual end,
         actualizado_en = now()
   where j.id = p_id
  returning jsonb_build_object('id', j.id, 'nombre', j.nombre, 'roles', j.roles, 'puestos', j.puestos, 'categoria', j.categoria,
                               'fecha_nacimiento', j.fecha_nacimiento, 'pie_dominante', j.pie_dominante, 'posicion', j.posicion,
                               'foto_url', j.foto_url, 'horas_previas', j.horas_previas, 'actual', j.actual)
    into v_quedo;
  if v_quedo is null then
    raise exception 'fila_borrada' using errcode = 'P0001';
  end if;

  -- Otra persona la cambió mientras tanto (y no a lo mismo): gana el último.
  for v_clave in select jsonb_object_keys(p_cambios) loop
    if p_antes ? v_clave and (v_habia -> v_clave) is distinct from (p_antes -> v_clave)
       and (v_habia -> v_clave) is distinct from (v_quedo -> v_clave) then
      v_pisadas := v_pisadas || jsonb_build_array(jsonb_build_object('clave', v_clave, 'habia', v_habia -> v_clave));
    end if;
  end loop;

  return jsonb_build_object('fila', v_quedo, 'pisadas', v_pisadas);
end;
$$;

revoke execute on function public.jugadores_cambiar(bigint, jsonb, jsonb) from public, anon;
grant execute on function public.jugadores_cambiar(bigint, jsonb, jsonb) to authenticated;

commit;
