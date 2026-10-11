-- =====================================================================
-- Lo nuevo sin recargar (pedido de Santiago, Notas 06/10; 11/10: «si se
-- cargan datos nuevos tengo que poder verlos sin recargar la pagina»).
--
--   · Las tablas que la app mira en vivo entran en la publicación de
--     Realtime de Supabase (supabase_realtime): lesiones, jugadores
--     (Datos básicos), evaluaciones, gps y notas. Cuando alguien carga,
--     cambia o borra una fila, las pantallas abiertas de ese club vuelven a
--     leer solas.
--   · No cambia ningún permiso: de lo que se carga o se cambia, Realtime le
--     manda a cada cuenta solo las filas que ya puede leer (las políticas de
--     cada tabla; anon no puede leer estas tablas).
--   · Los borrados: en ellos Supabase no mira las políticas y manda solo el
--     id de la fila borrada (ni su contenido ni de qué club es), a quien
--     escuche la tabla. La app los usa solo para volver a leer lo de su club.
--     Por eso NO se pone "replica identity full" en estas tablas: con eso,
--     un borrado mandaría la fila entera a cualquier cuenta con sesión.
--   · Si la publicación no existe (una base que no es de Supabase), se crea
--     vacía y se le suman las tablas.
--
-- Requiere 20261016_gps.sql. Se corre en Supabase > SQL Editor, entera y de
-- una vez. Solo agrega: la app de antes sigue andando. Se puede volver a
-- correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null or to_regclass('public.notas') is null then
    raise exception 'Primero hay que correr 20261016_gps.sql.';
  end if;
end $$;

do $$
declare
  tabla text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach tabla in array array['lesiones', 'jugadores', 'evaluaciones', 'gps', 'notas'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabla
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tabla);
    end if;
  end loop;
end $$;

commit;

-- Para ver que quedó bien: las cinco tablas en la publicación.
select tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public'
   and tablename in ('lesiones', 'jugadores', 'evaluaciones', 'gps', 'notas')
 order by tablename;
