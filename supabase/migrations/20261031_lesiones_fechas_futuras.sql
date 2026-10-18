-- =====================================================================
-- Las fechas de la vuelta se pueden cargar a futuro (Santiago, 18/10, en
-- «Alta médica»: «claro que son todas futuras»; en un cuestionario, la
-- lesión sale de Nuevos casos «Apenas la cargo», la etapa, los días de baja
-- y los reportes cuentan «Hasta hoy» y vale «En toda la app»).
--
--   · lesiones_sin_futuro: solo la fecha de la lesión no puede ser futura.
--     El pase a transición, el retorno al entrenamiento y el retorno a la
--     competencia (alta) se pueden cargar a futuro (las fechas previstas).
--   · v_lesiones y v_lesiones_excel_v1 (Power Query) cuentan hasta hoy, como
--     la app: cada fecha cuenta recién cuando llega. La etapa cambia el día
--     que llega cada fecha; Recup 1, Recup 2, la recuperación y los días de
--     baja van hasta esa fecha o, si todavía no llegó, hasta hoy; la
--     severidad, cuando llegó el alta. "activa" sigue siendo sin alta
--     cargada (sale de Nuevos casos apenas se carga).
--
-- Requiere 20261010_lesiones_sin_fecha_y_personas.sql. Se corre en Supabase
-- > SQL Editor, entera y de una vez. No cambia ninguna lesión: afloja una
-- regla y cambia cómo cuentan las vistas. Se puede volver a correr. Después
-- de esta, 20261010_lesiones_sin_fecha_y_personas.sql ya no se vuelve a
-- correr (se frena sola: las vistas volverían a contar con las fechas
-- previstas).
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lesiones' and column_name = 'persona') then
    raise exception 'Primero hay que correr 20261010_lesiones_sin_fecha_y_personas.sql.';
  end if;
end $$;

-- ----------------------------------------- Solo el inicio, no futuro --

alter table public.lesiones drop constraint if exists lesiones_sin_futuro;
alter table public.lesiones add constraint lesiones_sin_futuro check (fecha_lesion <= current_date);

comment on constraint lesiones_sin_futuro on public.lesiones is
  'La fecha de la lesión no puede ser futura. Las de la vuelta (transición, retorno al entrenamiento y alta) sí: son las previstas (20261031).';

-- ------------------------------------------ La vista general, hasta hoy --

drop view if exists public.v_lesiones;

create view public.v_lesiones
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
         when l.fecha_alta <= current_date then 'alta'
         when l.fecha_retorno_entrenamiento <= current_date then 'entrenando'
         when l.fecha_transicion <= current_date then 'transicion'
         else 'lesionado'
       end as etapa
  from public.lesiones l
  left join public.jugadores j on j.id = l.jugador_id
  join public.equipos e on e.id = l.equipo_id;

revoke all on public.v_lesiones from anon;
grant select on public.v_lesiones to authenticated;

-- ---------------------------- La vista para Power Query, hasta hoy --
-- Las mismas columnas, en el mismo orden (20261010); cambian Recup 1,
-- Recup 2, la recuperación y la severidad.

drop view if exists public.v_lesiones_excel_v1;

