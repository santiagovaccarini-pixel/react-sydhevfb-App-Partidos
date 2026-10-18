-- =====================================================================
-- La etapa cambia apenas se carga la fecha, aunque sea prevista (Santiago,
-- 18/10: «cargue la vuelta a entrenamiento y no ponia en Entrenamiento
-- seguia diciendo en transicion»; en un cuestionario: «Entrenando apenas la
-- cargo»).
--
--   · v_lesiones: la etapa la da la última fecha cargada (transición,
--     retorno al entrenamiento o alta), haya llegado o no. Lo demás queda
--     como en 20261031: Recup 1, Recup 2, la recuperación y los días de baja
--     cuentan hasta hoy; "activa" es sin alta cargada.
--   · v_lesiones_excel_v1 (Power Query) no tiene la etapa: no cambia.
--
-- Requiere 20261031_lesiones_fechas_futuras.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. No cambia ninguna lesión. Se puede volver a
-- correr. Después de esta, 20261031_lesiones_fechas_futuras.sql ya no se
-- vuelve a correr (se frena sola: la etapa volvería a esperar la fecha).
-- =====================================================================

begin;

do $$
begin
  if coalesce(pg_get_constraintdef((select oid from pg_constraint
                                     where conname = 'lesiones_sin_futuro' and conrelid = 'public.lesiones'::regclass)), '') like '%fecha_alta%'
     or to_regclass('public.v_lesiones') is null then
    raise exception 'Primero hay que correr 20261031_lesiones_fechas_futuras.sql.';
  end if;
end $$;

-- ------------------------------- La etapa, con la última fecha cargada --
-- Las mismas columnas, en el mismo orden (20261031); cambia solo la etapa.

create or replace view public.v_lesiones
with (security_invoker = true)
as
select l.*,
       coalesce(j.nombre, l.persona) as jugador,
       e.nombre as equipo,
       case when l.fecha_transicion is not null then least(l.fecha_transicion, current_date) - l.fecha_lesion end as recup_1,
       case when l.fecha_retorno_entrenamiento is not null
            then least(l.fecha_retorno_entrenamiento, current_date)
                 - coalesce(case when l.fecha_transicion is not null then least(l.fecha_transicion, current_date) end, l.fecha_lesion) end as recup_2,
       case when l.fecha_alta is not null then least(l.fecha_alta, current_date) - l.fecha_lesion end as recuperacion,
       (least(l.fecha_alta, current_date) - l.fecha_lesion) as dias_baja,
       (l.fecha_lesion is not null and l.fecha_alta is null) as activa,
       case
         when l.fecha_lesion is null then 'sin_fecha'
         when l.fecha_alta is not null then 'alta'
         when l.fecha_retorno_entrenamiento is not null then 'entrenando'
         when l.fecha_transicion is not null then 'transicion'
         else 'lesionado'
       end as etapa
  from public.lesiones l
  left join public.jugadores j on j.id = l.jugador_id
  join public.equipos e on e.id = l.equipo_id;

revoke all on public.v_lesiones from anon;
grant select on public.v_lesiones to authenticated;

comment on view public.v_lesiones is
  'Las lesiones con lo calculado: días, Recup y recuperación hasta hoy (20261031); la etapa, con la última fecha cargada, aunque sea prevista (20261101).';

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if has_table_privilege('anon', 'public.v_lesiones', 'SELECT') then
    raise exception 'anon no puede ver la vista de lesiones.';
  end if;
end $$;

commit;

-- Que la app vea el cambio sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: cuántas lesiones hay en cada etapa.
select etapa, count(*) as lesiones
  from public.v_lesiones
 group by etapa
 order by etapa;
