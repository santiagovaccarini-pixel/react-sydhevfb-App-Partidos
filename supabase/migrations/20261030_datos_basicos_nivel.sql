-- =====================================================================
-- El nivel de Datos básicos (Santiago, 17/10, al cerrar los niveles de
-- permiso por módulo: «Su propio desplegable»). Datos básicos lo tiene
-- todo el que sigue en el club (los demás módulos usan su lista de
-- jugadores), así que no hay «Sin acceso»: Solo lectura o Edición.
--
--   · club_miembros.solo_lectura y club_invitaciones.solo_lectura admiten
--     también 'datos': con eso, Datos básicos en solo lectura. Sin 'datos'
--     (como quedan todos al correrla), Edición, como hasta ahora.
--   · puede_editar_en(club, 'datos'): sigue en el club y no lo tiene en
--     solo lectura.
--   · Agregar, cambiar y borrar jugadores (también sus posiciones, su foto,
--     sus horas previas y su dispositivo de Catapult), lo propio de Datos
--     básicos › Ajustes (datos_basicos_columnas) y el nombre y las listas de
--     las columnas del jugador que comparte con Lesiones piden Edición en
--     Datos básicos: políticas restrictivas, como las de 20261029. Lo demás
--     de Lesiones sigue pidiendo Edición en Lesiones. Leer no cambia.
--
-- Requiere 20261029_niveles_de_permiso.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. Solo agrega: todos quedan con Edición en
-- Datos básicos. Se puede volver a correr. Después de esta,
-- 20261029_niveles_de_permiso.sql ya no se vuelve a correr (se frena sola:
-- sacaría Datos básicos de los niveles).
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'club_miembros' and column_name = 'solo_lectura')
     or to_regprocedure('public.clubes_donde_edito(text)') is null then
    raise exception 'Primero hay que correr 20261029_niveles_de_permiso.sql.';
  end if;
  if to_regclass('public.datos_basicos_columnas') is null then
    raise exception 'Primero hay que correr 20261028_datos_basicos_ajustes.sql.';
  end if;
end $$;

-- ------------------------------------------------- 'datos' en la lista --

alter table public.club_miembros drop constraint if exists club_miembros_solo_lectura_valida;
alter table public.club_miembros
  add constraint club_miembros_solo_lectura_valida
  check (solo_lectura <@ array['partido', 'flujo', 'lesiones', 'evaluaciones', 'gps', 'datos']::text[]);
alter table public.club_invitaciones drop constraint if exists club_invitaciones_solo_lectura_valida;
alter table public.club_invitaciones
  add constraint club_invitaciones_solo_lectura_valida
  check (solo_lectura <@ array['partido', 'flujo', 'lesiones', 'evaluaciones', 'gps', 'datos']::text[]);

comment on column public.club_miembros.solo_lectura is
  'Los módulos que esta cuenta tiene en este club solo para mirar (Solo lectura); ''datos'' es Datos básicos. Los demás que tiene, con Edición.';
comment on column public.club_invitaciones.solo_lectura is
  'Los módulos con los que entra solo para mirar (Solo lectura); ''datos'' es Datos básicos.';

-- La de 20261029, con Datos básicos: lo tiene todo el que sigue en el club.
create or replace function public.puede_editar_en(p_equipo uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.esta_autorizado()
     and exists (select 1 from public.club_miembros m
                  where m.equipo_id = p_equipo and m.user_id = auth.uid() and m.hasta is null
                    and not (p_modulo = any (m.solo_lectura))
                    and case p_modulo
                          when 'partido' then m.partido
                          when 'flujo' then m.flujo
                          when 'lesiones' then m.lesiones
                          when 'evaluaciones' then m.evaluaciones
                          when 'gps' then m.gps
                          when 'datos' then true
                          else false end);
$$;

comment on function public.puede_editar_en(uuid, text) is
  'Tiene el módulo en ese club (Datos básicos, todo el que sigue), sigue en el club y lo tiene con Edición (no en solo lectura).';

revoke execute on function public.puede_editar_en(uuid, text) from public, anon;
grant execute on function public.puede_editar_en(uuid, text) to authenticated;

-- ----------------------------------- Cambiar Datos básicos pide Edición --

do $$
declare
  v_tabla text;
  v_condicion text;
begin
  foreach v_tabla in array array['jugadores', 'datos_basicos_columnas', 'lesiones_campos', 'lesiones_opciones'] loop
    v_condicion := case
      -- Las columnas del jugador, con Edición en Datos básicos; las demás
      -- de Lesiones, con Edición en Lesiones (como en 20261029).
      when v_tabla in ('lesiones_campos', 'lesiones_opciones') then
        'case when public.es_columna_de_datos_basicos(campo) then equipo_id in (select public.clubes_donde_edito(''datos'')) '
        || 'else equipo_id in (select public.clubes_donde_edito(''lesiones'')) end'
      else
        'equipo_id in (select public.clubes_donde_edito(''datos''))'
    end;
    execute format('drop policy if exists %I on public.%I', v_tabla || '_nivel_crear', v_tabla);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)',
                   v_tabla || '_nivel_crear', v_tabla, v_condicion);
    execute format('drop policy if exists %I on public.%I', v_tabla || '_nivel_cambiar', v_tabla);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (%s) with check (%s)',
                   v_tabla || '_nivel_cambiar', v_tabla, v_condicion, v_condicion);
    execute format('drop policy if exists %I on public.%I', v_tabla || '_nivel_borrar', v_tabla);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (%s)',
                   v_tabla || '_nivel_borrar', v_tabla, v_condicion);
  end loop;
end $$;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public' and policyname like '%\_nivel\_%' and permissive = 'RESTRICTIVE') <> 60 then
    raise exception 'Faltan políticas de nivel (tienen que ser 60: 20 tablas por crear, cambiar y borrar).';
  end if;
  if has_function_privilege('anon', 'public.puede_editar_en(uuid, text)', 'EXECUTE') then
    raise exception 'anon no puede ejecutar las funciones del nivel.';
  end if;
end $$;

commit;

-- Que la app vea el cambio sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: cuántas cuentas tienen Datos básicos en solo
-- lectura (al correrla por primera vez, ninguna) y las políticas de nivel.
select (select count(*) from public.club_miembros where 'datos' = any (solo_lectura)) as datos_basicos_en_solo_lectura,
       (select count(*) from pg_policies where schemaname = 'public' and policyname like '%\_nivel\_%') as politicas_de_nivel;
