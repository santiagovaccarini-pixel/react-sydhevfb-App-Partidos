-- =====================================================================
-- Las horas entre la lesión y la imagen se calculan solas.
--
--   · lesiones_horas_imagen(hora, fecha): las horas desde el comienzo del
--     día de la lesión (la lesión tiene fecha, no hora) hasta la hora de la
--     imagen, redondeadas; vacío si no hay imagen o si lo cargado no es una
--     fecha y hora que exista. Es la misma cuenta que hace la app.
--   · v_lesiones_excel_v1 usa esa cuenta en "Horas Passadas e/ Imagem e
--     Lesão". Lo que se escribía a mano antes queda para las lesiones sin
--     hora de la imagen. El resto de la vista queda igual (mismas columnas,
--     en el mismo orden, para Power Query).
--
-- Requiere 20261002b_datos_basicos.sql. Se corre en Supabase > SQL Editor,
-- entero y de una vez. Se puede volver a correr.
-- =====================================================================

begin;

-- Sin Datos básicos la vista no tiene la posición del jugador: se frena con un aviso claro.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'jugadores' and column_name = 'posicion'
  ) then
    raise exception 'Primero hay que correr 20261002b_datos_basicos.sql.';
  end if;
end $$;

create or replace function public.lesiones_horas_imagen(p_hora text, p_desde date)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
begin
  -- Año desde 1900 y hora hasta 23:59, como la app.
  if p_hora is null or p_desde is null or p_hora !~ '^(19|20)\d{2}-\d{2}-\d{2}[T ]([01]\d|2[0-3]):[0-5]\d' then
    return null;
  end if;
  -- floor(x + 0,5): redondea igual que la app, también las negativas.
  return floor(extract(epoch from (left(replace(p_hora, 'T', ' '), 16)::timestamp - p_desde::timestamp)) / 3600 + 0.5)::integer;
exception when others then
  -- Una fecha imposible (como un 30 de febrero) no rompe la vista: queda vacío.
  return null;
end;
$$;

revoke execute on function public.lesiones_horas_imagen(text, date) from public, anon;
grant execute on function public.lesiones_horas_imagen(text, date) to authenticated;

drop view if exists public.v_lesiones_excel_v1;

create view public.v_lesiones_excel_v1
with (security_invoker = true)
as
with base as (
  select l.*,
         j.nombre as jugador_nombre,
         j.categoria as jugador_categoria,
         j.fecha_nacimiento,
         j.pie_dominante,
         j.posicion as jugador_posicion,
         e.nombre as clube,
         row_number() over (partition by l.equipo_id, l.jugador_id order by l.numero_caso, l.fecha_lesion) as n_registro
    from public.lesiones l
    join public.jugadores j on j.id = l.jugador_id
    join public.equipos e on e.id = l.equipo_id
),
calc as (
  select a.*,
         (a.fecha_alta - a.fecha_lesion) as dias_recuperacao,
         exists (
           select 1 from base p
            where p.equipo_id = a.equipo_id and p.jugador_id = a.jugador_id and p.id <> a.id
              and p.fecha_lesion < a.fecha_lesion
              and coalesce(p.datos->>'parte_cuerpo', '') = coalesce(a.datos->>'parte_cuerpo', '')
              and coalesce(p.datos->>'lado', '') = coalesce(a.datos->>'lado', '')
              and coalesce(p.datos->>'musculo', '') = coalesce(a.datos->>'musculo', '')
              and (a.fecha_lesion - coalesce(p.fecha_alta, current_date)) <= 60
         ) as recorrente,
         exists (
           select 1 from base p
            where p.equipo_id = a.equipo_id and p.jugador_id = a.jugador_id and p.id <> a.id
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
       case when c.fecha_nacimiento is null then null
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
                case when c.datos->>'horas_imagen' ~ '^-?\d+([.,]\d+)?$'
                     then replace(c.datos->>'horas_imagen', ',', '.')::numeric end) as horas_passadas_imagem_lesao,
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
       (c.fecha_transicion - c.fecha_lesion) as recup_1,
       c.fecha_retorno_entrenamiento as retorno_a_data_de_treinamento,
       (c.fecha_retorno_entrenamiento - c.fecha_lesion) as recup_2,
       c.fecha_alta as retorno_a_data_da_competicao,
       (coalesce(c.fecha_alta, current_date) - c.fecha_lesion) as recuperacao,
       case when c.fecha_alta is null then null
            when c.dias_recuperacao <= 0 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'registro')
            when c.dias_recuperacao <= 4 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'leve')
            when c.dias_recuperacao <= 7 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'menor')
            when c.dias_recuperacao <= 28 then public.lesiones_etiqueta(c.equipo_id, 'severidad', 'moderado')
            else public.lesiones_etiqueta(c.equipo_id, 'severidad', 'mayor') end as severidade,
       public.lesiones_etiqueta(c.equipo_id, 'recurrencia', case when c.recorrente then 'sim' else 'nao' end) as recorrencia,
       public.lesiones_etiqueta(c.equipo_id, 'recidiva', case when c.recidivante then 'sim' else 'nao' end) as recidiva,
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

-- 20261002b se niega a correr si existe lesiones_horas_imagen (volvería a
-- las horas escritas a mano).
comment on view public.v_lesiones_excel_v1 is 'Las 35 columnas del Excel de lesiones para Power Query (horas hasta la imagen calculadas: 20261006).';

commit;

select public.lesiones_horas_imagen('2026-09-02T10:30', date '2026-09-01') as deberia_dar_35;
select count(*) as filas_vista from public.v_lesiones_excel_v1;
