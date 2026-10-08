-- =====================================================================
-- Notas: las mejoras que se quieren hacer en la app, anotadas adentro de la
-- app (la tarjeta Notas del portal).
--
--   · Cada nota es de un club: la escribe y la ve la gente de ese club (la
--     que sigue en el club). Ningún otro club la ve.
--   · Cualquiera del club la marca como hecha o la vuelve a abrir. La corrige
--     o la borra quien la escribió; borrarla, también el administrador del
--     club.
--   · Quién la escribió y cuándo lo pone la base.
--
-- Requiere 20261013_seguridad.sql. Se corre en Supabase > SQL Editor, entero
-- y de una vez. Solo agrega: la app de antes sigue andando. Se puede volver a
-- correr.
-- =====================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'lesiones_historial' and column_name = 'equipo_id') then
    raise exception 'Primero hay que correr 20261013_seguridad.sql.';
  end if;
end $$;

create table if not exists public.notas (
  id             uuid primary key default gen_random_uuid(),
  equipo_id      uuid not null references public.equipos (id) on delete cascade,
  texto          text not null check (char_length(btrim(texto)) between 1 and 2000),
  hecha          boolean not null default false,
  creado_por     uuid references auth.users (id) on delete set null,
  creado_email   text not null default '',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.notas is
  'Mejoras para hacer en la app (la tarjeta Notas). Cada nota es de un club y la ve solo la gente que sigue en ese club.';

create index if not exists notas_por_club on public.notas (equipo_id, creado_en desc);

-- Quién la escribió y cuándo lo pone la base: desde la app se manda el club y
-- el texto, y después el texto o si está hecha. El club de una nota no cambia
-- y el texto lo corrige solo quien la escribió.
create or replace function public.notas_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.texto := btrim(new.texto);
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_email := coalesce((select u.email from auth.users u where u.id = new.creado_por), '');
    new.creado_en := now();
  else
    if new.texto is distinct from old.texto
       and auth.uid() is not null and auth.uid() is distinct from old.creado_por then
      raise exception 'solo_quien_la_escribio' using errcode = 'P0001';
    end if;
    new.id := old.id;
    new.equipo_id := old.equipo_id;
    new.creado_por := old.creado_por;
    new.creado_email := old.creado_email;
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists notas_preparar on public.notas;
create trigger notas_preparar
  before insert or update on public.notas
  for each row execute function public.notas_preparar();

revoke execute on function public.notas_preparar() from public, anon, authenticated;

-- Permisos justos: nada para anon; las cuentas logueadas leen y borran,
-- agregan solo el club y el texto y cambian solo el texto o si está hecha.
-- Las políticas dicen quién: la gente que sigue en el club (puede_editar).
alter table public.notas enable row level security;
revoke all on table public.notas from public, anon, authenticated;
grant select, delete on table public.notas to authenticated;
grant insert (equipo_id, texto) on table public.notas to authenticated;
grant update (texto, hecha) on table public.notas to authenticated;

drop policy if exists notas_ver on public.notas;
create policy notas_ver on public.notas
  for select to authenticated
  using (public.puede_editar(equipo_id));

drop policy if exists notas_agregar on public.notas;
create policy notas_agregar on public.notas
  for insert to authenticated
  with check (public.puede_editar(equipo_id));

drop policy if exists notas_cambiar on public.notas;
create policy notas_cambiar on public.notas
  for update to authenticated
  using (public.puede_editar(equipo_id))
  with check (public.puede_editar(equipo_id));

drop policy if exists notas_borrar on public.notas;
create policy notas_borrar on public.notas
  for delete to authenticated
  using (public.puede_editar(equipo_id)
         and (creado_por = (select auth.uid()) or public.es_admin_de_club(equipo_id)));

commit;

-- Que la app vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: las cuatro políticas y que anon no tiene nada.
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'notas'
 order by policyname;
select count(*) as permisos_de_anon
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public' and table_name = 'notas';
