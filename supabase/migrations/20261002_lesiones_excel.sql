-- =====================================================================
-- Lesiones, segunda vuelta: la base pasa a tener las mismas columnas que el
-- Excel original ("3.D BD Antecedentes de Lesiones"), con cabeceras y
-- listas editables por club desde la app.
--
--   · jugadores: suma n° de registro, categoría, fecha de nacimiento y pie
--     dominante (los datos del jugador que el Excel repite en cada fila).
--   · lesiones: se vuelve a crear. Las fechas van en columnas propias
--     (inicio, transición, retorno al entrenamiento, retorno a la
--     competencia = alta) y el resto de las columnas del Excel en `datos`
--     (jsonb), por clave de campo. Los desplegables guardan el código de la
--     opción; el texto vive en lesiones_opciones.
--   · lesiones_campos: el nombre de cada cabecera por club (es y pt) y si se
--     muestra. lesiones_opciones: las opciones de cada desplegable por club.
--     La app las siembra con los valores del Excel la primera vez.
--   · lesiones_historial: cada cambio, por disparador.
--   · v_lesiones_excel_v1: las 35 columnas del Excel, con los textos en
--     portugués, para leer desde Power Query.
--
-- ATENCIÓN: borra la tabla lesiones anterior (y las lesiones de prueba que
-- tuviera). Requiere 20261001_lesiones.sql. Se corre en Supabase > SQL
-- Editor, entero y de una vez. Es una sola transacción. Después de
-- 20261013_seguridad.sql se frena sola (borraría todas las lesiones).
-- =====================================================================

begin;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'lesiones_historial' and column_name = 'equipo_id') then
    raise exception 'Ya está corrida 20261013_seguridad.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

-- ---------------------------------------------------- Datos del jugador --

alter table public.jugadores
  add column if not exists numero_registro text,
  add column if not exists categoria text,
  add column if not exists fecha_nacimiento date,
  add column if not exists pie_dominante text;

comment on column public.jugadores.numero_registro is 'N° de registro del jugador en el club (Excel: N° de Registro).';
comment on column public.jugadores.categoria is 'Código de la lista categoria de Lesiones (profissional, sub20…).';
comment on column public.jugadores.pie_dominante is 'Código de la lista pie_dominante de Lesiones (direito, esquerdo, ambos).';

-- ---------------------------------------------------- La tabla, de nuevo --

drop view if exists public.v_lesiones_excel_v1;
drop view if exists public.v_lesiones;
drop table if exists public.lesiones_historial;
drop table if exists public.lesiones cascade;

create extension if not exists btree_gist with schema extensions;

