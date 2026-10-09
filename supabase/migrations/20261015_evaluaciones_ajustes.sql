-- =====================================================================
-- Evaluaciones › Ajustes: el nombre de cada cabecera y las opciones de cada
-- lista, por club, como Lesiones › Ajustes (pedido de Santiago del 09/10:
-- "la pantalla de ajustes donde se puedan cambiar las cabeceras y listas").
--
--   · evaluaciones_campos: cómo se llama cada columna de cada test en este
--     club (en español y portugués) y si se muestra. Una fila solo cuando
--     el club cambió algo; si no, valen los nombres del Excel. Los títulos
--     de los bloques de columnas (la fila de arriba de las cabeceras) van
--     acá también, con la clave "grupo:…".
--   · evaluaciones_opciones: las opciones de cada lista (Selección y las
--     que traigan los tests), en este club. Las evaluaciones guardan el
--     código; acá está el texto.
--   · Permisos como los de Lesiones › Ajustes: las ven quienes tienen
--     Evaluaciones en el club (también quien se fue, para mirar lo suyo) y
--     las cambian quienes siguen en el club con Evaluaciones. anon, nada.
--
-- Requiere 20261012_evaluaciones.sql. Se corre en Supabase > SQL Editor,
-- entero y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.evaluaciones') is null then
    raise exception 'Primero hay que correr 20261012_evaluaciones.sql.';
  end if;
  if to_regprocedure('public.puede_ver(uuid)') is null or to_regprocedure('public.puede_editar(uuid)') is null
     or to_regprocedure('public.puede_usar_en(uuid, text)') is null then
    raise exception 'Faltan los permisos por club: primero hay que correr 20261004_cuentas_v2.sql.';
  end if;
end $$;

-- ------------------------------------------------------------ Tablas --

create table if not exists public.evaluaciones_campos (
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  test           text not null,
  campo          text not null,
  etiqueta_es    text not null default '',
  etiqueta_pt    text not null default '',
  oculto         boolean not null default false,
  orden          integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (equipo_id, test, campo),
  constraint evaluaciones_campos_test check (test ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint evaluaciones_campos_campo check (char_length(campo) between 1 and 80),
  constraint evaluaciones_campos_etiquetas check (char_length(etiqueta_es) <= 120 and char_length(etiqueta_pt) <= 120)
);

comment on table public.evaluaciones_campos is
  'Cómo se llama cada columna de cada test de Evaluaciones en este club (en español y portugués) y si se muestra. Sin fila, vale el nombre del Excel.';

create table if not exists public.evaluaciones_opciones (
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  lista          text not null,
  codigo         text not null,
  etiqueta_es    text not null default '',
  etiqueta_pt    text not null default '',
  oculto         boolean not null default false,
  orden          integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (equipo_id, lista, codigo),
  constraint evaluaciones_opciones_lista check (char_length(lista) between 1 and 80),
  constraint evaluaciones_opciones_codigo check (char_length(codigo) between 1 and 80),
  constraint evaluaciones_opciones_etiquetas check (char_length(etiqueta_es) <= 120 and char_length(etiqueta_pt) <= 120)
);

comment on table public.evaluaciones_opciones is
  'Las opciones de cada lista de Evaluaciones en este club (Selección y las de cada test). Las evaluaciones guardan el código; acá está el texto.';

-- ---------------------------------------------------------- Permisos --

alter table public.evaluaciones_campos enable row level security;
alter table public.evaluaciones_opciones enable row level security;
revoke all on table public.evaluaciones_campos, public.evaluaciones_opciones from public, anon, authenticated;
grant select, insert, update, delete on table public.evaluaciones_campos, public.evaluaciones_opciones to authenticated;

drop policy if exists evaluaciones_campos_ver on public.evaluaciones_campos;
create policy evaluaciones_campos_ver on public.evaluaciones_campos
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_ver(equipo_id));

drop policy if exists evaluaciones_campos_cambiar on public.evaluaciones_campos;
create policy evaluaciones_campos_cambiar on public.evaluaciones_campos
  for all to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

drop policy if exists evaluaciones_opciones_ver on public.evaluaciones_opciones;
create policy evaluaciones_opciones_ver on public.evaluaciones_opciones
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_ver(equipo_id));

drop policy if exists evaluaciones_opciones_cambiar on public.evaluaciones_opciones;
create policy evaluaciones_opciones_cambiar on public.evaluaciones_opciones
  for all to authenticated
  using (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'evaluaciones') and public.puede_editar(equipo_id));

-- Antes de guardar, que haya quedado bien: las dos tablas con RLS, sus
-- cuatro políticas y nada para anon.
do $$
begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname in ('evaluaciones_campos', 'evaluaciones_opciones') and c.relrowsecurity) <> 2 then
    raise exception 'Las tablas de Ajustes de Evaluaciones quedaron sin RLS.';
  end if;
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename in ('evaluaciones_campos', 'evaluaciones_opciones')) <> 4 then
    raise exception 'Las tablas de Ajustes de Evaluaciones no tienen sus cuatro políticas.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public'
                and table_name in ('evaluaciones_campos', 'evaluaciones_opciones')) then
    raise exception 'anon no puede tener permisos en las tablas de Ajustes de Evaluaciones.';
  end if;
end $$;

commit;

-- Que la app vea las tablas nuevas sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: las políticas de las tablas nuevas.
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('evaluaciones_campos', 'evaluaciones_opciones')
 order by tablename, policyname;
