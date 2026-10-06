-- =====================================================================
-- Seguridad: lo que encontró la revisión de privacidad (05/10). Ningún dato
-- de un club, y menos los médicos, se puede ver desde otro club.
--
--   · lesiones_historial guarda el club de cada cambio (equipo_id) y se ve
--     por ese club, no por la lesión que hoy tenga ese id: el historial de
--     una lesión borrada ya no se abre creando en otro club una lesión con
--     el mismo id. Y desde la app, el id de una lesión nueva lo pone la base
--     (la app nunca lo elige).
--   · Una lesión es de un jugador de su club (como una evaluación): al
--     cargarla o al cambiarle el jugador, uno de otro club no entra
--     (jugador_de_otro_club). Lo que ya estaba cargado no se toca.
--   · Quién cargó una lesión y quién la cambió lo pone la base; una
--     invitación cambiada pasa por el mismo control que al invitar y quién
--     invitó no cambia.
--   · Al club se entra por invitación: un administrador de club ya no suma
--     a mano una cuenta cualquiera (y con eso leía su perfil). Sumar a mano
--     queda para el dueño de la plataforma.
--
-- Requiere 20261012_evaluaciones.sql. Se corre en Supabase > SQL Editor,
-- entero y de una vez. Solo agrega o ajusta: la app de antes sigue andando.
-- Se puede volver a correr, salvo después de 20261014_duenos_y_pedidos.sql:
-- ahí se frena sola (le devolvería al dueño sumar gente a mano).
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.evaluaciones') is null then
    raise exception 'Primero hay que correr 20261012_evaluaciones.sql.';
  end if;
  if to_regclass('public.plataforma') is not null then
    raise exception 'Ya está corrida 20261014_duenos_y_pedidos.sql: esta es anterior y no hace falta volver a correrla.';
  end if;
end $$;

-- ------------------------------- El historial de lesiones, por su club --

-- Antes se veía si existía hoy una lesión con ese id en un club propio. El
-- historial queda cuando la lesión se borra: alcanzaba con crear en el club
-- propio una lesión con el id de una borrada de otro club para leer toda su
-- historia (diagnóstico, comentarios, médico, correos).
alter table public.lesiones_historial add column if not exists equipo_id uuid;

comment on column public.lesiones_historial.equipo_id is
  'El club de la lesión en ese cambio (cómo quedó; si se borró, cómo estaba). Lo anota el disparador. El historial se ve por este club, nunca por la lesión que hoy tenga ese id.';

-- Lo que ya estaba: el club sale de la misma fila guardada en el cambio
-- (después, o antes si se borró), que siempre lo tiene. No de la lesión que
-- hoy tenga ese id: podría ser otra con el id repetido.
update public.lesiones_historial h
   set equipo_id = nullif(coalesce(h.despues, h.antes) ->> 'equipo_id', '')::uuid
 where h.equipo_id is null
   and coalesce(h.despues, h.antes) ? 'equipo_id';

create index if not exists lesiones_historial_por_club on public.lesiones_historial (equipo_id);