create table public.lesiones (
  id              uuid primary key default gen_random_uuid(),
  equipo_id       uuid not null references public.equipos (id) on delete restrict,
  jugador_id      bigint not null references public.jugadores (id) on delete restrict,
  numero_caso     integer,
  fecha_lesion    date not null,
  fecha_transicion date,
  fecha_retorno_entrenamiento date,
  fecha_alta      date,
  datos           jsonb not null default '{}'::jsonb,
  creado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_por uuid references auth.users (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  constraint lesiones_fechas_en_orden check (
    (fecha_transicion is null or fecha_transicion >= fecha_lesion)
    and (fecha_retorno_entrenamiento is null or fecha_retorno_entrenamiento >= fecha_lesion)
    and (fecha_alta is null or fecha_alta >= fecha_lesion)),
  constraint lesiones_sin_futuro check (
    fecha_lesion <= current_date
    and (fecha_transicion is null or fecha_transicion <= current_date)
    and (fecha_retorno_entrenamiento is null or fecha_retorno_entrenamiento <= current_date)
    and (fecha_alta is null or fecha_alta <= current_date)),
  constraint lesiones_numero_caso_unico unique (equipo_id, numero_caso),
  -- La misma parte del cuerpo y lado del mismo jugador no puede estar
  -- lesionada dos veces a la vez. Rango [inicio, alta); sin alta, abierto.
  constraint lesiones_sin_solapar exclude using gist (
    jugador_id with =,
    (datos->>'parte_cuerpo') with =,
    (datos->>'lado') with =,
    daterange(fecha_lesion, fecha_alta, '[)') with &&
  )
);

comment on table public.lesiones is
  'Una fila por lesión, con las columnas del Excel original. fecha_alta = retorno a la competencia; vacía, la lesión sigue activa.';
comment on column public.lesiones.numero_caso is 'Correlativo por club (Excel: N° de Caso). Lo pone un disparador.';
comment on column public.lesiones.datos is
  'El resto de las columnas del Excel, por clave de campo (ver lesiones_campos). Los desplegables guardan el código de la opción.';

create index lesiones_por_equipo on public.lesiones (equipo_id, fecha_lesion desc);
create index lesiones_por_jugador on public.lesiones (jugador_id, fecha_lesion desc);
create index lesiones_activas on public.lesiones (equipo_id) where fecha_alta is null;

-- N° de caso: el siguiente del club.
create or replace function public.lesiones_numerar_caso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.numero_caso is null then
    select coalesce(max(l.numero_caso), 0) + 1 into new.numero_caso
      from public.lesiones l
     where l.equipo_id = new.equipo_id;
  end if;
  return new;
end;
$$;

create trigger lesiones_numerar_caso
  before insert on public.lesiones
  for each row execute function public.lesiones_numerar_caso();

create or replace function public.lesiones_anotar_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger lesiones_anotar_cambio
  before update on public.lesiones
  for each row execute function public.lesiones_anotar_cambio();

-- ------------------------------------------- Cabeceras y listas por club --

create table if not exists public.lesiones_campos (
  equipo_id   uuid not null references public.equipos (id) on delete cascade,
  campo       text not null,
  etiqueta_es text not null default '',
  etiqueta_pt text not null default '',
  oculto      boolean not null default false,
  orden       integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (equipo_id, campo)
);

comment on table public.lesiones_campos is
  'Cómo se llama cada columna del Excel en este club (en español y portugués) y si se muestra.';

create table if not exists public.lesiones_opciones (
  equipo_id   uuid not null references public.equipos (id) on delete cascade,
  campo       text not null,
  codigo      text not null,
  etiqueta_es text not null default '',
  etiqueta_pt text not null default '',
  oculto      boolean not null default false,
  orden       integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (equipo_id, campo, codigo)
);

comment on table public.lesiones_opciones is
  'Las opciones de cada desplegable de Lesiones en este club. Las lesiones guardan el código; acá está el texto.';

-- El texto de una opción, para las vistas. Si no está, devuelve el código.
create or replace function public.lesiones_etiqueta(p_equipo uuid, p_campo text, p_codigo text, p_idioma text default 'pt')
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select case when p_idioma = 'es' then nullif(o.etiqueta_es, '') else nullif(o.etiqueta_pt, '') end
       from public.lesiones_opciones o
      where o.equipo_id = p_equipo and o.campo = p_campo and o.codigo = p_codigo
      limit 1),
    p_codigo);
$$;

-- ------------------------------------------------------------ Historial --

create table public.lesiones_historial (
  id          bigint generated always as identity primary key,
  lesion_id   uuid not null,
  accion      text not null check (accion in ('creada', 'editada', 'borrada')),
  quien       uuid,
  quien_email text not null default '',
  cuando      timestamptz not null default now(),
  antes       jsonb,
  despues     jsonb
);

create index lesiones_historial_por_lesion on public.lesiones_historial (lesion_id, cuando desc);

