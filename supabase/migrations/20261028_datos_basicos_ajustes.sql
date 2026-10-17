-- =====================================================================
-- Datos básicos › Ajustes (nota del 14/10: «Agregar ajustes de datos
-- basicos y mover posiciones a ajustes de partido»; Santiago, 17/10, en un
-- cuestionario: Listas, Cabeceras y Catapult; «En lesiones solo lo que sea
-- de lesiones, si comparte columnas con datos basicos quedan en datos
-- basicos»; esconder una columna compartida, «Solo en Datos básicos»; hasta
-- que haya niveles de permiso por módulo, las cambia «Cualquiera del club»;
-- «Mejor deja posiciones dentro de datos basicos»).
--
--   · Las columnas del jugador que Lesiones comparte con Datos básicos
--     (nombre y apellido, categoría, fecha de nacimiento, pie dominante y
--     posición) se cambian desde Datos básicos: su nombre (lesiones_campos)
--     y las opciones de sus listas (lesiones_opciones). Siguen en esas
--     tablas porque Lesiones las usa igual; ahora las ve, las agrega y las
--     cambia cualquiera que sigue en el club, como a los jugadores. Lo demás
--     de Lesiones sigue siendo solo de quien tiene Lesiones. No se borran
--     desde la app (se esconden).
--   · datos_basicos_columnas: lo propio de Datos básicos, una fila por club
--     y columna: el nombre de las columnas que no son de Lesiones (Actual,
--     Edad, Foto, Horas previas; vacío, el de la app) y si se esconde en la
--     tabla de Datos básicos (también las compartidas: esconderla acá no la
--     saca de Lesiones). La ve y la cambia cualquiera que sigue en el club.
--     Anon, nada.
--
-- Requiere 20261004_cuentas_v2.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.lesiones_campos') is null or to_regclass('public.lesiones_opciones') is null
     or to_regprocedure('public.puede_editar(uuid)') is null then
    raise exception 'Primero hay que correr 20261004_cuentas_v2.sql.';
  end if;
end $$;

-- Las columnas que Lesiones comparte con Datos básicos (las del jugador).
create or replace function public.es_columna_de_datos_basicos(p_campo text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_campo in ('jugador', 'categoria', 'fecha_nacimiento', 'pie_dominante', 'posicion');
$$;

comment on function public.es_columna_de_datos_basicos(text) is
  'Las columnas de Lesiones que son del jugador y se cambian desde Datos básicos › Ajustes.';

-- Las políticas la usan con la cuenta de quien pide: se saca de PUBLIC y se
-- da solo a las cuentas.
revoke execute on function public.es_columna_de_datos_basicos(text) from public, anon;
grant execute on function public.es_columna_de_datos_basicos(text) to authenticated;

-- Su nombre y sus listas: cualquiera que sigue en el club (como jugadores).
drop policy if exists lesiones_campos_datos_ver on public.lesiones_campos;
create policy lesiones_campos_datos_ver on public.lesiones_campos
  for select to authenticated
  using (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id));

drop policy if exists lesiones_campos_datos_crear on public.lesiones_campos;
create policy lesiones_campos_datos_crear on public.lesiones_campos
  for insert to authenticated
  with check (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id));

drop policy if exists lesiones_campos_datos_cambiar on public.lesiones_campos;
create policy lesiones_campos_datos_cambiar on public.lesiones_campos
  for update to authenticated
  using (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id))
  with check (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id));

drop policy if exists lesiones_opciones_datos_ver on public.lesiones_opciones;
create policy lesiones_opciones_datos_ver on public.lesiones_opciones
  for select to authenticated
  using (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id));

drop policy if exists lesiones_opciones_datos_crear on public.lesiones_opciones;
create policy lesiones_opciones_datos_crear on public.lesiones_opciones
  for insert to authenticated
  with check (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id));

drop policy if exists lesiones_opciones_datos_cambiar on public.lesiones_opciones;
create policy lesiones_opciones_datos_cambiar on public.lesiones_opciones
  for update to authenticated
  using (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id))
  with check (public.es_columna_de_datos_basicos(campo) and public.puede_editar(equipo_id));

-- Lo propio de Datos básicos.
create table if not exists public.datos_basicos_columnas (
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  columna        text not null,
  etiqueta_es    text not null default '',
  etiqueta_pt    text not null default '',
  oculto         boolean not null default false,
  actualizado_en timestamptz not null default now(),
  primary key (equipo_id, columna),
  constraint datos_basicos_columnas_textos check (char_length(columna) <= 40 and char_length(etiqueta_es) <= 120 and char_length(etiqueta_pt) <= 120)
);

comment on table public.datos_basicos_columnas is
  'Datos básicos › Ajustes: el nombre de sus columnas propias en cada idioma y cuáles se esconden en su tabla.';

-- Permisos justos: nada para anon; quien sigue en el club lee, agrega y
-- cambia (la app guarda con upsert). No se borra desde la app.
alter table public.datos_basicos_columnas enable row level security;
revoke all on table public.datos_basicos_columnas from public, anon, authenticated;
grant select, insert, update on table public.datos_basicos_columnas to authenticated;

drop policy if exists datos_basicos_columnas_ver on public.datos_basicos_columnas;
create policy datos_basicos_columnas_ver on public.datos_basicos_columnas
  for select to authenticated
  using (public.puede_editar(equipo_id));

drop policy if exists datos_basicos_columnas_crear on public.datos_basicos_columnas;
create policy datos_basicos_columnas_crear on public.datos_basicos_columnas
  for insert to authenticated
  with check (public.puede_editar(equipo_id));

drop policy if exists datos_basicos_columnas_cambiar on public.datos_basicos_columnas;
create policy datos_basicos_columnas_cambiar on public.datos_basicos_columnas
  for update to authenticated
  using (public.puede_editar(equipo_id))
  with check (public.puede_editar(equipo_id));

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.datos_basicos_columnas'::regclass) then
    raise exception 'datos_basicos_columnas quedó sin RLS.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'datos_basicos_columnas') <> 3 then
    raise exception 'datos_basicos_columnas no tiene sus tres políticas.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('lesiones_campos', 'lesiones_opciones')
         and policyname like 'lesiones_%_datos_%') <> 6 then
    raise exception 'Faltan las políticas de las columnas de Datos básicos en Lesiones.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'datos_basicos_columnas') then
    raise exception 'anon no puede tener permisos en datos_basicos_columnas.';
  end if;
end $$;

commit;

-- Que la app vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: las tablas, con sus políticas.
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public' and tablename in ('datos_basicos_columnas', 'lesiones_campos', 'lesiones_opciones')
 group by tablename
 order by tablename;
