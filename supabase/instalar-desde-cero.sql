-- Instalación desde cero de la base que usa la app.
--
-- Para montar una instalación nueva —por ejemplo, la de otra persona con otro
-- equipo— en un proyecto de Supabase vacío, en una sola pegada. Reemplaza a
-- correr las migraciones de supabase/migrations/ en orden.
--
-- Se puede correr sobre una base que ya tenga algo: todo es "if not exists" y
-- las políticas se vuelven a crear. No borra ni pisa datos.
--
-- Cómo usarlo:
--   1. Crear el proyecto en Supabase.
--   2. Pegar todo esto en el SQL Editor y darle Run.
--   3. Publicar la app con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
--      apuntando a ese proyecto.
--   4. En la app: Ajustes › Equipo para poner el club, y Ajustes › Jugadores
--      para cargar el plantel.
--
-- Sobre los tipos: las horas se guardan como texto y no como `time` porque la
-- app manda "" cuando un horario todavía no se cargó, y un `time` lo
-- rechazaría. Por lo mismo la fecha es texto.

begin;

-- ---------------------------------------------------------------- Partidos --

create table if not exists public.registros_partido (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  fecha text not null default '',
  rival text not null default '',
  resultado text not null default '',

  -- Cómo se anotó el partido: con la hora del reloj ("enVivo") o con el
  -- minuto de una transmisión ("transmision").
  modo_tiempo text not null default 'enVivo',
  -- La guía en minutos con la que se anotó, cuando fue por transmisión. Sin
  -- esto se pierde el período de cada cambio al releer el partido.
  captura_tiempo jsonb not null default '{}'::jsonb,

  -- Tiempos
  inicio_pt text not null default '',
  final_pt text not null default '',
  tiempo_pt text not null default '',
  inicio_st text not null default '',
  final_st text not null default '',
  tiempo_st text not null default '',

  -- Hasta tres VAR por tiempo
  inicio_var_pt_1 text not null default '',
  final_var_pt_1 text not null default '',
  inicio_var_pt_2 text not null default '',
  final_var_pt_2 text not null default '',
  inicio_var_pt_3 text not null default '',
  final_var_pt_3 text not null default '',
  inicio_var_st_1 text not null default '',
  final_var_st_1 text not null default '',
  inicio_var_st_2 text not null default '',
  final_var_st_2 text not null default '',
  inicio_var_st_3 text not null default '',
  final_var_st_3 text not null default '',

  -- Hidratación
  inicio_hid_pt text not null default '',
  final_hid_pt text not null default '',
  inicio_hid_st text not null default '',
  final_hid_st text not null default '',

  -- Los cinco cambios nuestros de siempre; del sexto en adelante van en
  -- cambios_extra, que es lo que permite la prórroga.
  cambio_1_sale text not null default '',
  cambio_1_entra text not null default '',
  cambio_1_tiempo text not null default '',
  cambio_2_sale text not null default '',
  cambio_2_entra text not null default '',
  cambio_2_tiempo text not null default '',
  cambio_3_sale text not null default '',
  cambio_3_entra text not null default '',
  cambio_3_tiempo text not null default '',
  cambio_4_sale text not null default '',
  cambio_4_entra text not null default '',
  cambio_4_tiempo text not null default '',
  cambio_5_sale text not null default '',
  cambio_5_entra text not null default '',
  cambio_5_tiempo text not null default '',

  -- Y los cinco del rival
  rival_cambio_sale1 text not null default '',
  rival_cambio_entra1 text not null default '',
  rival_cambio_horario1 text not null default '',
  rival_cambio_sale2 text not null default '',
  rival_cambio_entra2 text not null default '',
  rival_cambio_horario2 text not null default '',
  rival_cambio_sale3 text not null default '',
  rival_cambio_entra3 text not null default '',
  rival_cambio_horario3 text not null default '',
  rival_cambio_sale4 text not null default '',
  rival_cambio_entra4 text not null default '',
  rival_cambio_horario4 text not null default '',
  rival_cambio_sale5 text not null default '',
  rival_cambio_entra5 text not null default '',
  rival_cambio_horario5 text not null default '',

  -- Los dos tiempos suplementarios, con sus VAR e hidratación adentro.
  prorroga jsonb not null default '{}'::jsonb,
  cambios_extra jsonb not null default '[]'::jsonb,
  cambios_rival_extra jsonb not null default '[]'::jsonb,

  -- La formación
  titulares text[] not null default '{}',
  convocados text[] not null default '{}',
  -- Quién ocupa cada puesto de la cancha y dónde quedó si se movió a mano.
  formacion_cancha jsonb
);

-- ------------------------------------------------------------------ Plantel --

create table if not exists public.jugadores (
  id bigint generated always as identity primary key,
  nombre text not null,
  -- Varios por jugador: uno puede ser defensa y mediocampo a la vez.
  roles text[] not null default '{}',
  -- Hasta cuatro, guardados como sigla. El nombre largo vive en la app.
  puestos text[] not null default '{}',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Dos jugadores con el mismo nombre serían dos entradas idénticas en cada
-- desplegable. Se compara sin distinguir mayúsculas ni espacios de más.
create unique index if not exists jugadores_nombre_unico
  on public.jugadores (lower(btrim(nombre)));

-- ------------------------------------------------------------------ Ajustes --

create table if not exists public.ajustes (
  clave text primary key,
  valor text not null default '',
  actualizado_en timestamptz not null default now()
);

-- El equipo propio se cambia después desde Ajustes › Equipo.
insert into public.ajustes (clave, valor)
values ('equipo_propio', 'Atlético Mineiro')
on conflict (clave) do nothing;

-- ------------------------------------------------------ Acceso de la app --
--
-- La app se conecta con la clave pública y sin sesión: el rol es anon. Si no
-- se le dan permisos explícitos, RLS la deja sin ver nada y la app queda muda,
-- que es lo que pasó en septiembre.

alter table public.registros_partido enable row level security;
alter table public.jugadores enable row level security;
alter table public.ajustes enable row level security;

grant select, insert, update, delete
  on table public.registros_partido, public.jugadores, public.ajustes
  to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists registros_acceso_app on public.registros_partido;
create policy registros_acceso_app
  on public.registros_partido
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists jugadores_acceso_app on public.jugadores;
create policy jugadores_acceso_app
  on public.jugadores
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists ajustes_acceso_app on public.ajustes;
create policy ajustes_acceso_app
  on public.ajustes
  for all to anon, authenticated
  using (true) with check (true);

commit;

-- --------------------------------------------------------------- Revisión --
--
-- Esto no cambia nada: se corre aparte para ver que quedó todo. Tienen que
-- salir tres tablas, sus tres políticas y doce permisos por rol.

select 'tabla' as revision, table_name as detalle
from information_schema.tables
where table_schema = 'public'
  and table_name in ('registros_partido', 'jugadores', 'ajustes')

union all

select 'politica', tablename || ' → ' || policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('registros_partido', 'jugadores', 'ajustes')

union all

select 'permisos de ' || grantee, table_name || ': ' || count(*) || ' de 4'
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('registros_partido', 'jugadores', 'ajustes')
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
group by grantee, table_name

union all

select 'equipo', clave || ' = ' || valor
from public.ajustes
where clave = 'equipo_propio'

order by 1, 2;
