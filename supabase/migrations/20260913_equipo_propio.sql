-- El equipo propio deja de estar clavado en el código.
--
-- Hasta ahora la app decía "Atlético Mineiro" en todas las pantallas porque
-- estaba escrito adentro. Con esto el nombre se elige desde Ajustes, y el
-- escudo aparece solo: ya se busca por nombre contra la base de clubes.
--
-- Se guarda en la base y no solo en el teléfono para que viaje igual que el
-- plantel: si abrís la app en otro celular, el equipo es el mismo.

begin;

create table if not exists public.ajustes (
  clave text primary key,
  valor text not null default '',
  actualizado_en timestamptz not null default now()
);

alter table public.ajustes enable row level security;

-- La app se conecta sin sesión: el rol es anon, igual que en el resto.
grant select, insert, update, delete on table public.ajustes to anon, authenticated;

drop policy if exists ajustes_acceso_app on public.ajustes;

create policy ajustes_acceso_app
  on public.ajustes
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Arranca con lo que la app decía hasta ahora, para que nada cambie solo.
insert into public.ajustes (clave, valor)
values ('equipo_propio', 'Atlético Mineiro')
on conflict (clave) do nothing;

commit;
