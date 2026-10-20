-- =====================================================================
-- Cambiarle el nombre a un jugador, también con los partidos guardados de
-- antes (la falla conocida que dejó 20261105; Santiago, 20/10: «Cambiar el
-- nombre de un jugador»). Los titulares y los convocados de los partidos
-- pueden estar guardados como lista de textos (text[], la instalación desde
-- cero) o como lista JSON (jsonb, las bases de antes, como la del club);
-- partido_con_nombres_de_hoy (20261022) los leía solo como lista de textos
-- y ahí cambiar un nombre en Datos básicos daba «No se pudo guardar». Ahora
-- los lee igual en los dos casos y los devuelve con el mismo tipo. Lo demás
-- de la función (cambios, guía de la transmisión, formación; lo del rival no
-- se toca) queda como en 20261022.
--
-- Al final, los partidos de cada club que hayan quedado con un nombre
-- anterior pasan al de hoy (lo que 20261022 hacía al correrla).
--
-- Requiere 20261022_nombres_en_todos_lados.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. Solo cambia nombres anteriores por el de hoy
-- en los partidos, como al cambiar un nombre. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.partido_con_nombres_de_hoy(public.registros_partido, jsonb)') is null then
    raise exception 'Primero hay que correr 20261022_nombres_en_todos_lados.sql.';
  end if;
end $$;

-- Un partido con los nombres de hoy: lo nuestro (titulares, convocados,
-- cambios y formación). Lo del rival queda como está. Los titulares y los
-- convocados se leen como JSON (vengan como lista de textos o como lista
-- JSON) y vuelven a la fila con su tipo; lo que no es una lista queda como
-- está, y en la lista, lo que no es un texto también.
create or replace function public.partido_con_nombres_de_hoy(r public.registros_partido, p_mapa jsonb)
returns public.registros_partido
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_fila jsonb;
  v_listas jsonb := '{}'::jsonb;
  v_campo text;
begin
  if p_mapa is null or p_mapa = '{}'::jsonb then
    return r;
  end if;
  v_fila := to_jsonb(r);
  foreach v_campo in array array['titulares', 'convocados'] loop
    if jsonb_typeof(v_fila -> v_campo) = 'array' then
      v_listas := v_listas || jsonb_build_object(v_campo, coalesce((
        select jsonb_agg(case when jsonb_typeof(e) = 'string' then to_jsonb(public.nombre_de_hoy(p_mapa, e #>> '{}')) else e end
                         order by i)
          from jsonb_array_elements(v_fila -> v_campo) with ordinality as t (e, i)), '[]'::jsonb));
    end if;
  end loop;
  if v_listas <> '{}'::jsonb then
    r := jsonb_populate_record(r, v_listas);
  end if;
  r.cambio_1_sale := public.nombre_de_hoy(p_mapa, r.cambio_1_sale);
  r.cambio_1_entra := public.nombre_de_hoy(p_mapa, r.cambio_1_entra);
  r.cambio_2_sale := public.nombre_de_hoy(p_mapa, r.cambio_2_sale);
  r.cambio_2_entra := public.nombre_de_hoy(p_mapa, r.cambio_2_entra);
  r.cambio_3_sale := public.nombre_de_hoy(p_mapa, r.cambio_3_sale);
  r.cambio_3_entra := public.nombre_de_hoy(p_mapa, r.cambio_3_entra);
  r.cambio_4_sale := public.nombre_de_hoy(p_mapa, r.cambio_4_sale);
  r.cambio_4_entra := public.nombre_de_hoy(p_mapa, r.cambio_4_entra);
  r.cambio_5_sale := public.nombre_de_hoy(p_mapa, r.cambio_5_sale);
  r.cambio_5_entra := public.nombre_de_hoy(p_mapa, r.cambio_5_entra);
  r.cambios_extra := public.cambios_con_nombres_de_hoy(r.cambios_extra, p_mapa);
  if jsonb_typeof(r.captura_tiempo -> 'cambios') = 'array' then
    r.captura_tiempo := jsonb_set(r.captura_tiempo, '{cambios}', public.cambios_con_nombres_de_hoy(r.captura_tiempo -> 'cambios', p_mapa));
  end if;
  if jsonb_typeof(r.formacion_cancha -> 'puestos') = 'object' then
    r.formacion_cancha := jsonb_set(r.formacion_cancha, '{puestos}', coalesce((
      select jsonb_object_agg(k,
               case when jsonb_typeof(v) = 'object' and jsonb_typeof(v -> 'nombre') = 'string'
                    then v || jsonb_build_object('nombre', public.nombre_de_hoy(p_mapa, v ->> 'nombre'))
                    else v end)
        from jsonb_each(r.formacion_cancha -> 'puestos') as p (k, v)), '{}'::jsonb));
  end if;
  return r;
end;
$$;

-- Los permisos, como en 20261022: solo la base la usa.
revoke execute on function public.partido_con_nombres_de_hoy(public.registros_partido, jsonb) from public, anon, authenticated;

-- Y los partidos de cada club, al nombre de hoy.
do $$
begin
  perform public.partidos_con_nombres_de_hoy(e.id) from public.equipos e;
end $$;

commit;
