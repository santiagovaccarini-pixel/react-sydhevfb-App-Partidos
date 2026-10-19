-- =====================================================================
-- Exportar todos los datos de un atleta (portabilidad; Santiago, 18/10:
-- «Añade una función para que un club pueda exportar todos los datos de un
-- atleta si este lo solicita»; en un cuestionario: «Excel y además JSON»,
-- además de las bases «Partidos donde estuvo» e «Historial de cambios»,
-- «El administrador, con todo», en «Datos básicos, en la ficha»).
--
--   · exportar_atleta(jugador): todo lo del jugador en su club, en un solo
--     jsonb, para que la app arme el Excel y el JSON. Solo el administrador
--     del club, y con todo aunque no tenga cada base: lo controla la base.
--     Para cualquier otro (o un jugador que no existe) contesta lo mismo:
--     solo_admin.
--       - jugador: su fila de Datos básicos y sus nombres anteriores.
--       - lesiones, evaluaciones y gps: sus filas en el club, con el correo
--         de quien las cargó y de quien las cambió por última vez.
--       - partidos: solo lo suyo en cada partido del club donde figura por
--         su nombre (o uno anterior): convocado, titular, cuándo entró y
--         cuándo salió. Nada de los demás jugadores.
--       - historial: cada cambio de sus lesiones (quién, cuándo, qué), y de
--         su ficha, sus evaluaciones y su GPS (cuándo y, si se sabe, quién).
--       - ajustes: los nombres de las columnas y las listas del club, para
--         que el Excel diga lo mismo que la app (no son datos del atleta).
--
-- Requiere 20261103_consentimiento.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. No cambia ningún dato. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.consentimientos') is null then
    raise exception 'Primero hay que correr 20261103_consentimiento.sql.';
  end if;
end $$;

-- El correo de una cuenta (vacío si ya no está).
create or replace function public.correo_de(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.email from auth.users u where u.id = p_user), '');
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
          select exists (select 1 from unnest(coalesce(p.convocados, '{}')) c where lower(btrim(c)) = any (v_nombres)) as convocado,
                 exists (select 1 from unnest(coalesce(p.titulares, '{}')) c where lower(btrim(c)) = any (v_nombres)) as titular,
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
  'Todo lo de un atleta en su club (portabilidad, 20261104), para el Excel y el JSON. Solo el administrador del club.';

-- La exportación, a las cuentas (la base decide si es el administrador);
-- correo_de, solo adentro.
revoke all on function public.correo_de(uuid) from public, anon, authenticated;
revoke all on function public.exportar_atleta(bigint) from public, anon;
grant execute on function public.exportar_atleta(bigint) to authenticated;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if has_function_privilege('anon', 'public.exportar_atleta(bigint)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.correo_de(uuid)', 'EXECUTE') then
    raise exception 'exportar_atleta no es para anon y correo_de no es para las cuentas.';
  end if;
  if exists (select 1 from public.huecos_entre_clubes()) then
    raise exception 'Quedaron huecos entre clubes: select * from public.huecos_entre_clubes();';
  end if;
end $$;

commit;

-- Que la app vea la función nueva sin esperar.
notify pgrst, 'reload schema';
