-- =====================================================================
-- Todas las lesiones de una base se pueden cargar (pedido de Santiago del
-- 03/10, al pegar el Excel):
--
--   · Sin fecha de inicio: en el Excel hay casos sin terminar de cargar.
--     Se guardan y quedan "sin fecha de inicio" hasta que se complete; no
--     cuentan como activas, ni en días perdidos, ni en los reportes.
--   · De alguien que no está en Datos básicos: la lesión se guarda con ese
--     nombre (persona) y el nombre NO se agrega a Datos básicos. Una lesión
--     es de un jugador (jugador_id) o de una persona (persona), nunca de los
--     dos ni de ninguno.
--   · La misma lesión no se carga dos veces tampoco para una persona (mismo
--     nombre, parte, lado y fecha de inicio).
--   · v_lesiones_excel_v1 (Power Query) muestra también estas lesiones: el
--     nombre de la persona va en "Nome e Sobrenome" y lo que sale de Datos
--     básicos (categoría, nacimiento, pie, posición) queda vacío.
--
-- Requiere 20261008_lesiones_recaida.sql. Se corre en Supabase > SQL Editor,
-- entero y de una vez. Se puede volver a correr.
-- =====================================================================

begin;

-- Con la regla vieja (lesiones_sin_solapar), una lesión sin fecha chocaría
-- con todas las de esa parte y lado del jugador: primero va 20261008.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'lesiones_sin_solapar' and conrelid = 'public.lesiones'::regclass)
     or to_regclass('public.lesiones_sin_repetir') is null then
    raise exception 'Primero hay que correr 20261008_lesiones_recaida.sql.';
  end if;
end $$;

alter table public.lesiones add column if not exists persona text;
alter table public.lesiones alter column jugador_id drop not null;
alter table public.lesiones alter column fecha_lesion drop not null;

-- De un jugador o de una persona: uno de los dos, nunca los dos.
alter table public.lesiones drop constraint if exists lesiones_de_quien;
alter table public.lesiones
  add constraint lesiones_de_quien check (
    (jugador_id is null) = (persona is not null)
    and (persona is null or length(btrim(persona)) between 1 and 120));

create unique index if not exists lesiones_sin_repetir_persona
  on public.lesiones (equipo_id, lower(btrim(persona)), (datos->>'parte_cuerpo'), (datos->>'lado'), fecha_lesion)
  where jugador_id is null;

comment on column public.lesiones.persona is
  'El nombre de quien se lesionó cuando no está en Datos básicos (vino en una base pegada). Sin jugador_id. El nombre no se agrega a Datos básicos.';
comment on column public.lesiones.fecha_lesion is
  'Fecha de inicio. Vacía: un caso sin terminar de cargar; no cuenta como activa ni en los reportes hasta que se complete.';

-- La vista general de lesiones (20261002), también con las de personas
-- fuera de Datos básicos; una sin fecha de inicio no está activa.
drop view if exists public.v_lesiones;

create view public.v_lesiones
with (security_invoker = true)
as
select l.*,
       coalesce(j.nombre, l.persona) as jugador,
       e.nombre as equipo,
       (l.fecha_transicion - l.fecha_lesion) as recup_1,
       (l.fecha_retorno_entrenamiento - coalesce(l.fecha_transicion, l.fecha_lesion)) as recup_2,
       (l.fecha_alta - l.fecha_lesion) as recuperacion,
       (coalesce(l.fecha_alta, current_date) - l.fecha_lesion) as dias_baja,
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

-- La vista para Power Query, con las lesiones de personas fuera de Datos
-- básicos y las que no tienen fecha (mismas columnas, en el mismo orden).
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
       (c.fecha_transicion - c.fecha_lesion) as recup_1,
       c.fecha_retorno_entrenamiento as retorno_a_data_de_treinamento,
       (c.fecha_retorno_entrenamiento - c.fecha_lesion) as recup_2,
       c.fecha_alta as retorno_a_data_da_competicao,
       (coalesce(c.fecha_alta, current_date) - c.fecha_lesion) as recuperacao,
       case when c.fecha_alta is null or c.fecha_lesion is null then null
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

comment on view public.v_lesiones_excel_v1 is 'Las 35 columnas del Excel de lesiones para Power Query (horas hasta la imagen calculadas: 20261006; con las lesiones sin fecha y las de personas fuera de Datos básicos: 20261010).';

commit;

-- Que la app vea la columna nueva sin esperar.
notify pgrst, 'reload schema';
