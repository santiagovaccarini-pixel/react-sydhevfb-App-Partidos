-- =====================================================================
-- La foto al día de salida: quien se fue de un club ve cada partido,
-- entrenamiento, jugador y lesión tal como estaba al terminar su último
-- día; nada de lo que se cargó o se cambió después.
--
--   · versiones_datos: cada fila de esas cuatro tablas guarda cómo quedó
--     al final de cada día en que se tocó (una versión por fila y día, en la
--     zona horaria del club). La escribe la base; nadie la lee directo.
--   · datos_al_dia(tabla, club): lo que la cuenta puede ver de ese club. A
--     quien sigue en el club, como está hoy; a quien se fue, la foto de su
--     último día. Pide el módulo de la tabla (Partido, Flujo diario,
--     Lesiones; el plantel, cualquier membresía).
--   · Las tablas solo se leen directo estando en el club: quien se fue lee
--     únicamente la foto.
--   · equipos.zona_horaria: dónde termina el día de cada club.
--
-- Lo que ya estaba cargado arranca con una versión del día en que se creó
-- (las lesiones, con toda su historia). Requiere 20261004_cuentas_v2.sql.
-- Se corre en Supabase > SQL Editor, entero y de una vez. Se puede volver a
-- correr.
-- =====================================================================

begin;

-- Sin las cuentas v2 no hay membresías por club: se frena con un aviso claro.
do $$
begin
  if to_regprocedure('public.puede_usar_en(uuid, text)') is null then
    raise exception 'Primero hay que correr 20261004_cuentas_v2.sql.';
  end if;
end $$;

alter table public.equipos
  add column if not exists zona_horaria text not null default 'America/Sao_Paulo';

comment on column public.equipos.zona_horaria is
  'Zona horaria del club (IANA): dónde termina su día para la foto de quien se va.';

-- ------------------------------------------------------- Las versiones --

create table if not exists public.versiones_datos (
  id        bigint generated always as identity primary key,
  tabla     text not null,
  fila_id   text not null,
  equipo_id uuid,
  accion    text not null check (accion in ('creada', 'editada', 'borrada')),
  fila      jsonb,
  cuando    timestamptz not null default now()
);

comment on table public.versiones_datos is
  'Cómo quedó cada fila de partidos, entrenamientos, jugadores y lesiones al final de cada día en que se tocó. La escribe la base; se lee con datos_al_dia().';

create index if not exists versiones_por_club on public.versiones_datos (tabla, equipo_id, cuando);
create index if not exists versiones_por_fila on public.versiones_datos (tabla, fila_id, cuando desc);

alter table public.versiones_datos enable row level security;
revoke all on table public.versiones_datos from anon, authenticated;

-- El día de una fecha en la zona del club.
create or replace function public.dia_del_club(p_equipo uuid, p_cuando timestamptz)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (p_cuando at time zone coalesce((select e.zona_horaria from public.equipos e where e.id = p_equipo), 'America/Sao_Paulo'))::date;
$$;

-- Anota la versión: si la fila ya tiene una de hoy, la pisa (una por día
-- alcanza, la foto es de fin del día); si no, suma otra.
create or replace function public.anotar_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila jsonb;
  v_accion text;
  v_id text;
  v_equipo uuid;
  v_ultima public.versiones_datos;
begin
  if tg_op = 'DELETE' then
    v_fila := to_jsonb(old);
    v_accion := 'borrada';
  else
    v_fila := to_jsonb(new);
    v_accion := case when tg_op = 'INSERT' then 'creada' else 'editada' end;
    if tg_op = 'UPDATE' and to_jsonb(old) = v_fila then
      return new;
    end if;
  end if;
  v_id := v_fila ->> 'id';
  v_equipo := nullif(v_fila ->> 'equipo_id', '')::uuid;

  select * into v_ultima
    from public.versiones_datos v
   where v.tabla = tg_table_name and v.fila_id = v_id
   order by v.cuando desc, v.id desc
   limit 1;

  if v_ultima.id is not null
     and v_ultima.accion <> 'borrada'
     and public.dia_del_club(v_equipo, v_ultima.cuando) = public.dia_del_club(v_equipo, now()) then
    update public.versiones_datos
       set fila = v_fila,
           equipo_id = v_equipo,
           cuando = now(),
           accion = case when v_accion = 'borrada' then 'borrada' when v_ultima.accion = 'creada' then 'creada' else v_accion end
     where id = v_ultima.id;
  else
    insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila)
    values (tg_table_name, v_id, v_equipo, v_accion, v_fila);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists anotar_version on public.registros_partido;
create trigger anotar_version after insert or update or delete on public.registros_partido
  for each row execute function public.anotar_version();
drop trigger if exists anotar_version on public.entrenamientos;
create trigger anotar_version after insert or update or delete on public.entrenamientos
  for each row execute function public.anotar_version();
