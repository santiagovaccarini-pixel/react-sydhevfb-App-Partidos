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
--     Lesiones; el plantel, cualquier membresía). Una fila que se pasó a
--     otro club deja de estar en la foto del anterior desde ese día.
--   · Las tablas solo se leen directo estando en el club: quien se fue lee
--     únicamente la foto.
--   · equipos.zona_horaria: dónde termina el día de cada club. Tiene que ser
--     una zona que exista (se controla) y desde la app no se cambia: desde la
--     app, de un club solo se cambia el nombre.
--
-- Lo que ya estaba cargado arranca así: las lesiones, con toda su historia;
-- partidos y jugadores, desde el día en que se crearon; entrenamientos,
-- desde su último cambio. Requiere 20261004_cuentas_v2.sql.
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
  'Zona horaria del club (IANA, como America/Sao_Paulo): dónde termina su día para la foto de quien se va.';

-- La zona tiene que existir: una mal escrita no puede entrar.
create or replace function public.equipos_validar_zona()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.zona_horaria is not distinct from old.zona_horaria then
      return new;
    end if;
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.zona_horaria) then
    raise exception 'zona_horaria_invalida'
      using errcode = 'P0001',
            hint = 'Tiene que ser un nombre como America/Sao_Paulo o America/Argentina/Buenos_Aires.';
  end if;
  return new;
end;
$$;

drop trigger if exists equipos_validar_zona on public.equipos;
create trigger equipos_validar_zona
  before insert or update of zona_horaria on public.equipos
  for each row execute function public.equipos_validar_zona();

-- Desde la app, de un club solo se cambia el nombre. La zona horaria (y lo
-- que se sume) se cambia desde acá.
revoke update on table public.equipos from authenticated;
grant update (nombre) on table public.equipos to authenticated;

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

-- Reemplazada por zona_del_club (una versión anterior de este archivo).
drop function if exists public.dia_del_club(uuid, timestamptz);

-- La zona del club, siempre una que existe (si no, la de siempre): así nada
-- de esto puede frenar la carga de datos.
create or replace function public.zona_del_club(p_equipo uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_zona text;
begin
  select e.zona_horaria into v_zona from public.equipos e where e.id = p_equipo;
  if v_zona is null then
    return 'America/Sao_Paulo';
  end if;
  begin
    perform now() at time zone v_zona;
    return v_zona;
  exception when others then
    return 'America/Sao_Paulo';
  end;
end;
$$;

-- Anota la versión. Una por fila y por día: si la última es de hoy, del
-- mismo club y la fila no estaba borrada, se pisa (la foto es la del final
-- del día); si no, se suma otra.
create or replace function public.anotar_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- text y no name (como tg_table_name): así la búsqueda usa el índice.
  v_tabla text := tg_table_name;
  v_fila jsonb;
  v_accion text;
  v_id text;
  v_equipo uuid;
  v_zona text;
  v_ultima public.versiones_datos;
begin
  if tg_op = 'DELETE' then
    v_fila := to_jsonb(old);
    v_accion := 'borrada';
  else
    v_fila := to_jsonb(new);
    v_accion := case when tg_op = 'INSERT' then 'creada' else 'editada' end;
    if tg_op = 'UPDATE' then
      if to_jsonb(old) = v_fila then
        return new;
      end if;
    end if;
  end if;
  v_id := v_fila ->> 'id';
  v_equipo := nullif(v_fila ->> 'equipo_id', '')::uuid;
  v_zona := public.zona_del_club(v_equipo);

  select * into v_ultima
    from public.versiones_datos v
   where v.tabla = v_tabla and v.fila_id = v_id
   order by v.cuando desc, v.id desc
   limit 1;

  if v_ultima.id is not null
     and v_ultima.accion <> 'borrada'
     and v_ultima.equipo_id is not distinct from v_equipo
     and (v_ultima.cuando at time zone v_zona)::date = (now() at time zone v_zona)::date then
    update public.versiones_datos
       set fila = v_fila,
           cuando = now(),
           accion = case when v_accion = 'borrada' then 'borrada'
                         when v_ultima.accion = 'creada' then 'creada'
                         else v_accion end
     where id = v_ultima.id;
  else
    insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila)
    values (v_tabla, v_id, v_equipo, v_accion, v_fila);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
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

