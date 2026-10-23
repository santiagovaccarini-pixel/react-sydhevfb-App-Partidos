-- =====================================================================
-- GPS › Cargar: varias cargas sin terminar el mismo día (paso 3c.2a de la
-- nota «cargar sin señal y a la vez que otra persona»; Santiago, 23/10, en
-- un cuestionario sobre una carga dejada sin señal cuando ese día ya tiene
-- otra «Sin terminar»: «Deja que hayas mas de una por dia, pero si cumple con
-- las reglas de validacion avisa y lo descarta»; «la misma» es la del «Mismo
-- CSV», y vale «Con y sin señal»). Reabre la regla del 13/10 («lo frena y dice
-- que ya esta en curso ese cargado»): un día puede tener varias cargas sin
-- terminar (otro turno, otro CSV); la del mismo CSV la frena la app al leerlo
-- (las mismas distancias, tiempos y hora de inicio, como el CSV que ya está
-- en la Base), no la base: el CSV va adentro de lo hecho.
--
--   · Sale la regla «una por día y club» (gps_en_curso_un_dia). Lo demás de
--     20261021_gps_en_curso.sql sigue igual: quién la dejó, la versión (si
--     otro aparato la dejó en el medio, no se pisa), los permisos y Anon,
--     nada.
--   · Las del día se siguen buscando por club y fecha: un índice para eso
--     (antes lo daba la regla).
--
-- Requiere 20261021_gps_en_curso.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. La app de antes sigue andando (frena el segundo del
-- día ella misma). Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps_en_curso') is null then
    raise exception 'Primero hay que correr 20261021_gps_en_curso.sql.';
  end if;
end $$;

alter table public.gps_en_curso drop constraint if exists gps_en_curso_un_dia;

create index if not exists gps_en_curso_del_dia on public.gps_en_curso (equipo_id, fecha);

comment on table public.gps_en_curso is
  'Las cargas de GPS › Cargar que se dejaron para revisar: varias por día y club (la del mismo CSV la frena la app). Lo hecho está en gps_en_curso_datos.';

commit;

-- Para ver que quedó bien: sin la regla de una por día y con el índice.
select count(*) as reglas_de_un_dia
  from pg_constraint
 where conname = 'gps_en_curso_un_dia' and conrelid = 'public.gps_en_curso'::regclass;
select indexname as indice
  from pg_indexes
 where schemaname = 'public' and tablename = 'gps_en_curso' and indexname = 'gps_en_curso_del_dia';
