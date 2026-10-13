-- =====================================================================
-- GPS › Cargar: las cargas sin terminar (Santiago, 13/10: «Dejar un boton
-- dentro de carga de gps donde pueda dejar el entrenamiento para revisar»;
-- «poder guardarlo en la computadora y poder seguirlo desde mi celular donde
-- lo deje o viceversa»).
--
--   · gps_en_curso: una fila por carga sin terminar, con el día del
--     entrenamiento, el paso donde quedó y un resumen para la lista. Una por
--     día y por club («lo frena y dice que ya esta en curso ese cargado»);
--     varias a la vez, de días distintos («si puede»).
--   · gps_en_curso_datos: lo hecho (el CSV, lo elegido en cada paso y lo
--     corregido en las tablas), aparte: la lista es liviana y va en Realtime
--     (aparece sola en los otros aparatos); lo pesado no viaja a cada uno.
--   · Las ve, las sigue y las borra quien tiene GPS en el club y sigue
--     («cualquiera con los permisos para verla»): el permiso, una vez por
--     pedido (clubes_donde_puedo, como la tabla gps). Quien ya se fue, no.
--     Anon, nada.
--   · Quién la dejó y cuándo lo pone la base. Cada vez que se deja, la
--     versión sube: si otro aparato la dejó en el medio, no se pisa
--     (gps_en_curso_otro_aparato).
--   · gps_dejar_en_curso guarda las dos partes juntas (todo o nada), con los
--     permisos de quien la llama.
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

create table if not exists public.gps_en_curso (
  id                uuid primary key default gen_random_uuid(),
  equipo_id         uuid not null references public.equipos (id) on delete cascade,
  fecha             date not null,
  paso              integer not null default 0,
  resumen           jsonb not null default '{}'::jsonb,
  version           integer not null default 1,
  creado_por        uuid references auth.users (id) on delete set null,
  creado_email      text not null default '',
  creado_en         timestamptz not null default now(),
  actualizado_por   uuid references auth.users (id) on delete set null,
  actualizado_email text not null default '',
  actualizado_en    timestamptz not null default now(),
  constraint gps_en_curso_un_dia unique (equipo_id, fecha),
  constraint gps_en_curso_paso check (paso between 0 and 999),
  constraint gps_en_curso_resumen check (jsonb_typeof(resumen) = 'object' and pg_column_size(resumen) <= 2048)
);

comment on table public.gps_en_curso is
  'Las cargas de GPS › Cargar que se dejaron para revisar: una por día y club. Lo hecho está en gps_en_curso_datos.';

create table if not exists public.gps_en_curso_datos (
  en_curso_id uuid primary key references public.gps_en_curso (id) on delete cascade,
  datos       jsonb not null,
  constraint gps_en_curso_datos_tamano check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) <= 20971520)
);

comment on table public.gps_en_curso_datos is
  'Lo hecho en una carga sin terminar de GPS (el CSV, lo elegido y lo corregido). Va aparte para que la lista sea liviana.';

-- Quién la dejó y cuándo lo pone la base; el club no cambia y la versión
-- sube cada vez que se deja.
create or replace function public.gps_en_curso_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := coalesce((select u.email from auth.users u where u.id = auth.uid()), '');
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_email := v_email;
    new.creado_en := now();
    new.version := 1;
  else
    new.id := old.id;
    new.equipo_id := old.equipo_id;
    new.creado_por := old.creado_por;
    new.creado_email := old.creado_email;
    new.creado_en := old.creado_en;
    new.version := old.version + 1;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_email := v_email;
  new.actualizado_en := now();
  return new;
end;
$$;
revoke execute on function public.gps_en_curso_preparar() from public, anon, authenticated;

drop trigger if exists gps_en_curso_preparar on public.gps_en_curso;
create trigger gps_en_curso_preparar
  before insert or update on public.gps_en_curso
  for each row execute function public.gps_en_curso_preparar();

-- Permisos justos: nada para anon; las cuentas leen y borran, y agregan o
-- cambian solo lo suyo (el club no se cambia). Las políticas dicen quién.
alter table public.gps_en_curso enable row level security;
revoke all on table public.gps_en_curso from public, anon, authenticated;
grant select, delete on table public.gps_en_curso to authenticated;
grant insert (equipo_id, fecha, paso, resumen) on table public.gps_en_curso to authenticated;
grant update (fecha, paso, resumen) on table public.gps_en_curso to authenticated;

drop policy if exists gps_en_curso_ver on public.gps_en_curso;
create policy gps_en_curso_ver on public.gps_en_curso
  for select to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_en_curso_crear on public.gps_en_curso;
create policy gps_en_curso_crear on public.gps_en_curso
  for insert to authenticated
  with check (equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_en_curso_cambiar on public.gps_en_curso;
create policy gps_en_curso_cambiar on public.gps_en_curso
  for update to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('gps')))
  with check (equipo_id in (select public.clubes_donde_puedo('gps')));

drop policy if exists gps_en_curso_borrar on public.gps_en_curso;
create policy gps_en_curso_borrar on public.gps_en_curso
  for delete to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('gps')));

