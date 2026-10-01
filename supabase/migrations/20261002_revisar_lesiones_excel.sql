-- Revisión de 20261002_lesiones_excel.sql. No cambia nada. Cada bloque se
-- puede correr por separado.

-- 1. Las columnas de lesiones y las nuevas de jugadores.
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'lesiones') or (table_name = 'jugadores' and column_name in ('numero_registro', 'categoria', 'fecha_nacimiento', 'pie_dominante')))
 order by table_name, ordinal_position;

-- 2. RLS prendida en las cuatro tablas y una política por tabla.
select relname, relrowsecurity from pg_class
 where relname in ('lesiones', 'lesiones_historial', 'lesiones_campos', 'lesiones_opciones');
select tablename, policyname, cmd from pg_policies
 where schemaname = 'public' and tablename like 'lesiones%' order by tablename;

-- 3. Disparadores: numerar caso, anotar cambio, historial.
select event_object_table, trigger_name, event_manipulation
  from information_schema.triggers
 where trigger_name in ('lesiones_numerar_caso', 'lesiones_anotar_cambio', 'lesiones_historial_anotar')
 order by trigger_name, event_manipulation;

-- 4. Cabeceras y opciones sembradas por club (después de abrir Lesiones en la app).
select e.nombre as club, count(distinct c.campo) as cabeceras, count(o.codigo) as opciones
  from public.equipos e
  left join public.lesiones_campos c on c.equipo_id = e.id
  left join public.lesiones_opciones o on o.equipo_id = e.id
 group by e.nombre;

-- 5. La vista para Excel, con los textos.
select * from public.v_lesiones_excel_v1 limit 5;
