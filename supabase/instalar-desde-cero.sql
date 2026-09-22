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

-- ----------------------------------------------------------------- Equipos --
--
-- En una misma base pueden convivir varios clubes: cada uno ve y borra solo
-- sus partidos y su plantel. Se filtra por este id y no por el nombre, así
-- corregir el nombre de un club no deja afuera lo que ya tenía cargado.

create table if not exists public.equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now()
);

create unique index if not exists equipos_nombre_unico
  on public.equipos (lower(btrim(nombre)));

-- A propósito no se crea ninguno: al abrir la app por primera vez, Ajustes ›
-- Equipo pide crear el propio. Es mejor eso que arrancar con un club ajeno
-- que hay que renombrar.

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
  formacion_cancha jsonb,

  -- De qué club es este partido.
  equipo_id uuid references public.equipos (id)
);

create index if not exists registros_por_equipo
  on public.registros_partido (equipo_id);

-- ------------------------------------------------------------------ Plantel --

create table if not exists public.jugadores (
  id bigint generated always as identity primary key,
  nombre text not null,
  -- Varios por jugador: uno puede ser defensa y mediocampo a la vez.
  roles text[] not null default '{}',
  -- Hasta cuatro, guardados como sigla. El nombre largo vive en la app.
  puestos text[] not null default '{}',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  equipo_id uuid references public.equipos (id)
);

-- Dos jugadores con el mismo nombre serían dos entradas idénticas en cada
-- desplegable. Se compara sin distinguir mayúsculas ni espacios de más, y es
-- por club: dos equipos pueden tener un Rodríguez.
create unique index if not exists jugadores_nombre_unico_por_equipo
  on public.jugadores (equipo_id, lower(btrim(nombre)));

create index if not exists jugadores_por_equipo
  on public.jugadores (equipo_id);

-- ------------------------------------------------------------------ Ajustes --

create table if not exists public.ajustes (
  clave text primary key,
  valor text not null default '',
  actualizado_en timestamptz not null default now()
);

-- Tabla suelta de clave/valor. Hoy la app no guarda nada acá: el equipo propio
-- pasó a la tabla equipos. Se deja porque una base migrada la tiene, y así las
-- dos quedan con la misma forma.

-- ----------------------------------------------------------- Entrenamientos --

create table if not exists public.entrenamientos (
  id uuid primary key,
  equipo_id uuid references public.equipos (id) on delete set null,
  fecha text not null default '',
  nombre text not null default '',
  actividad_id text not null default '',
  actividad_nombre text not null default '',
  estado text not null default 'vacio',
  tareas_cantidad integer not null default 0,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  actualizado_por text not null default ''
);

-- Entrenamientos registrados desde el módulo Entrenamiento: una fila por
-- entrenamiento, con las tareas adentro (datos) y unas columnas sueltas para
-- listar. Se guarda desde cualquier aparato con usuario; gana el último que
-- guardó. Ver supabase/migrations/20260922_entrenamientos.sql.

create index if not exists entrenamientos_equipo_fecha
  on public.entrenamientos (equipo_id, fecha desc);

-- ------------------------------------------------------ Acceso de la app --
--
-- La app se conecta con la clave pública y sin sesión: el rol es anon. Si no
-- se le dan permisos explícitos, RLS la deja sin ver nada y la app queda muda,
-- que es lo que pasó en septiembre.

alter table public.equipos enable row level security;
alter table public.registros_partido enable row level security;
alter table public.jugadores enable row level security;
alter table public.ajustes enable row level security;
alter table public.entrenamientos enable row level security;

grant select, insert, update, delete
  on table public.equipos, public.registros_partido, public.jugadores,
     public.ajustes
  to anon, authenticated;

-- Entrenamiento solo se usa con usuario; el rol anon no lo necesita.
grant select, insert, update, delete on table public.entrenamientos to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists equipos_acceso_app on public.equipos;
create policy equipos_acceso_app
  on public.equipos
  for all to anon, authenticated
  using (true) with check (true);

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

drop policy if exists entrenamientos_acceso_app on public.entrenamientos;
create policy entrenamientos_acceso_app
  on public.entrenamientos
  for all to authenticated
  using (true) with check (true);

commit;

-- --------------------------------------------------------------- Revisión --
--
-- Esto no cambia nada: se corre aparte para ver que quedó todo. Tienen que
-- salir cinco tablas y sus cinco políticas (entrenamientos solo para
-- authenticated).
-- La lista de equipos arranca vacía a propósito.

select 'tabla' as revision, table_name as detalle
from information_schema.tables
where table_schema = 'public'
  and table_name in ('equipos', 'registros_partido', 'jugadores', 'ajustes', 'entrenamientos')

union all

select 'politica', tablename || ' → ' || policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('equipos', 'registros_partido', 'jugadores', 'ajustes')

union all

select 'permisos de ' || grantee, table_name || ': ' || count(*) || ' de 4'
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('equipos', 'registros_partido', 'jugadores', 'ajustes', 'entrenamientos')
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
group by grantee, table_name

union all

select 'equipos cargados', count(*) || ' (se crea el propio desde la app)'
from public.equipos

order by 1, 2;