-- El disparador de 20261002, anotando también el club.
create or replace function public.lesiones_historial_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  correo text := coalesce((select p.email from public.perfiles p where p.user_id = auth.uid()), '');
begin
  if tg_op = 'INSERT' then
    insert into public.lesiones_historial (lesion_id, equipo_id, accion, quien, quien_email, despues)
    values (new.id, new.equipo_id, 'creada', auth.uid(), correo, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.lesiones_historial (lesion_id, equipo_id, accion, quien, quien_email, antes, despues)
    values (new.id, new.equipo_id, 'editada', auth.uid(), correo, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.lesiones_historial (lesion_id, equipo_id, accion, quien, quien_email, antes)
    values (old.id, old.equipo_id, 'borrada', auth.uid(), correo, to_jsonb(old));
    return old;
  end if;
end;
$$;

-- Se ve con la misma regla que las lesiones (Lesiones en ese club y seguir
-- en él), mirando el club de la fila. La de 20261001 (cualquiera con
-- Lesiones veía todo) se saca si quedó.
drop policy if exists lesiones_historial_leer on public.lesiones_historial;
drop policy if exists lesiones_historial_ver on public.lesiones_historial;
create policy lesiones_historial_ver on public.lesiones_historial
  for select to authenticated
  using (public.puede_usar_en(equipo_id, 'lesiones') and public.puede_editar(equipo_id));

-- ------------------------------------- Lesiones: lo que pone la base --

-- Una sola regla para lo que la app no decide: el id, quién la cargó y
-- quién la cambió (antes, al cargar, la app podía poner cualquier autor y
-- cualquier fecha). Reemplaza a lesiones_anotar_cambio.
create or replace function public.lesiones_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autoria constant text[] := array['creado_por', 'creado_en', 'actualizado_por', 'actualizado_en'];
begin
  -- La base sola, sin nadie conectado y sin tocar lo cargado: es el "on
  -- delete set null" de creado_por o actualizado_por al borrar una cuenta
  -- (como en Evaluaciones). Quedan los autores cuyas cuentas siguen y las
  -- fechas como estaban.
  if tg_op = 'UPDATE' and auth.uid() is null
     and (to_jsonb(new) - v_autoria) = (to_jsonb(old) - v_autoria) then
    new.creado_por := case when exists (select 1 from auth.users u where u.id = old.creado_por) then old.creado_por end;
    new.actualizado_por := case when exists (select 1 from auth.users u where u.id = old.actualizado_por) then old.actualizado_por end;
    new.creado_en := old.creado_en;
    new.actualizado_en := old.actualizado_en;
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Desde la app: id nuevo siempre (la app nunca lo elige: lesionesDb.js no
    -- lo manda), así nadie repite el de una borrada; y el autor es quien la
    -- carga, ahora. Sin nadie conectado (el SQL Editor, una restauración)
    -- queda lo que venga.
    if auth.uid() is not null then
      new.id := gen_random_uuid();
      new.creado_por := auth.uid();
      new.creado_en := now();
      new.actualizado_por := auth.uid();
      new.actualizado_en := now();
    end if;
  else
    -- Quién la cargó y cuándo no cambia (si su cuenta ya no existe, queda
    -- vacío); quién la cambió, sí, como hacía lesiones_anotar_cambio.
    new.creado_por := case when exists (select 1 from auth.users u where u.id = old.creado_por) then old.creado_por end;
    new.creado_en := old.creado_en;
    new.actualizado_por := auth.uid();
    new.actualizado_en := now();
  end if;
  -- El jugador, del club de la lesión (como en Evaluaciones): al cargarla o
  -- al cambiarle el jugador o el club. Lo que ya estaba (por ejemplo, de un
  -- jugador que después pasó a otro club) se sigue pudiendo editar. A quien
  -- no puede cargar en ese club no se le contesta nada de ese club: lo frena
  -- la política, como siempre.
  if new.jugador_id is not null
     and (tg_op = 'INSERT' or new.jugador_id is distinct from old.jugador_id or new.equipo_id is distinct from old.equipo_id)
     and (auth.uid() is null or public.puede_editar(new.equipo_id))
     and not exists (select 1 from public.jugadores j where j.id = new.jugador_id and j.equipo_id = new.equipo_id) then
    raise exception 'jugador_de_otro_club' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists lesiones_preparar on public.lesiones;
create trigger lesiones_preparar
  before insert or update on public.lesiones
  for each row execute function public.lesiones_preparar();

-- Lo que hacía (quién la cambió y cuándo) lo hace ahora lesiones_preparar.
drop trigger if exists lesiones_anotar_cambio on public.lesiones;
drop function if exists public.lesiones_anotar_cambio();

revoke execute on function public.lesiones_preparar(), public.lesiones_historial_anotar() from public, anon, authenticated;

-- ---------------------------------------- Invitaciones: también al cambiar --

-- El correo se limpiaba y se controlaba solo al invitar, y quién invitó se
-- podía cambiar después: un administrador podía dejar un correo inválido o
-- poner como autor a alguien de otro club (y así figuraba en la historia del
-- alta). Ahora, al cambiar una invitación, el correo pasa por el mismo
-- control y quién invitó y cuándo no cambian (si su cuenta ya no existe,
-- queda vacío: es el "on delete set null" al borrar esa cuenta).
create or replace function public.club_invitaciones_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.email := lower(btrim(new.email));
    if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'correo_invalido' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
  else
    new.creado_por := case when exists (select 1 from auth.users u where u.id = old.creado_por) then old.creado_por end;
    new.creado_en := old.creado_en;
  end if;
  return new;
end;
$$;

drop trigger if exists club_invitaciones_preparar on public.club_invitaciones;
create trigger club_invitaciones_preparar
  before insert or update on public.club_invitaciones
  for each row execute function public.club_invitaciones_preparar();

revoke execute on function public.club_invitaciones_preparar() from public, anon, authenticated;

-- ----------------------------------- Al club se entra por invitación --

-- Un administrador de club podía sumar a su club cualquier cuenta de la que
-- supiera el id (sin invitación ni consentimiento) y con eso leer su perfil
-- (correo, estado). La app nunca lo hace: se entra por invitación
-- (aplicar_invitaciones), quien crea un club entra solo
-- (equipos_sumar_creador), y reincorporar es cambiar la membresía que ya
-- está. Esas tres siguen igual; sumar a mano queda para el dueño de la
-- plataforma (que ya ve todas las cuentas).
drop policy if exists club_miembros_crear on public.club_miembros;
create policy club_miembros_crear on public.club_miembros
  for insert to authenticated
  with check ((select public.es_admin()));

commit;

-- Para ver que quedó bien: ningún cambio del historial sin club (tiene que
-- dar 0), las políticas del historial (una sola) y quién suma gente a un
-- club a mano (solo el dueño: es_admin).
select count(*) as historial_sin_club from public.lesiones_historial where equipo_id is null;
select policyname from pg_policies where schemaname = 'public' and tablename = 'lesiones_historial';
select policyname, with_check from pg_policies
 where schemaname = 'public' and tablename = 'club_miembros' and cmd = 'INSERT';
-- Lesiones de un jugador que hoy es de otro club: las de un jugador que se
-- pasó de club después están bien; si aparece alguna más, mirarla a mano.
select l.equipo_id as club_de_la_lesion, j.equipo_id as club_del_jugador, count(*) as lesiones
  from public.lesiones l
  join public.jugadores j on j.id = l.jugador_id
 where j.equipo_id <> l.equipo_id
 group by 1, 2;
