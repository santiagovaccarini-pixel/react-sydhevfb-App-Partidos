-- =====================================================================
-- «Más es mejor» o «Menos es mejor» de cada medida, en las cabeceras de
-- cada base (Santiago, 19/10, al ver la maqueta de la planilla de V.R.:
-- «Dentro de ajustes donde estan las cabeceras, le agregamos que cuando se
-- haga click pregunte eso tmb, tiene que ser para todas las bases igual»;
-- en un cuestionario, «Solo las de números y tiempos»; Automático o Manual
-- no va acá: «eso se decide si el automatico da malos porcentajes en cada
-- categoria»).
--
--   · sentido en lesiones_campos, evaluaciones_campos, gps_campos y
--     datos_basicos_columnas: 'mas', 'menos' o vacío. Vacío es lo de la app:
--     «Más es mejor» (en Evaluaciones, los déficits «Menos es mejor»).
--   · Es lo que viene elegido al calcular un V.R. con esa medida; en cada
--     cálculo se puede cambiar. No cambia colores ni clases.
--   · Lo cambia quien cambia las cabeceras de esa base (las mismas políticas
--     de siempre). Anon, nada.
--
-- Requiere 20261102_aislamiento_entre_clubes.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. Solo agrega: la app de antes sigue andando.
-- Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.huecos_entre_clubes()') is null or to_regclass('public.datos_basicos_columnas') is null then
    raise exception 'Primero hay que correr 20261102_aislamiento_entre_clubes.sql.';
  end if;
end $$;

alter table public.lesiones_campos add column if not exists sentido text;
alter table public.evaluaciones_campos add column if not exists sentido text;
alter table public.gps_campos add column if not exists sentido text;
alter table public.datos_basicos_columnas add column if not exists sentido text;

alter table public.lesiones_campos drop constraint if exists lesiones_campos_sentido;
alter table public.lesiones_campos add constraint lesiones_campos_sentido check (sentido is null or sentido in ('mas', 'menos'));
alter table public.evaluaciones_campos drop constraint if exists evaluaciones_campos_sentido;
alter table public.evaluaciones_campos add constraint evaluaciones_campos_sentido check (sentido is null or sentido in ('mas', 'menos'));
alter table public.gps_campos drop constraint if exists gps_campos_sentido;
alter table public.gps_campos add constraint gps_campos_sentido check (sentido is null or sentido in ('mas', 'menos'));
alter table public.datos_basicos_columnas drop constraint if exists datos_basicos_columnas_sentido;
alter table public.datos_basicos_columnas add constraint datos_basicos_columnas_sentido check (sentido is null or sentido in ('mas', 'menos'));

comment on column public.lesiones_campos.sentido is
  '«Más es mejor» (mas) o «Menos es mejor» (menos) de la medida: lo que viene elegido al calcular un V.R. Vacío: lo de la app.';
comment on column public.evaluaciones_campos.sentido is
  '«Más es mejor» (mas) o «Menos es mejor» (menos) de la medida: lo que viene elegido al calcular un V.R. Vacío: lo de la app.';
comment on column public.gps_campos.sentido is
  '«Más es mejor» (mas) o «Menos es mejor» (menos) de la medida: lo que viene elegido al calcular un V.R. Vacío: lo de la app.';
comment on column public.datos_basicos_columnas.sentido is
  '«Más es mejor» (mas) o «Menos es mejor» (menos) de la medida: lo que viene elegido al calcular un V.R. Vacío: lo de la app.';

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array['lesiones_campos', 'evaluaciones_campos', 'gps_campos', 'datos_basicos_columnas'] loop
    if not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = v_tabla and c.column_name = 'sentido') then
      raise exception 'Falta la columna sentido en %.', v_tabla;
    end if;
    if has_table_privilege('anon', 'public.' || v_tabla, 'SELECT') then
      raise exception '% no es para anon.', v_tabla;
    end if;
  end loop;
  if exists (select 1 from public.huecos_entre_clubes()) then
    raise exception 'Quedaron huecos entre clubes: select * from public.huecos_entre_clubes();';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
