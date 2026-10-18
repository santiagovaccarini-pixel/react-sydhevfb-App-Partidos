-- =====================================================================
-- Aislamiento entre clubes (Santiago, 18/10: «asegúrate de que no haya
-- forma de que un club acceda a los datos de atletas de otro»).
--
-- La base ya filtra sola cada consulta por club: las reglas de cada tabla
-- (RLS) dejan ver y cambiar solo filas de los clubes de quien entra (su
-- sesión, auth.uid(), en club_miembros), y las funciones que leen con
-- permisos especiales comprueban lo mismo. La revisión encontró un resto de
-- cuando la app era de un solo club:
--   · ajustes (20260913; la app y el Excel ya no la usan): cualquier cuenta
--     autorizada, de cualquier club, leía el nombre del club de entonces. Se
--     cierra: nadie la lee desde la API. La fila queda.
-- Y suma huecos_entre_clubes(): la lista de lo que podría dejar pasar datos
-- de un club a otro (vacía, todo bien). Antes de guardar, esta migración la
-- corre y se frena si algo aparece; las pruebas de la base la corren en cada
-- cambio, junto con entrar como cada cuenta en cada tabla con club.
--
-- Se corre en Supabase > SQL Editor, entera y de una vez. No cambia ningún
-- dato. Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.puede_editar_en(uuid, text)') is null then
    raise exception 'Primero hay que correr 20261029_niveles_de_permiso.sql.';
  end if;
end $$;

-- ------------------------------------------------------ ajustes, cerrada --

drop policy if exists ajustes_ver on public.ajustes;
drop policy if exists ajustes_acceso_app on public.ajustes;
revoke all on table public.ajustes from anon, authenticated;
alter table public.ajustes enable row level security;

comment on table public.ajustes is
  'De cuando la app era de un solo club (20260913). No se usa; desde 20261102 no se lee desde la API.';

-- ------------------------------------------ Lo que podría mezclar clubes --
-- Cada fila es un hueco: qué es y dónde. Vacía, todo bien.

create or replace function public.huecos_entre_clubes()
returns table (problema text, objeto text)
language sql
stable
set search_path = ''
as $$
  -- Una tabla sin reglas: con permisos, cualquier cuenta vería todo.
  select 'tabla_sin_reglas', c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  -- Una vista que se lee con los permisos de su dueño se saltea las reglas.
  select 'vista_sin_reglas', c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v', 'm')
     and (has_any_column_privilege('authenticated', c.oid, 'SELECT')
          or has_any_column_privilege('anon', c.oid, 'SELECT'))
     and (c.relkind = 'm' or not coalesce('security_invoker=true' = any (c.reloptions), false))
  union all
  -- En una tabla con club, cada regla que abre tiene que mirar el club (las
  -- restrictivas solo achican).
  select 'regla_sin_club', p.tablename || '.' || p.policyname
    from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
     and exists (select 1 from pg_catalog.pg_attribute a
                  where a.attrelid = format('public.%I', p.tablename)::regclass
                    and a.attname = 'equipo_id' and not a.attisdropped)
     and ((p.qual is not null and p.qual not like '%equipo_id%')
          or (p.with_check is not null and p.with_check not like '%equipo_id%'))
  union all
  -- Lo que se lee desde la API sin columna de club: solo lo revisado.
  select 'sin_columna_de_club', c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and has_any_column_privilege('authenticated', c.oid, 'SELECT')
     and not exists (select 1 from pg_catalog.pg_attribute a
                      where a.attrelid = c.oid and a.attname = 'equipo_id' and not a.attisdropped)
     and c.relname not in (
       'equipos',             -- cada fila es un club: solo los propios (puede_ver)
       'v_mis_clubes',        -- los clubes propios, sobre equipos
       'perfiles',            -- la cuenta propia y las de los clubes que administra
       'catapult_cuentas',    -- la cuenta de Catapult propia
       'gps_en_curso_datos',  -- cuelga de gps_en_curso, que es por club
       'v_lesiones_excel_v1'  -- las lesiones (por club) para Power Query
     )
  union all
  -- Sin cuenta, nada.
  select 'sin_cuenta', c.relname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and (has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE')
          or has_table_privilege('anon', c.oid, 'DELETE, TRUNCATE'))
  order by 1, 2;
$$;

revoke all on function public.huecos_entre_clubes() from public, anon, authenticated;

comment on function public.huecos_entre_clubes() is
  'Lo que podría dejar pasar datos de un club a otro (20261102). Vacía, todo bien. Se corre en el SQL Editor.';

-- Antes de guardar, que no quede ninguno.
do $$
declare
  v_huecos text;
begin
  select string_agg(problema || ': ' || objeto, ', ') into v_huecos from public.huecos_entre_clubes();
  if v_huecos is not null then
    raise exception 'Hay datos que podrían pasar de un club a otro: %', v_huecos;
  end if;
  if has_any_column_privilege('authenticated', 'public.ajustes', 'SELECT, INSERT, UPDATE') then
    raise exception 'ajustes se sigue leyendo desde la API.';
  end if;
end $$;

commit;

-- Que la app vea el cambio sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: vacía.
select * from public.huecos_entre_clubes();
