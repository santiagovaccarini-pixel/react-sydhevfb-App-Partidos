-- Varios equipos en la misma base, cada uno viendo lo suyo.
--
-- Hasta ahora la base era de un solo equipo. Con esto un compañero puede
-- cargar los partidos de otro club acá mismo, y cada uno ve y borra solo los
-- propios.
--
-- Se filtra por un id fijo y no por el nombre escrito. Si se filtrara por el
-- nombre, corregir "Estudiantes" a "Estudiantes de La Plata" dejaría todos los
-- partidos anteriores fuera de la lista, sin borrarlos y sin que nada lo
-- explique. Con un id, renombrar sale gratis.
--
-- Esto ordena, no protege: cualquiera puede cambiarse de equipo desde Ajustes.
-- Para separar de verdad hacen falta dos bases o inicio de sesión.

begin;

create table if not exists public.equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now()
);

create unique index if not exists equipos_nombre_unico
  on public.equipos (lower(btrim(nombre)));

-- El equipo que ya venía usando la app, con el nombre que tenga puesto.
insert into public.equipos (nombre)
select coalesce(nullif(btrim(valor), ''), 'Atlético Mineiro')
from public.ajustes
where clave = 'equipo_propio'
on conflict do nothing;

-- Por si la tabla de ajustes no tenía la fila: igual tiene que quedar uno.
insert into public.equipos (nombre)
select 'Atlético Mineiro'
where not exists (select 1 from public.equipos)
on conflict do nothing;

alter table public.registros_partido
  add column if not exists equipo_id uuid references public.equipos (id);

alter table public.jugadores
  add column if not exists equipo_id uuid references public.equipos (id);

-- Todo lo que ya está guardado es del equipo que venía usando la app. Sin
-- esto, los partidos de siempre quedarían sin dueño y fuera de la lista.
update public.registros_partido
set equipo_id = (select id from public.equipos order by creado_en limit 1)
where equipo_id is null;

update public.jugadores
set equipo_id = (select id from public.equipos order by creado_en limit 1)
where equipo_id is null;

-- Los nombres del plantel se repiten entre equipos: dos clubes pueden tener un
-- Rodríguez. La unicidad pasa a ser por equipo.
drop index if exists public.jugadores_nombre_unico;

create unique index if not exists jugadores_nombre_unico_por_equipo
  on public.jugadores (equipo_id, lower(btrim(nombre)));

-- Se busca por equipo en cada pantalla.
create index if not exists registros_por_equipo
  on public.registros_partido (equipo_id);

create index if not exists jugadores_por_equipo
  on public.jugadores (equipo_id);

alter table public.equipos enable row level security;

grant select, insert, update, delete on table public.equipos to anon, authenticated;

drop policy if exists equipos_acceso_app on public.equipos;

create policy equipos_acceso_app
  on public.equipos
  for all
  to anon, authenticated
  using (true)
  with check (true);

commit;
