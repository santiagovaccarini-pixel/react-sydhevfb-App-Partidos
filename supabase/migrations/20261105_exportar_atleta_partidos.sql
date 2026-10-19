-- =====================================================================
-- Exportar los datos de un atleta, también con los partidos guardados de
-- antes (19/10: en la base del club, «function unnest(jsonb) does not
-- exist»). Los titulares y los convocados de los partidos pueden estar
-- guardados como lista de textos (text[], la instalación desde cero) o como
-- lista JSON (jsonb, las bases de antes); 20261104 los leía solo como lista
-- de textos. Ahora exportar_atleta los lee igual en los dos casos. Lo demás
-- de la función queda como en 20261104.
--
-- Queda aparte (anotado en docs/PENDIENTES.md, «Exportar los datos de un
-- atleta»): cambiarle el nombre a un jugador falla con la misma diferencia
-- (partido_con_nombres_de_hoy, de 20261022).
--
-- Requiere 20261104_exportar_atleta.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. No cambia ningún dato. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.exportar_atleta(bigint)') is null then
    raise exception 'Primero hay que correr 20261104_exportar_atleta.sql.';
  end if;
end $$;

-- Una lista de nombres como JSON, venga como venga (text[] o jsonb); lo que
-- no es una lista, vacía.
create or replace function public.lista_de_nombres(p_lista jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_lista) = 'array' then p_lista else '[]'::jsonb end;
$$;

