-- =====================================================================
-- Partido compartido entre celulares, parte 4b (paso 4 de la nota «cargar
-- sin señal y a la vez que otra persona»; Santiago, 23/10, en cuestionarios:
-- otro celular se suma con un aviso «Sumarme»; se ofrece «Hasta guardarlo
-- terminado» y, si nadie lo guarda, deja de ofrecerse a las 6 horas sin
-- cambios).
--
--   · partidos_en_curso_del_club: los partidos en curso del club con algún
--     cambio en las últimas 6 horas, el último primero (con lo cargado, la
--     fila del Historial, la versión y quién lo cambió por última vez). La
--     app ofrece «Sumarme» a los que no se guardaron terminados y lee de ahí
--     el que tiene abierto (con la versión, una lectura vieja no pisa una
--     nueva). Con los permisos de quien la llama (lo ve quien tiene Partido
--     en el club). Anon, nada.
--   · partidos_en_curso entra en la publicación de Realtime: lo que anota un
--     celular les llega solo a los otros (Realtime manda a cada cuenta solo
--     lo que ya puede leer; sin «replica identity full», como en
--     20261017_en_vivo.sql).
--
-- Requiere 20261120_partido_en_curso.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.partidos_en_curso') is null then
    raise exception 'Primero hay que correr 20261120_partido_en_curso.sql.';
  end if;
end $$;

create or replace function public.partidos_en_curso_del_club(p_equipo uuid)
returns table (id uuid, datos jsonb, registro_id bigint, version integer, actualizado_en timestamptz, actualizado_email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.datos, p.registro_id, p.version, p.actualizado_en, p.actualizado_email
    from public.partidos_en_curso p
   where p.equipo_id = p_equipo
     and p.actualizado_en > now() - interval '6 hours'
   order by p.actualizado_en desc
   limit 20;
$$;

revoke execute on function public.partidos_en_curso_del_club(uuid) from public, anon;
grant execute on function public.partidos_en_curso_del_club(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partidos_en_curso'
  ) then
    alter publication supabase_realtime add table public.partidos_en_curso;
  end if;
end $$;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if has_function_privilege('anon', 'public.partidos_en_curso_del_club(uuid)', 'EXECUTE') then
    raise exception 'anon no puede leer los partidos en curso.';
  end if;
end $$;

commit;

-- Que la app vea la función sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: la función y la tabla en la publicación.
select to_regprocedure('public.partidos_en_curso_del_club(uuid)') as funcion,
       exists (select 1 from pg_publication_tables
                where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partidos_en_curso') as en_vivo;