create or replace function public.lesiones_historial_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  correo text := coalesce((select p.email from public.perfiles p where p.user_id = auth.uid()), '');
begin
  if tg_op = 'INSERT' then
    insert into public.lesiones_historial (lesion_id, accion, quien, quien_email, despues)
    values (new.id, 'creada', auth.uid(), correo, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.lesiones_historial (lesion_id, accion, quien, quien_email, antes, despues)
    values (new.id, 'editada', auth.uid(), correo, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.lesiones_historial (lesion_id, accion, quien, quien_email, antes)
    values (old.id, 'borrada', auth.uid(), correo, to_jsonb(old));
    return old;
  end if;
end;
$$;

create trigger lesiones_historial_anotar
  after insert or update or delete on public.lesiones
  for each row execute function public.lesiones_historial_anotar();

-- ------------------------------------------------------------ Permisos --

alter table public.lesiones enable row level security;
alter table public.lesiones_historial enable row level security;
alter table public.lesiones_campos enable row level security;
alter table public.lesiones_opciones enable row level security;

revoke all on table public.lesiones, public.lesiones_historial, public.lesiones_campos, public.lesiones_opciones from anon, authenticated;
grant select, insert, update, delete on table public.lesiones, public.lesiones_campos, public.lesiones_opciones to authenticated;
grant select on table public.lesiones_historial to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function public.lesiones_etiqueta(uuid, text, text, text) from public, anon;
grant execute on function public.lesiones_etiqueta(uuid, text, text, text) to authenticated;

create policy lesiones_acceso_app on public.lesiones
  for all to authenticated
  using ((select public.puede_usar('lesiones')))
  with check ((select public.puede_usar('lesiones')));

create policy lesiones_historial_leer on public.lesiones_historial
  for select to authenticated
  using ((select public.puede_usar('lesiones')));

drop policy if exists lesiones_campos_acceso_app on public.lesiones_campos;
create policy lesiones_campos_acceso_app on public.lesiones_campos
  for all to authenticated
  using ((select public.puede_usar('lesiones')))
  with check ((select public.puede_usar('lesiones')));

drop policy if exists lesiones_opciones_acceso_app on public.lesiones_opciones;
create policy lesiones_opciones_acceso_app on public.lesiones_opciones
  for all to authenticated
  using ((select public.puede_usar('lesiones')))
  with check ((select public.puede_usar('lesiones')));

-- ------------------------------------------------------------ Vistas --

-- La tabla con el jugador, el club y los días calculados (como el Excel):
-- recup_1 = transición − inicio; recup_2 = retorno al entrenamiento −
-- (transición o inicio); recuperacion = retorno a la competencia − inicio.
create or replace view public.v_lesiones
with (security_invoker = true)
as
select l.*,
       j.nombre as jugador,
       e.nombre as equipo,
       (l.fecha_transicion - l.fecha_lesion) as recup_1,
       (l.fecha_retorno_entrenamiento - coalesce(l.fecha_transicion, l.fecha_lesion)) as recup_2,
       (l.fecha_alta - l.fecha_lesion) as recuperacion,
       (coalesce(l.fecha_alta, current_date) - l.fecha_lesion) as dias_baja,
       (l.fecha_alta is null) as activa,
       case
         when l.fecha_alta is not null then 'alta'
         when l.fecha_retorno_entrenamiento is not null then 'entrenando'
         when l.fecha_transicion is not null then 'transicion'
         else 'lesionado'
       end as etapa
  from public.lesiones l
  join public.jugadores j on j.id = l.jugador_id
  join public.equipos e on e.id = l.equipo_id;

-- Para Excel (Power Query): las 35 columnas del Excel original, en su
-- orden, con los textos en portugués. Si algún día cambia la forma, se crea
-- v_lesiones_excel_v2 y la v1 sigue igual.
create or replace view public.v_lesiones_excel_v1
with (security_invoker = true)
as
select l.numero_caso as n_de_caso,
       j.numero_registro as n_de_registro,
       j.nombre as nome_e_sobrenome,
       public.lesiones_etiqueta(l.equipo_id, 'categoria', coalesce(l.datos->>'categoria', j.categoria)) as categoria,
       j.fecha_nacimiento as d_nac,
       public.lesiones_etiqueta(l.equipo_id, 'pie_dominante', j.pie_dominante) as p_dominante,
       array_to_string(j.puestos, '/') as posicao,
       case when j.fecha_nacimiento is null then null
            else extract(year from age(l.fecha_lesion, j.fecha_nacimiento))::int end as idade,
       public.lesiones_etiqueta(l.equipo_id, 'tipo_lesion', l.datos->>'tipo_lesion') as tipo_de_lesao,
       public.lesiones_etiqueta(l.equipo_id, 'parte_cuerpo', l.datos->>'parte_cuerpo') as parte_do_corpo_lesionada,
       public.lesiones_etiqueta(l.equipo_id, 'lado', l.datos->>'lado') as lado,
       l.datos->>'hora_imagen' as hora_da_imagem,
       public.lesiones_etiqueta(l.equipo_id, 'imagenes', l.datos->>'imagenes') as imagens,
       case when (l.datos->>'hora_imagen') is null or (l.datos->>'hora_imagen') = '' then null
            else round(extract(epoch from ((l.datos->>'hora_imagen')::timestamp - l.fecha_lesion::timestamp)) / 3600)::int end
         as horas_passadas_imagem_lesao,
       public.lesiones_etiqueta(l.equipo_id, 'ligamento', l.datos->>'ligamento') as lig_especifico,
       public.lesiones_etiqueta(l.equipo_id, 'musculo', l.datos->>'musculo') as musculo_afetado,
       public.lesiones_etiqueta(l.equipo_id, 'musculo_especifico', l.datos->>'musculo_especifico') as musculo_especifico,
       public.lesiones_etiqueta(l.equipo_id, 'area', l.datos->>'area') as area,
       public.lesiones_etiqueta(l.equipo_id, 'producto', l.datos->>'producto') as produto,
       public.lesiones_etiqueta(l.equipo_id, 'mecanismo', l.datos->>'mecanismo') as mecanismo,
       public.lesiones_etiqueta(l.equipo_id, 'cuando', l.datos->>'cuando') as quando,
       public.lesiones_etiqueta(l.equipo_id, 'localizacion', l.datos->>'localizacion') as localizacao,
       l.fecha_lesion as data_de_inicio_da_lesao,
       l.fecha_transicion as passagem_para_o_transicao,
       (l.fecha_transicion - l.fecha_lesion) as recup_1,
       l.fecha_retorno_entrenamiento as retorno_a_data_de_treinamento,
       (l.fecha_retorno_entrenamiento - coalesce(l.fecha_transicion, l.fecha_lesion)) as recup_2,
       l.fecha_alta as retorno_a_data_da_competicao,
       (l.fecha_alta - l.fecha_lesion) as recuperacao,
       public.lesiones_etiqueta(l.equipo_id, 'severidad', l.datos->>'severidad') as severidade,
       public.lesiones_etiqueta(l.equipo_id, 'recurrencia', l.datos->>'recurrencia') as recorrencia,
       public.lesiones_etiqueta(l.equipo_id, 'recidiva', l.datos->>'recidiva') as recidiva,
       l.datos->>'diagnostico' as diagnostico,
       l.datos->>'comentarios' as comentarios_adicionais,
       l.datos->>'medico' as medico,
       e.nombre as clube,
       l.id as lesao_id
  from public.lesiones l
  join public.jugadores j on j.id = l.jugador_id
  join public.equipos e on e.id = l.equipo_id
 order by l.equipo_id, l.numero_caso;

revoke all on public.v_lesiones, public.v_lesiones_excel_v1 from anon;
grant select on public.v_lesiones, public.v_lesiones_excel_v1 to authenticated;

commit;

-- Lo que quedó: columnas nuevas en jugadores, tablas de Lesiones vacías.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'jugadores'
   and column_name in ('numero_registro', 'categoria', 'fecha_nacimiento', 'pie_dominante');
select (select count(*) from public.lesiones) as lesiones,
       (select count(*) from public.lesiones_campos) as cabeceras,
       (select count(*) from public.lesiones_opciones) as opciones;