drop trigger if exists anotar_version on public.jugadores;
create trigger anotar_version after insert or update or delete on public.jugadores
  for each row execute function public.anotar_version();
drop trigger if exists anotar_version on public.lesiones;
create trigger anotar_version after insert or update or delete on public.lesiones
  for each row execute function public.anotar_version();

-- --------------------------------------------- Lo que ya estaba cargado --

-- Lesiones: toda su historia (la tabla lesiones_historial la tiene completa).
insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'lesiones', h.lesion_id::text,
       nullif(coalesce(h.despues, h.antes) ->> 'equipo_id', '')::uuid,
       h.accion, coalesce(h.despues, h.antes), h.cuando
  from public.lesiones_historial h
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'lesiones' and v.fila_id = h.lesion_id::text);

-- El resto: una versión del día en que se creó cada fila, con lo que tiene hoy.
-- Sin fecha de creación cuenta como de hoy: así nunca aparece en la foto de
-- alguien que se fue antes.
insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'registros_partido', r.id::text, r.equipo_id, 'creada', to_jsonb(r), coalesce(r.created_at, now())
  from public.registros_partido r
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'registros_partido' and v.fila_id = r.id::text);

insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'entrenamientos', e.id::text, e.equipo_id, 'creada', to_jsonb(e), coalesce(e.creado_en, now())
  from public.entrenamientos e
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'entrenamientos' and v.fila_id = e.id::text);

insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'jugadores', j.id::text, j.equipo_id, 'creada', to_jsonb(j), coalesce(j.creado_en, now())
  from public.jugadores j
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'jugadores' and v.fila_id = j.id::text);

insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'lesiones', l.id::text, l.equipo_id, 'creada', to_jsonb(l), coalesce(l.creado_en, now())
  from public.lesiones l
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'lesiones' and v.fila_id = l.id::text);

-- ---------------------------------------------------------- La foto --

create or replace function public.datos_al_dia(p_tabla text, p_equipo uuid)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hasta date;
  v_modulo text;
  v_corte timestamptz;
begin
  if p_tabla not in ('registros_partido', 'entrenamientos', 'jugadores', 'lesiones') then
    raise exception 'tabla_invalida' using errcode = 'P0001';
  end if;
  v_hasta := public.acceso_club(p_equipo);
  if v_hasta is null then
    return;
  end if;
  v_modulo := case p_tabla when 'registros_partido' then 'partido'
                           when 'entrenamientos' then 'flujo'
                           when 'lesiones' then 'lesiones' end;
  if v_modulo is not null and not public.puede_usar_en(p_equipo, v_modulo) then
    return;
  end if;
  if v_hasta = 'infinity'::date then
    v_corte := 'infinity'::timestamptz;
  else
    v_corte := ((v_hasta + 1)::timestamp at time zone
                coalesce((select e.zona_horaria from public.equipos e where e.id = p_equipo), 'America/Sao_Paulo'));
  end if;
  -- Lo más nuevo primero: si la respuesta se corta (la API devuelve hasta
  -- 1000 filas), lo que queda afuera es lo más viejo.
  return query
    select x.fila
      from (select distinct on (v.fila_id) v.fila, v.accion, v.cuando
              from public.versiones_datos v
             where v.tabla = p_tabla and v.equipo_id = p_equipo and v.cuando < v_corte
             order by v.fila_id, v.cuando desc, v.id desc) x
     where x.accion <> 'borrada'
     order by x.cuando desc;
end;
$$;

revoke execute on function public.datos_al_dia(text, uuid) from public, anon;
grant execute on function public.datos_al_dia(text, uuid) to authenticated;
revoke execute on function public.anotar_version(), public.dia_del_club(uuid, timestamptz) from public, anon, authenticated;

-- ------------------------------------- Las tablas, solo estando adentro --

drop policy if exists registros_ver on public.registros_partido;
create policy registros_ver on public.registros_partido
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'partido') and public.puede_editar(equipo_id));

drop policy if exists entrenamientos_ver on public.entrenamientos;
create policy entrenamientos_ver on public.entrenamientos
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'flujo') and public.puede_editar(equipo_id));

drop policy if exists jugadores_ver on public.jugadores;
create policy jugadores_ver on public.jugadores
  for select to authenticated
  using (public.puede_editar(equipo_id));

drop policy if exists lesiones_ver on public.lesiones;
create policy lesiones_ver on public.lesiones
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

drop policy if exists lesiones_historial_ver on public.lesiones_historial;
create policy lesiones_historial_ver on public.lesiones_historial
  for select to authenticated
  using (exists (select 1 from public.lesiones l
                  where l.id = lesion_id
                    and public.puede_usar_en(l.equipo_id, 'lesiones')
                    and public.puede_editar(l.equipo_id)));

commit;

-- Para ver que quedó bien: cuántas versiones tiene cada tabla.
select tabla, count(*) as versiones, count(distinct fila_id) as filas
  from public.versiones_datos
 group by tabla
 order by tabla;