create view public.v_lesiones_excel_v1
with (security_invoker = true)
as
with base as (
  select l.*,
         coalesce(j.nombre, l.persona) as jugador_nombre,
         -- Quién es, para numerar sus lesiones y buscar recurrencias: el
         -- jugador, o la persona (sin mayúsculas ni espacios de más).
         coalesce('j:' || l.jugador_id::text, 'p:' || lower(btrim(l.persona))) as quien,
         j.categoria as jugador_categoria,
         j.fecha_nacimiento,
         j.pie_dominante,
         j.posicion as jugador_posicion,
         e.nombre as clube,
         row_number() over (partition by l.equipo_id, coalesce('j:' || l.jugador_id::text, 'p:' || lower(btrim(l.persona))) order by l.numero_caso, l.fecha_lesion) as n_registro
    from public.lesiones l
    left join public.jugadores j on j.id = l.jugador_id
    join public.equipos e on e.id = l.equipo_id
),
calc as (
  select a.*,
         (a.fecha_alta - a.fecha_lesion) as dias_recuperacao,
         exists (
           select 1 from base p
            where p.equipo_id = a.equipo_id and p.quien = a.quien and p.id <> a.id
              and p.fecha_lesion < a.fecha_lesion
              and coalesce(p.datos->>'parte_cuerpo', '') = coalesce(a.datos->>'parte_cuerpo', '')
              and coalesce(p.datos->>'lado', '') = coalesce(a.datos->>'lado', '')
              and coalesce(p.datos->>'musculo', '') = coalesce(a.datos->>'musculo', '')
              and (a.fecha_lesion - coalesce(p.fecha_alta, current_date)) <= 60
         ) as recorrente,
         exists (
           select 1 from base p
            where p.equipo_id = a.equipo_id and p.quien = a.quien and p.id <> a.id
              and p.fecha_lesion < a.fecha_lesion
              and coalesce(p.datos->>'parte_cuerpo', '') = coalesce(a.datos->>'parte_cuerpo', '')
              and coalesce(p.datos->>'lado', '') = coalesce(a.datos->>'lado', '')
              and coalesce(p.datos->>'musculo', '') = coalesce(a.datos->>'musculo', '')
              and coalesce(p.datos->>'area', '') = coalesce(a.datos->>'area', '')
              and coalesce(p.datos->>'musculo_especifico', '') = coalesce(a.datos->>'musculo_especifico', '')
              and (a.fecha_lesion - coalesce(p.fecha_alta, current_date)) <= 30
         ) as recidivante
    from base a
)
select c.numero_caso as n_de_caso,
       c.n_registro as n_de_registro,
       c.jugador_nombre as nome_e_sobrenome,
       public.lesiones_etiqueta(c.equipo_id, 'categoria', coalesce(c.datos->>'categoria', c.jugador_categoria)) as categoria,
       c.fecha_nacimiento as d_nac,
       public.lesiones_etiqueta(c.equipo_id, 'pie_dominante', c.pie_dominante) as p_dominante,
       public.lesiones_etiqueta(c.equipo_id, 'posicion', c.jugador_posicion) as posicao,
       case when c.fecha_nacimiento is null or c.fecha_lesion is null then null
            else extract(year from age(c.fecha_lesion, c.fecha_nacimiento))::int end as idade,
       public.lesiones_etiqueta(c.equipo_id, 'tipo_lesion', c.datos->>'tipo_lesion') as tipo_de_lesao,
       public.lesiones_etiqueta(c.equipo_id, 'parte_cuerpo', c.datos->>'parte_cuerpo') as parte_do_corpo_lesionada,
       public.lesiones_etiqueta(c.equipo_id, 'lado', c.datos->>'lado') as lado,
       case when c.datos->>'lado' is null or c.pie_dominante is null then null
            when c.datos->>'lado' = c.pie_dominante then public.lesiones_etiqueta(c.equipo_id, 'lado_habil', 'sim')
            else public.lesiones_etiqueta(c.equipo_id, 'lado_habil', 'nao') end as lado_habil_lesionado,
       c.datos->>'hora_imagen' as hora_da_imagem,
       c.datos->>'imagenes' as imagens,
       coalesce(public.lesiones_horas_imagen(c.datos->>'hora_imagen', c.fecha_lesion)::numeric,
                case when btrim(c.datos->>'horas_imagen') ~ '^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$'
                     then replace(btrim(c.datos->>'horas_imagen'), ',', '.')::numeric end) as horas_passadas_imagem_lesao,
       public.lesiones_etiqueta(c.equipo_id, 'ligamento', c.datos->>'ligamento') as lig_especifico,
       public.lesiones_etiqueta(c.equipo_id, 'musculo', c.datos->>'musculo') as musculo_afetado,
       public.lesiones_etiqueta(c.equipo_id, 'musculo_especifico', c.datos->>'musculo_especifico') as musculo_especifico,
       public.lesiones_etiqueta(c.equipo_id, 'area', c.datos->>'area') as area,
       public.lesiones_etiqueta(c.equipo_id, 'producto', c.datos->>'producto') as produto,
       public.lesiones_etiqueta(c.equipo_id, 'mecanismo', c.datos->>'mecanismo') as mecanismo,
       public.lesiones_etiqueta(c.equipo_id, 'cuando', c.datos->>'cuando') as quando,
       public.lesiones_etiqueta(c.equipo_id, 'localizacion', c.datos->>'localizacion') as localizacao,
       c.fecha_lesion as data_de_inicio_da_lesao,
       c.fecha_transicion as passagem_para_o_transicao,
       -- Con una fecha prevista (futura), hasta hoy.
       case when c.fecha_transicion is not null then least(c.fecha_transicion, current_date) - c.fecha_lesion end as recup_1,
       c.fecha_retorno_entrenamiento as retorno_a_data_de_treinamento,
       case when c.fecha_retorno_entrenamiento is not null then least(c.fecha_retorno_entrenamiento, current_date) - c.fecha_lesion end as recup_2,
       c.fecha_alta as retorno_a_data_da_competicao,
       (least(c.fecha_alta, current_date) - c.fecha_lesion) as recuperacao,
       -- La severidad, cuando llegó el alta.
       case when c.fecha_alta is null or c.fecha_lesion is null or c.fecha_alta > current_date then null
            when c.dias_recuperacao <= 0 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'registro')
            when c.dias_recuperacao <= 4 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'leve')
            when c.dias_recuperacao <= 7 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'menor')
            when c.dias_recuperacao <= 28 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'moderado')
            else public.lesiones_etiqueta(c.equipo_id, 'severidad', 'mayor') end as severidade,
       -- Sin fecha de inicio todavía no se sabe (como en la app).
       case when c.fecha_lesion is null then null
            else public.lesiones_etiqueta(c.equipo_id, 'recurrencia', case when c.recorrente then 'sim' else 'nao' end) end as recorrencia,
       case when c.fecha_lesion is null then null
            else public.lesiones_etiqueta(c.equipo_id, 'recidiva', case when c.recidivante then 'sim' else 'nao' end) end as recidiva,
       concat_ws(' ',
         nullif(public.lesiones_etiqueta(c.equipo_id, 'tipo_lesion', c.datos->>'tipo_lesion'), ''),
         coalesce(nullif(public.lesiones_etiqueta(c.equipo_id, 'ligamento', c.datos->>'ligamento'), ''),
                  nullif(public.lesiones_etiqueta(c.equipo_id, 'musculo_especifico', c.datos->>'musculo_especifico'), '')),
         coalesce(nullif(public.lesiones_etiqueta(c.equipo_id, 'musculo', c.datos->>'musculo'), ''),
                  nullif(public.lesiones_etiqueta(c.equipo_id, 'parte_cuerpo', c.datos->>'parte_cuerpo'), '')),
         nullif(public.lesiones_etiqueta(c.equipo_id, 'area', c.datos->>'area'), ''),
         nullif(public.lesiones_etiqueta(c.equipo_id, 'lado', c.datos->>'lado'), '')) as diagnostico,
       c.datos->>'comentarios' as comentarios_adicionais,
       c.datos->>'medico' as medico,
       c.clube,
       c.id as lesao_id
  from calc c
 order by c.equipo_id, c.numero_caso;

