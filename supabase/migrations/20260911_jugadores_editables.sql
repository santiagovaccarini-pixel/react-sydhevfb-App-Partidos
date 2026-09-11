-- Saca el plantel del código y lo pone en la base, para poder agregar o quitar
-- jugadores desde la app sin tocar un archivo.
--
-- Hasta ahora la lista vivía en src/jugadores.js, así que cambiarla pedía una
-- edición de código y un despliegue. Acá queda editable desde Ajustes.
--
-- Se guarda además dónde juega cada uno: los roles gruesos (Defensa,
-- Mediocampo, Ataque), varios por jugador, y hasta cuatro puestos concretos
-- (LAT, VM, DEL...). No hay arquero: la app trabaja con los diez de campo.

begin;

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

-- La app se conecta sin sesión: el rol es anon. Mismo criterio que
-- registros_partido, para no repetir el bloqueo de septiembre.
alter table public.jugadores enable row level security;

grant select, insert, update, delete on table public.jugadores to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists jugadores_acceso_app on public.jugadores;

create policy jugadores_acceso_app
  on public.jugadores
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- El plantel que hoy está en el código, para arrancar con lo mismo que había.
-- Los roles y puestos quedan vacíos: se cargan desde Ajustes.
insert into public.jugadores (nombre)
select nombre
from unnest(array[
  'A MINDA', 'A PRECIADO', 'ALAN FRANCO', 'ALEXSANDER', 'ALONSO',
  'BERNARD', 'CAUA SOARES', 'CISSE', 'CUELLO', 'DUDU',
  'I ROMAN', 'IGOR GOMES', 'INDIO', 'M ISEPPE', 'KAUA PASCINI',
  'LYANCO', 'M CASSIERRA', 'MAYCON', 'NATANAEL', 'PATRICK',
  'REINIER', 'RENAN LODI', 'RUAN', 'SCARPA', 'T PEREZ',
  'V HUGO', 'VICTOR', 'VITAO', 'LUIS GUSTAVO', 'VENENO',
  'GUTTE', 'THIAGO BORBAS', 'KEVIN CASTANO', 'FRED', 'LEMOS'
]) as nombre
on conflict do nothing;

-- Dónde se paró cada jugador en la cancha de ese partido. Va en el registro y
-- no en el jugador, porque cambia de partido a partido.
alter table public.registros_partido
  add column if not exists formacion_cancha jsonb;

commit;
