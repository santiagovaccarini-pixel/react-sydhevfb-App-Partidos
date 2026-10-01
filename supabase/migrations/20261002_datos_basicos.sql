-- =====================================================================
-- Datos básicos y las columnas calculadas del Excel.
--
--   · jugadores: suma posición (lista de Lesiones) y el enlace de la foto,
--     como la hoja "Datos Básicos" del Excel (nombre, categoría, nacimiento,
--     pie dominante, posición, foto). numero_registro deja de usarse: en el
--     Excel "N° de Registro" es la enésima lesión del jugador, y se calcula.
--   · v_lesiones_excel_v1 pasa a calcular lo mismo que el Excel: n° de
--     registro, lado hábil lesionado, Recup 2 (retorno al entrenamiento menos
--     inicio), severidad (registro <1, leve 1-4, menor 5-7, moderado 8-28,
--     mayor 29+), recorrência (misma parte, lado y músculo del mismo jugador
--     con fin hace 60 días o menos), recidiva (misma estructura exacta del
--     mismo jugador con fin hace 30 días o menos) y diagnóstico (tipo +
--     ligamento o músculo específico + músculo o parte + área + lado).
--
-- Requiere 20261002_lesiones_excel.sql. Se corre en Supabase > SQL Editor,
-- entero y de una vez. Se puede volver a correr.
-- =====================================================================

begin;

alter table public.jugadores
  add column if not exists posicion text,
  add column if not exists foto_url text;

comment on column public.jugadores.posicion is 'Código de la lista posicion de Lesiones (goleiro, defensor_central…).';
comment on column public.jugadores.foto_url is 'Enlace a la foto del jugador (Excel: Links das fotos).';

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
       nullif(c.datos->>'horas_imagen', '')::numeric as horas_passadas_imagem_lesao,
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

commit;

select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'jugadores' and column_name in ('posicion', 'foto_url');
select count(*) as filas_vista from public.v_lesiones_excel_v1;
