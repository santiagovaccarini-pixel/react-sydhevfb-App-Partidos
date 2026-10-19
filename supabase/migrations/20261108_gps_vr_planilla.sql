-- =====================================================================
-- GPS: los V.R. calculados con la planilla del club (nota 2 de la planilla
-- de valor referencial; Santiago, 18/10 y 19/10: elegir la muestra en la
-- Base, calcular con la lógica de su «Plantilla VR», «Un solo nombre libre»
-- en «Agregar V.R.» y «Recalcular» en la tarjeta: «Sí, con «Recalcular»»).
--
--   · gps_referencias.planilla: con qué se calculó un V.R. de la planilla:
--     la muestra (los filtros de cada columna, con los valores guardados de
--     las filas, no los textos: así sirve en los dos idiomas y con los
--     nombres de hoy), lo elegido en cada medida (Más o Menos es mejor,
--     Automático o Manual) y cuándo y con cuántas filas. Vacío en los V.R.
--     escritos a mano o cargados por SQL. Con eso «Recalcular» vuelve a
--     calcular con los datos de ese día; los números de antes quedan en los
--     últimos cambios (el historial anota la fila entera), con «Volver».
--   · Un V.R. de la planilla tiene un solo nombre: va en `tabla` (así se
--     elige solo en el desplegable Tabla), con tipo y grupo vacíos. Los
--     demás siguen con los tres.
--   · Sus números van como los de los V.R. por jugador: el Bueno en
--     `promedio` y Excelente, Muy Bueno, Regular y Malo en `categorias`.
--   · Lo cambia quien cambia los V.R. (las mismas políticas). Anon, nada.
--
-- Requiere 20261026_gps_referencias_categorias.sql y
-- 20261102_aislamiento_entre_clubes.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'gps_referencias' and column_name = 'categorias') then
    raise exception 'Primero hay que correr 20261026_gps_referencias_categorias.sql.';
  end if;
  if to_regprocedure('public.huecos_entre_clubes()') is null then
    raise exception 'Primero hay que correr 20261102_aislamiento_entre_clubes.sql.';
  end if;
end $$;

alter table public.gps_referencias add column if not exists planilla jsonb;

comment on column public.gps_referencias.planilla is
  'Con qué se calculó un V.R. de la planilla: la muestra (filtros con los valores guardados), lo elegido en cada medida y cuándo. Vacío: escrito a mano o cargado por SQL.';

alter table public.gps_referencias drop constraint if exists gps_referencias_planilla;
alter table public.gps_referencias add constraint gps_referencias_planilla check (
  planilla is null or (jsonb_typeof(planilla) = 'object' and pg_column_size(planilla) <= 65536));

-- Un V.R. de la planilla: el nombre en tabla, tipo y grupo pueden ir vacíos.
alter table public.gps_referencias drop constraint if exists gps_referencias_textos;
alter table public.gps_referencias add constraint gps_referencias_textos check (
  char_length(dispositivo) between 1 and 80 and char_length(tabla) between 1 and 120
  and char_length(tipo) <= 80 and char_length(grupo) <= 120
  and (planilla is not null or (char_length(tipo) >= 1 and char_length(grupo) >= 1)));

grant insert (planilla) on table public.gps_referencias to authenticated;
grant update (planilla) on table public.gps_referencias to authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.gps_referencias'::regclass) then
    raise exception 'gps_referencias quedó sin RLS.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_referencias') then
    raise exception 'anon no puede tener permisos en los V.R.';
  end if;
  if exists (select 1 from information_schema.column_privileges
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_referencias') then
    raise exception 'anon no puede tener permisos en las columnas de los V.R.';
  end if;
  if (select count(*) from information_schema.column_privileges
       where grantee = 'authenticated' and table_schema = 'public' and table_name = 'gps_referencias'
         and column_name = 'planilla' and privilege_type in ('INSERT', 'UPDATE')) <> 2 then
    raise exception 'La planilla de los V.R. no se puede guardar desde la app.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'referencias_historial_anotar'
                  and tgrelid = 'public.gps_referencias'::regclass) then
    raise exception 'Los cambios de los V.R. de GPS quedaron sin historial.';
  end if;
  if exists (select 1 from public.huecos_entre_clubes()) then
    raise exception 'Quedaron huecos entre clubes: select * from public.huecos_entre_clubes();';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
