-- =====================================================================
-- Partido compartido entre celulares, parte 4a (paso 4 de la nota «cargar
-- sin señal y a la vez que otra persona»; Santiago, 23/10, en cuestionarios:
-- «Varios cargan a la vez»; si dos anotan el mismo dato con otro valor,
-- «Gana el último y avisa»; sin señal, «Sigue y se junta al volver»; por
-- partes; al Historial (y al Excel) recién con «Guardar partido», como hoy;
-- «Limpiar», solo en ese celular).
--
--   · partidos_en_curso: el partido que se está cargando, aparte de
--     registros_partido: el Historial y el Excel no lo ven hasta «Guardar
--     partido». Lo cargado va en datos, dato por dato: { "rival": "…",
--     "inicioPT": "…", "cambios.<id>.sale": "…", … } (lo arma la app,
--     src/domain/partidoEnCurso.js). registro_id: la fila del Historial,
--     cuando ya se guardó.
--   · partido_en_curso_cambiar sube solo lo que cambió (p_cambios; null o
--     "" lo saca). Sin p_id, lo crea. La fila queda bloqueada mientras se
--     cambia: los cambios entran de a uno, en orden. Con p_antes (lo que se
--     veía de cada dato), si otra persona lo cambió mientras tanto (y no a
--     lo mismo), gana el último y la base lo dice (pisadas, con lo que
--     había), para avisar.
--   · Lo ve quien tiene Partido en el club y sigue; lo carga y lo cambia
--     quien lo tiene con Edición (no en «Solo lectura»), con sus permisos.
--     Quién y cuándo lo pone la base. Anon, nada.
--
-- Requiere 20261029_niveles_de_permiso.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. Solo agrega: la app de antes sigue andando.
-- Se puede volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.clubes_donde_edito(text)') is null or to_regprocedure('public.clubes_donde_puedo(text)') is null then
    raise exception 'Primero hay que correr 20261029_niveles_de_permiso.sql.';
  end if;
end $$;

create table if not exists public.partidos_en_curso (
  id                uuid primary key default gen_random_uuid(),
  equipo_id         uuid not null references public.equipos (id) on delete cascade,
  datos             jsonb not null default '{}'::jsonb,
  registro_id       bigint references public.registros_partido (id) on delete set null,
  version           integer not null default 1,
  creado_por        uuid references auth.users (id) on delete set null,
  creado_email      text not null default '',
  creado_en         timestamptz not null default now(),
  actualizado_por   uuid references auth.users (id) on delete set null,
  actualizado_email text not null default '',
  actualizado_en    timestamptz not null default now(),
  constraint partidos_en_curso_datos check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) <= 1048576)
);

comment on table public.partidos_en_curso is
  'El partido que se está cargando en Partido, dato por dato, compartido entre los celulares del club. Pasa al Historial (registros_partido) con «Guardar partido».';

create index if not exists partidos_en_curso_club on public.partidos_en_curso (equipo_id, actualizado_en desc);

-- Quién lo cargó y cuándo lo pone la base; el club no cambia y la versión
-- sube con cada cambio.
create or replace function public.partidos_en_curso_preparar()
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
revoke execute on function public.partidos_en_curso_preparar() from public, anon, authenticated;

drop trigger if exists partidos_en_curso_preparar on public.partidos_en_curso;
create trigger partidos_en_curso_preparar
  before insert or update on public.partidos_en_curso
  for each row execute function public.partidos_en_curso_preparar();

-- Permisos justos: nada para anon; las cuentas leen y borran, y agregan o
-- cambian solo lo cargado (el club no se cambia). Las políticas dicen quién.
alter table public.partidos_en_curso enable row level security;
revoke all on table public.partidos_en_curso from public, anon, authenticated;
grant select, delete on table public.partidos_en_curso to authenticated;
grant insert (equipo_id, datos, registro_id) on table public.partidos_en_curso to authenticated;
grant update (datos, registro_id) on table public.partidos_en_curso to authenticated;

drop policy if exists partidos_en_curso_ver on public.partidos_en_curso;
create policy partidos_en_curso_ver on public.partidos_en_curso
  for select to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('partido')));

drop policy if exists partidos_en_curso_crear on public.partidos_en_curso;
create policy partidos_en_curso_crear on public.partidos_en_curso
  for insert to authenticated
  with check (equipo_id in (select public.clubes_donde_edito('partido')));

drop policy if exists partidos_en_curso_cambiar on public.partidos_en_curso;
create policy partidos_en_curso_cambiar on public.partidos_en_curso
  for update to authenticated
  using (equipo_id in (select public.clubes_donde_edito('partido')))
  with check (equipo_id in (select public.clubes_donde_edito('partido')));

drop policy if exists partidos_en_curso_borrar on public.partidos_en_curso;
create policy partidos_en_curso_borrar on public.partidos_en_curso
  for delete to authenticated
  using (equipo_id in (select public.clubes_donde_edito('partido')));