-- Lo hecho: lo ve y lo cambia quien ve su carga (la política de
-- gps_en_curso decide). Se borra con su carga.
alter table public.gps_en_curso_datos enable row level security;
revoke all on table public.gps_en_curso_datos from public, anon, authenticated;
grant select on table public.gps_en_curso_datos to authenticated;
grant insert (en_curso_id, datos) on table public.gps_en_curso_datos to authenticated;
grant update (datos) on table public.gps_en_curso_datos to authenticated;

drop policy if exists gps_en_curso_datos_ver on public.gps_en_curso_datos;
create policy gps_en_curso_datos_ver on public.gps_en_curso_datos
  for select to authenticated
  using (exists (select 1 from public.gps_en_curso c where c.id = en_curso_id));

drop policy if exists gps_en_curso_datos_crear on public.gps_en_curso_datos;
create policy gps_en_curso_datos_crear on public.gps_en_curso_datos
  for insert to authenticated
  with check (exists (select 1 from public.gps_en_curso c where c.id = en_curso_id));

drop policy if exists gps_en_curso_datos_cambiar on public.gps_en_curso_datos;
create policy gps_en_curso_datos_cambiar on public.gps_en_curso_datos
  for update to authenticated
  using (exists (select 1 from public.gps_en_curso c where c.id = en_curso_id))
  with check (exists (select 1 from public.gps_en_curso c where c.id = en_curso_id));

-- Dejar una carga para revisar: sin id, una nueva; con id, la misma, solo si
-- nadie la dejó desde otro aparato en el medio (la versión que se abrió).
-- Las dos partes juntas: todo o nada. Con los permisos de quien la llama.
create or replace function public.gps_dejar_en_curso(
  p_id uuid,
  p_version integer,
  p_equipo uuid,
  p_fecha date,
  p_paso integer,
  p_resumen jsonb,
  p_datos jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
begin
  if p_id is null then
    insert into public.gps_en_curso (equipo_id, fecha, paso, resumen)
    values (p_equipo, p_fecha, p_paso, coalesce(p_resumen, '{}'::jsonb))
    returning id, version into v_id, v_version;
    insert into public.gps_en_curso_datos (en_curso_id, datos) values (v_id, p_datos);
  else
    update public.gps_en_curso c
       set fecha = p_fecha, paso = p_paso, resumen = coalesce(p_resumen, '{}'::jsonb)
     where c.id = p_id and c.version = p_version
    returning c.id, c.version into v_id, v_version;
    if v_id is null then
      if exists (select 1 from public.gps_en_curso c where c.id = p_id) then
        raise exception 'gps_en_curso_otro_aparato' using errcode = 'P0001';
      end if;
      raise exception 'gps_en_curso_no_esta' using errcode = 'P0001';
    end if;
    update public.gps_en_curso_datos d set datos = p_datos where d.en_curso_id = v_id;
    if not found then
      insert into public.gps_en_curso_datos (en_curso_id, datos) values (v_id, p_datos);
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

comment on function public.gps_dejar_en_curso(uuid, integer, uuid, date, integer, jsonb, jsonb) is
  'Deja una carga de GPS para revisar (nueva o la misma, si nadie la dejó desde otro aparato en el medio). Con los permisos de quien la llama.';

revoke execute on function public.gps_dejar_en_curso(uuid, integer, uuid, date, integer, jsonb, jsonb) from public, anon;
grant execute on function public.gps_dejar_en_curso(uuid, integer, uuid, date, integer, jsonb, jsonb) to authenticated;

-- La lista aparece sola en los otros aparatos (Realtime, como
-- 20261017_en_vivo.sql, sin replica identity full). Lo hecho, no: es pesado.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gps_en_curso'
  ) then
    alter publication supabase_realtime add table public.gps_en_curso;
  end if;
end $$;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.gps_en_curso'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.gps_en_curso_datos'::regclass) then
    raise exception 'Las cargas sin terminar quedaron sin RLS.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gps_en_curso') <> 4
     or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gps_en_curso_datos') <> 3 then
    raise exception 'Las cargas sin terminar no tienen todas sus políticas.';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where grantee in ('anon', 'PUBLIC') and table_schema = 'public'
                and table_name in ('gps_en_curso', 'gps_en_curso_datos'))
     or exists (select 1 from information_schema.column_privileges
                 where grantee in ('anon', 'PUBLIC') and table_schema = 'public'
                   and table_name in ('gps_en_curso', 'gps_en_curso_datos')) then
    raise exception 'anon no puede tener permisos en las cargas sin terminar.';
  end if;
end $$;

commit;

-- Que la app vea las tablas nuevas sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: las dos tablas con sus políticas, y la lista en
-- Realtime.
select tablename, count(*) as politicas
  from pg_policies
 where schemaname = 'public' and tablename in ('gps_en_curso', 'gps_en_curso_datos')
 group by tablename
 order by tablename;
select tablename as en_realtime
  from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gps_en_curso';
