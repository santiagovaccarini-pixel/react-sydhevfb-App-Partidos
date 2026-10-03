-- =====================================================================
-- Los períodos guardados de "Lesiones c/1000h y días perdidos".
--
--   · lesiones_periodos: el nombre y las fechas de cada período que el
--     club guarda para compararlo después. En el Excel son las letras A a P
--     del contador de "Antecedentes BD" (se elige la fecha de inicio, la
--     final y un nombre, y se aprieta una letra), que llevan los números a
--     "Incidencias c 1000h" y a los gráficos de "Informes Graficos". Acá se
--     guardan solo el nombre y las fechas: los números se calculan cada vez
--     con lo cargado (lo decidió Santiago el 03/10), así un período no queda
--     viejo si después se corrige una lesión.
--   · Sin fecha de inicio, desde la primera lesión (como en el Excel, con
--     el inicio vacío).
--   · Los ve quien usa Lesiones en el club (también quien ya se fue, como
--     las cabeceras y las listas); los cambia quien puede editar.
--
-- Se corre en Supabase > SQL Editor, entero y de una vez. Se puede volver a
-- correr.
-- =====================================================================

begin;

create table if not exists public.lesiones_periodos (
  id         uuid primary key default gen_random_uuid(),
  equipo_id  uuid not null references public.equipos (id) on delete cascade,
  nombre     text not null,
  desde      date,
  hasta      date not null,
  creado_en  timestamptz not null default now(),
  constraint lesiones_periodos_nombre check (length(btrim(nombre)) between 1 and 80),
  constraint lesiones_periodos_fechas check (desde is null or desde <= hasta)
);

-- El mismo nombre no se repite en un club (sin importar mayúsculas ni
-- espacios de más): si no, en los gráficos no se distinguen.
create unique index if not exists lesiones_periodos_nombre_unico
  on public.lesiones_periodos (equipo_id, lower(btrim(nombre)));

comment on table public.lesiones_periodos is
  'Los períodos guardados de Lesiones c/1000h y días perdidos (Excel: las letras A a P del contador de Antecedentes BD). Solo nombre y fechas: los números se calculan cada vez.';

alter table public.lesiones_periodos enable row level security;
revoke all on table public.lesiones_periodos from anon, authenticated;
grant select, insert, update, delete on table public.lesiones_periodos to authenticated;

drop policy if exists lesiones_periodos_ver on public.lesiones_periodos;
create policy lesiones_periodos_ver on public.lesiones_periodos
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_ver(equipo_id));

drop policy if exists lesiones_periodos_cambiar on public.lesiones_periodos;
create policy lesiones_periodos_cambiar on public.lesiones_periodos
  for all to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id))
  with check (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

commit;
