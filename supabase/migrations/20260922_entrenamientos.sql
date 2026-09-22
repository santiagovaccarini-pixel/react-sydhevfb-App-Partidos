-- Ejecutar una sola vez en Supabase > SQL Editor.
--
-- Entrenamientos registrados desde la app (módulo Entrenamiento): un día y un
-- nombre opcional, sus tareas con horarios, pausas y jugadores, y la sesión
-- de OpenField a la que se enviaron los cortes.
--
-- Una fila por entrenamiento. Las tareas van adentro (jsonb, en `datos`) y
-- unas columnas sueltas (fecha, nombre, estado, cantidad de tareas) sirven
-- para listar sin bajar las tareas de todos.
--
-- Se guarda desde cualquier aparato con la app abierta con usuario: lo que se
-- registra en el celular se puede enviar desde la computadora, y al revés.
-- Entre dos aparatos gana el último que guardó (`actualizado_en`).

begin;

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

comment on table public.entrenamientos is
  'Entrenamientos registrados en la app: tareas, pausas, jugadores y la sesión de OpenField a la que se enviaron los cortes.';
comment on column public.entrenamientos.datos is
  'tareas, actividad, asignaciones (tarea → período de OpenField), ultimoEnvio y creadoEn, tal como los guarda la app.';
comment on column public.entrenamientos.estado is
  'vacio, en-curso, sin-enviar o enviado. Lo calcula la app al guardar; sirve para listar.';
comment on column public.entrenamientos.actualizado_por is
  'Correo del usuario de la app que guardó por última vez.';

create index if not exists entrenamientos_equipo_fecha
  on public.entrenamientos (equipo_id, fecha desc);

alter table public.entrenamientos enable row level security;

-- Entrenamiento solo se usa con usuario; el rol anon no lo necesita.
grant select, insert, update, delete on table public.entrenamientos to authenticated;

drop policy if exists entrenamientos_acceso_app on public.entrenamientos;

create policy entrenamientos_acceso_app
  on public.entrenamientos
  for all
  to authenticated
  using (true)
  with check (true);

commit;
