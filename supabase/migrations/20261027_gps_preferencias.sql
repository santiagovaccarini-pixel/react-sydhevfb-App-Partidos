-- =====================================================================
-- GPS: lo que recuerda cada cuenta (nota del 17/10: «Recordar el ultimo
-- dispositivo seleccionado cuando se copia para pegar en la base gps al
-- igual que en la carga de un csv»; Santiago, en un cuestionario: «En mi
-- cuenta»).
--
--   · gps_preferencias: una fila por cuenta y club, con el último
--     dispositivo que eligió al pegar desde Excel (dispositivo_pegar) y al
--     cargar un CSV (dispositivo_csv). Cada lugar recuerda el suyo. Sin fila,
--     se elige a mano, como antes.
--   · Cada cuenta ve y cambia solo lo suyo, en los clubes donde tiene GPS y
--     sigue (clubes_donde_puedo, como la tabla gps). Quien ya se fue no
--     carga, así que no lo necesita. Anon, nada.
--   · La cuenta y el club los pone la base: la cuenta, la de quien guarda;
--     el club no cambia después.
--
-- Requiere 20261019_gps_rapido.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.gps') is null or to_regprocedure('public.clubes_donde_puedo(text)') is null then
    raise exception 'Primero hay que correr 20261019_gps_rapido.sql.';
  end if;
end $$;

create table if not exists public.gps_preferencias (
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  equipo_id         uuid not null references public.equipos (id) on delete cascade,
  dispositivo_pegar text,
  dispositivo_csv   text,
  actualizado_en    timestamptz not null default now(),
  primary key (user_id, equipo_id),
  constraint gps_preferencias_dispositivos check (char_length(coalesce(dispositivo_pegar, '')) <= 80 and char_length(coalesce(dispositivo_csv, '')) <= 80)
);

comment on table public.gps_preferencias is
  'Lo que recuerda cada cuenta en GPS de un club: el último dispositivo elegido al pegar desde Excel y al cargar un CSV.';

-- La cuenta, la de quien guarda; el club no cambia; la fecha la pone la base.
create or replace function public.gps_preferencias_preparar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  else
    new.user_id := old.user_id;
    new.equipo_id := old.equipo_id;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;
revoke execute on function public.gps_preferencias_preparar() from public, anon, authenticated;

drop trigger if exists gps_preferencias_preparar on public.gps_preferencias;
create trigger gps_preferencias_preparar
  before insert or update on public.gps_preferencias
  for each row execute function public.gps_preferencias_preparar();

-- Permisos justos: nada para anon; las cuentas leen, agregan y cambian lo
-- suyo (la app guarda con upsert: el club va también en lo que se cambia,
-- pero el disparador lo deja como estaba). No se borra desde la app.
alter table public.gps_preferencias enable row level security;
revoke all on table public.gps_preferencias from public, anon, authenticated;
grant select on table public.gps_preferencias to authenticated;
grant insert (equipo_id, dispositivo_pegar, dispositivo_csv) on table public.gps_preferencias to authenticated;
grant update (equipo_id, dispositivo_pegar, dispositivo_csv) on table public.gps_preferencias to authenticated;

drop policy if exists gps_preferencias_ver on public.gps_preferencias;
create policy gps_preferencias_ver on public.gps_preferencias
  for select to authenticated
  using (user_id = auth.uid() and equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_preferencias_crear on public.gps_preferencias;
create policy gps_preferencias_crear on public.gps_preferencias
  for insert to authenticated
  with check (user_id = auth.uid() and equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_preferencias_cambiar on public.gps_preferencias;
create policy gps_preferencias_cambiar on public.gps_preferencias
  for update to authenticated
  using (user_id = auth.uid() and equipo_id in (select public.clubes_donde_puedo('gps')))
  with check (user_id = auth.uid() and equipo_id in (select public.clubes_donde_puedo('gps')));

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.gps_preferencias'::regclass) then
    raise exception 'gps_preferencias quedó sin RLS.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gps_preferencias') <> 3 then
    raise exception 'gps_preferencias no tiene sus tres políticas.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_preferencias')
     or exists (select 1 from information_schema.column_privileges
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public' and table_name = 'gps_preferencias') then
    raise exception 'anon no puede tener permisos en gps_preferencias.';
  end if;
end $$;

commit;

-- Que la app vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: la tabla, con sus políticas.
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public' and tablename = 'gps_preferencias'
 group by tablename;