create or replace function public.exportar_atleta(p_jugador bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_jugador public.jugadores;
  v_club uuid;
  v_nombres text[];
  v_id text := p_jugador::text;
begin
  select * into v_jugador from public.jugadores j where j.id = p_jugador;
  v_club := v_jugador.equipo_id;
  if v_club is null or not public.es_admin_de_club(v_club) then
    raise exception 'solo_admin' using errcode = '42501';
  end if;

  -- Cómo figura en los partidos: su nombre de hoy y los de antes.
  select coalesce(array_agg(distinct lower(btrim(x.nombre))), '{}') into v_nombres
    from (select v_jugador.nombre as nombre
          union all
          select a.nombre from public.jugadores_nombres_anteriores a where a.jugador_id = p_jugador) x
   where btrim(coalesce(x.nombre, '')) <> '';

  return jsonb_build_object(
    'version', 1,
    'generado_en', now(),
    'club', (select e.nombre from public.equipos e where e.id = v_club),
    'jugador', to_jsonb(v_jugador) - 'equipo_id',
    'nombres_anteriores', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', a.nombre, 'hasta', a.hasta) order by a.hasta)
        from public.jugadores_nombres_anteriores a
       where a.jugador_id = p_jugador and a.equipo_id = v_club), '[]'::jsonb),
    'lesiones', coalesce((
      select jsonb_agg((to_jsonb(l) - 'equipo_id' - 'jugador_id' - 'persona' - 'creado_por' - 'actualizado_por')
                       || jsonb_build_object('creado_por', public.correo_de(l.creado_por), 'actualizado_por', public.correo_de(l.actualizado_por))
                       order by l.numero_caso, l.fecha_lesion)
        from public.lesiones l
       where l.jugador_id = p_jugador and l.equipo_id = v_club), '[]'::jsonb),
    'evaluaciones', coalesce((
      select jsonb_agg((to_jsonb(e) - 'equipo_id' - 'jugador_id' - 'persona' - 'orden' - 'creado_por' - 'actualizado_por')
                       || jsonb_build_object('creado_por', public.correo_de(e.creado_por), 'actualizado_por', public.correo_de(e.actualizado_por))
                       order by e.test, e.fecha, e.orden)
        from public.evaluaciones e
       where e.jugador_id = p_jugador and e.equipo_id = v_club), '[]'::jsonb),
    'gps', coalesce((
      select jsonb_agg((to_jsonb(g) - 'equipo_id' - 'jugador_id' - 'persona' - 'promedio' - 'orden' - 'creado_por' - 'actualizado_por')
                       || jsonb_build_object('creado_por', public.correo_de(g.creado_por), 'actualizado_por', public.correo_de(g.actualizado_por))
                       order by g.fecha, g.orden)
        from public.gps g
       where g.jugador_id = p_jugador and g.equipo_id = v_club), '[]'::jsonb),
    'partidos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'fecha', p.fecha, 'rival', p.rival, 'resultado', p.resultado, 'localia', p.localia,
               'convocado', y.convocado, 'titular', y.titular, 'entro', y.entro, 'salio', y.salio)
             order by p.fecha, p.id)
        from public.registros_partido p
        cross join lateral (
          select exists (select 1 from jsonb_array_elements_text(public.lista_de_nombres(to_jsonb(p.convocados))) c
                          where lower(btrim(c)) = any (v_nombres)) as convocado,
                 exists (select 1 from jsonb_array_elements_text(public.lista_de_nombres(to_jsonb(p.titulares))) c
                          where lower(btrim(c)) = any (v_nombres)) as titular,
                 coalesce(to_jsonb(array_agg(c.hora) filter (where lower(btrim(c.entra)) = any (v_nombres))), '[]'::jsonb) as entro,
                 coalesce(to_jsonb(array_agg(c.hora) filter (where lower(btrim(c.sale)) = any (v_nombres))), '[]'::jsonb) as salio
            from (select v.sale, v.entra, v.hora
                    from (values (p.cambio_1_sale, p.cambio_1_entra, p.cambio_1_tiempo),
                                 (p.cambio_2_sale, p.cambio_2_entra, p.cambio_2_tiempo),
                                 (p.cambio_3_sale, p.cambio_3_entra, p.cambio_3_tiempo),
                                 (p.cambio_4_sale, p.cambio_4_entra, p.cambio_4_tiempo),
                                 (p.cambio_5_sale, p.cambio_5_entra, p.cambio_5_tiempo)) as v (sale, entra, hora)
                  union all
                  select x ->> 'sale', x ->> 'entra', x ->> 'hora'
                    from jsonb_array_elements(case when jsonb_typeof(p.cambios_extra) = 'array' then p.cambios_extra else '[]'::jsonb end) x) c
        ) y
       where p.equipo_id = v_club
         and (y.convocado or y.titular or jsonb_array_length(y.entro) > 0 or jsonb_array_length(y.salio) > 0)), '[]'::jsonb),
    'historial', coalesce((
      select jsonb_agg(h.cambio order by h.cuando, h.orden)
        from (
          -- Sus lesiones: quién, cuándo y qué (también las borradas).
          select l.cuando, l.id as orden,
                 jsonb_build_object('base', 'lesiones', 'accion', l.accion, 'cuando', l.cuando, 'quien', l.quien_email,
                                    'numero_caso', coalesce(l.despues, l.antes) -> 'numero_caso',
                                    'antes', l.antes - 'equipo_id' - 'creado_por' - 'actualizado_por',
                                    'despues', l.despues - 'equipo_id' - 'creado_por' - 'actualizado_por') as cambio
            from public.lesiones_historial l
           where l.equipo_id = v_club
             and coalesce(l.despues, l.antes) ->> 'jugador_id' = v_id
          union all
          -- Su ficha, sus evaluaciones y su GPS: cuándo y, si se sabe, quién.
          select v.cuando, v.id,
                 jsonb_build_object('base', case v.tabla when 'jugadores' then 'datos' else v.tabla end,
                                    'accion', v.accion, 'cuando', v.cuando,
                                    'quien', case when v.fila ? 'actualizado_por' and v.fila ->> 'actualizado_por' ~ '^[0-9a-f-]{36}$'
                                                  then public.correo_de((v.fila ->> 'actualizado_por')::uuid) else '' end,
                                    'test', v.fila -> 'test', 'fecha', v.fila -> 'fecha')
            from public.versiones_datos v
           where v.equipo_id = v_club
             and ((v.tabla = 'jugadores' and v.fila_id = v_id)
                  or (v.tabla in ('evaluaciones', 'gps') and v.fila ->> 'jugador_id' = v_id))
        ) h), '[]'::jsonb),
    'ajustes', jsonb_build_object(
      'lesiones_campos', coalesce((select jsonb_agg(to_jsonb(x) - 'equipo_id') from public.lesiones_campos x where x.equipo_id = v_club), '[]'::jsonb),
      'lesiones_opciones', coalesce((select jsonb_agg(to_jsonb(x) - 'equipo_id' order by x.orden) from public.lesiones_opciones x where x.equipo_id = v_club), '[]'::jsonb),
      'evaluaciones_campos', coalesce((select jsonb_agg(to_jsonb(x) - 'equipo_id') from public.evaluaciones_campos x where x.equipo_id = v_club), '[]'::jsonb),
      'evaluaciones_opciones', coalesce((select jsonb_agg(to_jsonb(x) - 'equipo_id' order by x.orden) from public.evaluaciones_opciones x where x.equipo_id = v_club), '[]'::jsonb),
      'gps_campos', coalesce((select jsonb_agg(to_jsonb(x) - 'equipo_id') from public.gps_campos x where x.equipo_id = v_club), '[]'::jsonb),
      'gps_opciones', coalesce((select jsonb_agg(to_jsonb(x) - 'equipo_id' order by x.orden) from public.gps_opciones x where x.equipo_id = v_club), '[]'::jsonb))
  );
end;
$$;

comment on function public.exportar_atleta(bigint) is
  'Todo lo de un atleta en su club (portabilidad, 20261104; partidos de antes, 20261105), para el Excel y el JSON. Solo el administrador del club.';

revoke all on function public.lista_de_nombres(jsonb) from public, anon, authenticated;
revoke all on function public.exportar_atleta(bigint) from public, anon;
grant execute on function public.exportar_atleta(bigint) to authenticated;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if has_function_privilege('anon', 'public.exportar_atleta(bigint)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.lista_de_nombres(jsonb)', 'EXECUTE') then
    raise exception 'exportar_atleta no es para anon y lista_de_nombres no es para las cuentas.';
  end if;
  if public.lista_de_nombres(to_jsonb(array['A', 'B'])) <> '["A", "B"]'::jsonb
     or public.lista_de_nombres('["A"]'::jsonb) <> '["A"]'::jsonb
     or public.lista_de_nombres(null) <> '[]'::jsonb then
    raise exception 'lista_de_nombres no lee bien las listas.';
  end if;
end $$;

commit;

-- Que la app vea el cambio sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: cómo están guardados los titulares y los
-- convocados en esta base (text[] o jsonb; los dos andan).
select column_name as columna, data_type as tipo
  from information_schema.columns
 where table_schema = 'public' and table_name = 'registros_partido' and column_name in ('titulares', 'convocados')
 order by column_name;