revoke all on public.v_lesiones_excel_v1 from anon;
grant select on public.v_lesiones_excel_v1 to authenticated;

comment on view public.v_lesiones_excel_v1 is 'Las 35 columnas del Excel de lesiones para Power Query (horas hasta la imagen calculadas: 20261006; con las lesiones sin fecha y las de personas fuera de Datos básicos: 20261010; con fechas previstas, hasta hoy: 20261031).';

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'lesiones_sin_futuro' and conrelid = 'public.lesiones'::regclass)) like '%fecha_alta%' then
    raise exception 'La regla de las fechas futuras no cambió.';
  end if;
  if has_table_privilege('anon', 'public.v_lesiones_excel_v1', 'SELECT') or has_table_privilege('anon', 'public.v_lesiones', 'SELECT') then
    raise exception 'anon no puede ver las vistas de lesiones.';
  end if;
end $$;

commit;

-- Que la app vea el cambio sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: la regla nueva (solo la fecha de la lesión) y
-- cuántas lesiones tienen alguna fecha de la vuelta a futuro (al correrla,
-- ninguna).
select pg_get_constraintdef(oid) as regla_sin_futuro,
       (select count(*) from public.lesiones
         where fecha_transicion > current_date or fecha_retorno_entrenamiento > current_date or fecha_alta > current_date) as con_fechas_previstas
  from pg_constraint where conname = 'lesiones_sin_futuro' and conrelid = 'public.lesiones'::regclass;