-- Subir lo que cambió (o crearlo, sin p_id). Devuelve { id, datos,
-- version, pisadas: [{ clave, habia }] }.
create or replace function public.partido_en_curso_cambiar(
  p_id uuid,
  p_equipo uuid,
  p_cambios jsonb,
  p_antes jsonb default '{}'::jsonb,
  p_registro bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fila public.partidos_en_curso%rowtype;
  v_datos jsonb;
  v_clave text;
  v_nuevo jsonb;
  v_habia jsonb;
  v_vio jsonb;
  v_pisadas jsonb := '[]'::jsonb;
  v_quedo jsonb;
begin
  -- Cada dato con su nombre: letras, números, _ y - (con hasta tres puntos).
  if jsonb_typeof(p_cambios) is distinct from 'object'
     or jsonb_typeof(coalesce(p_antes, '{}'::jsonb)) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_cambios) k
                 where length(k) > 120 or k !~ '^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_-]+){0,3}$') then
    raise exception 'partido_en_curso_cambios' using errcode = 'P0001';
  end if;

  -- Uno nuevo, con lo cargado (lo vacío no va).
  if p_id is null then
    insert into public.partidos_en_curso (equipo_id, datos, registro_id)
    values (p_equipo,
            (select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb)
               from jsonb_each(p_cambios) c
              where c.value not in ('null'::jsonb, '""'::jsonb)),
            p_registro)
    returning jsonb_build_object('id', id, 'datos', datos, 'version', version, 'pisadas', '[]'::jsonb)
      into v_quedo;
    return v_quedo;
  end if;

  -- Si ya no está (o no se ve), lo borraron.
  perform 1 from public.partidos_en_curso where id = p_id;
  if not found then
    raise exception 'partido_en_curso_no_esta' using errcode = 'P0001';
  end if;
  -- Bloqueado hasta terminar: los cambios entran de a uno. Se ve pero no
  -- se puede cambiar: sin permiso.
  select * into v_fila from public.partidos_en_curso where id = p_id for update;
  if not found then
    raise exception 'permission denied for table partidos_en_curso' using errcode = '42501';
  end if;
  v_datos := v_fila.datos;

  for v_clave, v_nuevo in select c.key, c.value from jsonb_each(p_cambios) c loop
    v_habia := coalesce(v_datos -> v_clave, 'null'::jsonb);
    if v_nuevo = 'null'::jsonb or v_nuevo = '""'::jsonb then
      v_datos := v_datos - v_clave;
      v_nuevo := 'null'::jsonb;
    else
      v_datos := jsonb_set(v_datos, array[v_clave], v_nuevo, true);
    end if;
    -- Otra persona lo cambió mientras tanto (y no a lo mismo): gana el último.
    if coalesce(p_antes, '{}'::jsonb) ? v_clave then
      v_vio := case when p_antes -> v_clave = '""'::jsonb then 'null'::jsonb else p_antes -> v_clave end;
      if v_habia is distinct from v_vio and v_habia is distinct from v_nuevo then
        v_pisadas := v_pisadas || jsonb_build_array(jsonb_build_object('clave', v_clave, 'habia', v_habia));
      end if;
    end if;
  end loop;

  update public.partidos_en_curso p
     set datos = v_datos,
         registro_id = coalesce(p_registro, p.registro_id)
   where p.id = p_id
  returning jsonb_build_object('id', p.id, 'datos', p.datos, 'version', p.version, 'pisadas', v_pisadas)
    into v_quedo;
  if v_quedo is null then
    raise exception 'partido_en_curso_no_esta' using errcode = 'P0001';
  end if;
  return v_quedo;
end;
$$;

revoke execute on function public.partido_en_curso_cambiar(uuid, uuid, jsonb, jsonb, bigint) from public, anon;
grant execute on function public.partido_en_curso_cambiar(uuid, uuid, jsonb, jsonb, bigint) to authenticated;

-- Antes de guardar, que haya quedado bien.
do $$
declare
  v_huecos text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.partidos_en_curso'::regclass) then
    raise exception 'partidos_en_curso quedó sin reglas.';
  end if;
  if has_any_column_privilege('anon', 'public.partidos_en_curso', 'SELECT, INSERT, UPDATE')
     or has_table_privilege('anon', 'public.partidos_en_curso', 'DELETE') then
    raise exception 'anon no puede tener permisos en partidos_en_curso.';
  end if;
  if has_function_privilege('anon', 'public.partido_en_curso_cambiar(uuid, uuid, jsonb, jsonb, bigint)', 'EXECUTE') then
    raise exception 'anon no puede cambiar el partido en curso.';
  end if;
  select string_agg(problema || ': ' || objeto, ', ') into v_huecos from public.huecos_entre_clubes();
  if v_huecos is not null then
    raise exception 'Hay datos que podrían pasar de un club a otro: %', v_huecos;
  end if;
end $$;

commit;

-- Que la app vea la tabla y la función sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: la tabla, con sus reglas, y la función.
select to_regclass('public.partidos_en_curso') as tabla,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'partidos_en_curso') as reglas,
       to_regprocedure('public.partido_en_curso_cambiar(uuid, uuid, jsonb, jsonb, bigint)') as funcion;