-- Lesiones: toda su historia (lesiones_historial la tiene completa), en orden.
insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'lesiones', h.lesion_id::text,
       nullif(coalesce(h.despues, h.antes) ->> 'equipo_id', '')::uuid,
       h.accion, coalesce(h.despues, h.antes), h.cuando
  from public.lesiones_historial h
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'lesiones' and v.fila_id = h.lesion_id::text)
 order by h.cuando, h.id;

-- El resto: una versión con lo que cada fila tiene hoy. Partidos y jugadores
-- cuentan desde el día en que se crearon. Los entrenamientos, desde su último
-- cambio: a quien se fue antes de ese cambio no le aparecen, en vez de
-- aparecerle con lo de después. Sin fecha conocida, cuentan desde hoy.

-- registros_partido viene de antes de las migraciones: se mira si tiene la
-- fecha de creación antes de usarla.
do $$
declare
  v_desde text := 'null::timestamptz';
begin
  if exists (select 1 from information_schema.columns c
              where c.table_schema = 'public' and c.table_name = 'registros_partido' and c.column_name = 'created_at') then
    v_desde := 'r.created_at';
  end if;
  execute format($sql$
    insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
    select 'registros_partido', r.id::text, r.equipo_id, 'creada', to_jsonb(r), coalesce(%s, now())
      from public.registros_partido r
     where not exists (select 1 from public.versiones_datos v where v.tabla = 'registros_partido' and v.fila_id = r.id::text)
  $sql$, v_desde);
end $$;

insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'entrenamientos', e.id::text, e.equipo_id, 'creada', to_jsonb(e), coalesce(greatest(e.creado_en, e.actualizado_en), now())
  from public.entrenamientos e
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'entrenamientos' and v.fila_id = e.id::text);

insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'jugadores', j.id::text, j.equipo_id, 'creada', to_jsonb(j), coalesce(j.creado_en, now())
  from public.jugadores j
 where not exists (select 1 from public.versiones_datos v where v.tabla = 'jugadores' and v.fila_id = j.id::text);

-- Lesiones sin historia (no debería haber): desde su último cambio.
insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
select 'lesiones', l.id::text, l.equipo_id, 'creada', to_jsonb(l), coalesce(greatest(l.creado_en, l.actualizado_en), now())
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
    v_corte := (v_hasta + 1)::timestamp at time zone public.zona_del_club(p_equipo);
  end if;
  -- La última versión de cada fila antes del corte, sea del club que sea: si
  -- para entonces la fila ya se había pasado a otro club, no va. Lo más nuevo
  -- primero: si la respuesta se corta (la API devuelve hasta 1000 filas), lo
  -- que queda afuera es lo más viejo.
  return query
    select x.fila
      from (select distinct on (v.fila_id) v.fila, v.accion, v.cuando, v.equipo_id
              from public.versiones_datos v
             where v.tabla = p_tabla
               and v.cuando < v_corte
               and v.fila_id in (select w.fila_id from public.versiones_datos w
                                  where w.tabla = p_tabla and w.equipo_id = p_equipo and w.cuando < v_corte)
             order by v.fila_id, v.cuando desc, v.id desc) x
     where x.accion <> 'borrada'
       and x.equipo_id = p_equipo
     order by x.cuando desc;
end;
$$;

revoke execute on function public.datos_al_dia(text, uuid) from public, anon;
grant execute on function public.datos_al_dia(text, uuid) to authenticated;
revoke execute on function public.anotar_version(), public.zona_del_club(uuid), public.equipos_validar_zona() from public, anon, authenticated;

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
