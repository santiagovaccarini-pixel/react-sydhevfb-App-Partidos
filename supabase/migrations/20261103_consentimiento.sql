-- =====================================================================
-- Consentimiento de los atletas (Santiago, 18/10: «Los clubes deben
-- confirmar que tienen el consentimiento de los atletas (o de sus tutores
-- si son menores de edad) para subir sus datos»; en un cuestionario: «Una
-- vez por club»; los jugadores ya cargados, «Quedan todos confirmados»;
-- las personas fuera de Datos básicos, «Confirmar al cargar el archivo»;
-- el documento firmado lo guarda el club; mientras no confirme, «No se
-- cargan hasta confirmar»; confirma el administrador, y la entidad cuando
-- su cuenta quede vinculada al club, en el paso 3).
--
--   · consentimientos: cada confirmación, con lo que se aceptó (el texto,
--     tal como se mostró), quién, como qué y cuándo (lo pone la base). No se
--     cambia ni se borra desde la app. Dos alcances:
--       - 'club': el club confirma una vez que tiene el consentimiento de
--         todos sus atletas (o de sus tutores). La hace el administrador.
--       - 'personas': al cargar un archivo con personas que no están en
--         Datos básicos, quien lo carga confirma las de ese archivo, por
--         nombre (vale para todo el club). Las que ya estaban cargadas
--         quedan confirmadas acá, sin nombre de quien confirmó.
--     La ven: la del club, todos los del club; la de personas, quien sigue
--     en el club con esa base (quien se fue no ve las que vinieron después).
--   · Sin la confirmación del club, la base no deja cargar datos nuevos de
--     atletas: jugadores, lesiones, evaluaciones, GPS ni cargas de GPS en
--     curso (falta_consentimiento). Una lesión, evaluación o fila de GPS de
--     una persona fuera de Datos básicos pide además su confirmación
--     (falta_consentimiento_persona). Lo que ya está se sigue viendo y
--     cambiando. Desde el SQL Editor (sin cuenta), no se frena.
--
-- Requiere 20261102_aislamiento_entre_clubes.sql. Se corre en Supabase >
-- SQL Editor, entera y de una vez. No cambia ningún dato. Se puede volver a
-- correr.
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.huecos_entre_clubes()') is null then
    raise exception 'Primero hay que correr 20261102_aislamiento_entre_clubes.sql.';
  end if;
end $$;

-- ------------------------------------------------- Las confirmaciones --

create table if not exists public.consentimientos (
  id               uuid primary key default gen_random_uuid(),
  equipo_id        uuid not null references public.equipos (id) on delete cascade,
  alcance          text not null check (alcance in ('club', 'personas')),
  base             text check (base in ('lesiones', 'evaluaciones', 'gps')),
  personas         text[] not null default '{}',
  texto            text not null,
  confirmado_como  text check (confirmado_como in ('administrador', 'entidad', 'carga')),
  confirmado_por   uuid references auth.users (id) on delete set null,
  confirmado_email text not null default '',
  confirmado_en    timestamptz not null default now(),
  constraint consentimientos_alcance check (
    (alcance = 'club' and base is null and cardinality(personas) = 0)
    or (alcance = 'personas' and base is not null and cardinality(personas) > 0)),
  constraint consentimientos_texto check (char_length(btrim(texto)) between 1 and 4000)
);

create index if not exists consentimientos_club on public.consentimientos (equipo_id, alcance);

comment on table public.consentimientos is
  'Consentimiento de los atletas (20261103): la confirmación del club (una vez) y la de las personas fuera de Datos básicos (por archivo). No se cambia ni se borra desde la app.';

-- El nombre de una persona como se compara (como la app lo guarda, sin
-- mayúsculas).
create or replace function public.persona_normalizada(p_persona text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(regexp_replace(coalesce(p_persona, ''), '\s+', ' ', 'g')));
$$;

-- Quién, como qué y cuándo lo pone la base; los nombres, sin repetir.
create or replace function public.consentimientos_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.personas := coalesce((select array_agg(distinct btrim(regexp_replace(x, '\s+', ' ', 'g')))
                              from unnest(new.personas) as x
                             where btrim(coalesce(x, '')) <> ''), '{}');
  if auth.uid() is not null then
    new.id := gen_random_uuid();
    new.confirmado_por := auth.uid();
    new.confirmado_email := coalesce((select u.email from auth.users u where u.id = auth.uid()), '');
    new.confirmado_en := now();
    new.confirmado_como := case new.alcance when 'club' then 'administrador' else 'carga' end;
  end if;
  return new;
end;
$$;

drop trigger if exists consentimientos_preparar on public.consentimientos;
create trigger consentimientos_preparar
  before insert on public.consentimientos
  for each row execute function public.consentimientos_preparar();

-- Permisos justos: nada para anon; se agrega y se lee, no se cambia ni se borra.
alter table public.consentimientos enable row level security;
revoke all on table public.consentimientos from public, anon, authenticated;
grant select, insert on table public.consentimientos to authenticated;

drop policy if exists consentimientos_ver on public.consentimientos;
create policy consentimientos_ver on public.consentimientos
  for select to authenticated
  using (case alcance
           when 'club' then public.puede_ver(equipo_id)
           else public.puede_usar_en(equipo_id, base) and public.puede_editar(equipo_id)
         end);

-- La del club, el administrador (la entidad, cuando su cuenta quede
-- vinculada al club); la de personas, quien carga en esa base.
drop policy if exists consentimientos_confirmar on public.consentimientos;
create policy consentimientos_confirmar on public.consentimientos
  for insert to authenticated
  with check (case alcance
                when 'club' then public.es_admin_de_club(equipo_id)
                else public.puede_editar_en(equipo_id, base)
              end);

-- ----------------------------------------- Sin confirmar, no se carga --

create or replace function public.club_con_consentimiento(p_equipo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.consentimientos c
                  where c.equipo_id = p_equipo and c.alcance = 'club');
$$;

create or replace function public.persona_con_consentimiento(p_equipo uuid, p_persona text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.consentimientos c, unnest(c.personas) as x
                  where c.equipo_id = p_equipo and c.alcance = 'personas'
                    and public.persona_normalizada(x) = public.persona_normalizada(p_persona));
$$;

create or replace function public.exigir_consentimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona text := nullif(btrim(coalesce(to_jsonb(new) ->> 'persona', '')), '');
begin
  -- Desde el SQL Editor (sin cuenta), como en el resto de las reglas. A
  -- quien no sigue en el club lo frenan sus reglas (y no se entera de si el
  -- club confirmó).
  if auth.uid() is null or not public.puede_editar(new.equipo_id) then
    return new;
  end if;
  if tg_op = 'INSERT' and not public.club_con_consentimiento(new.equipo_id) then
    raise exception 'falta_consentimiento' using errcode = 'P0001',
      hint = 'El administrador del club tiene que confirmar el consentimiento de los atletas.';
  end if;
  if v_persona is not null
     and (tg_op = 'INSERT' or v_persona is distinct from nullif(btrim(coalesce(to_jsonb(old) ->> 'persona', '')), ''))
     and not public.persona_con_consentimiento(new.equipo_id, v_persona) then
    raise exception 'falta_consentimiento_persona' using errcode = 'P0001',
      hint = 'Falta confirmar el consentimiento de esa persona al cargar el archivo.';
  end if;
  return new;
end;
$$;

-- Solo la usan los disparadores.
revoke execute on function public.persona_normalizada(text), public.consentimientos_preparar(),
  public.club_con_consentimiento(uuid), public.persona_con_consentimiento(uuid, text),
  public.exigir_consentimiento() from public, anon, authenticated;

drop trigger if exists exigir_consentimiento on public.jugadores;
create trigger exigir_consentimiento
  before insert on public.jugadores
  for each row execute function public.exigir_consentimiento();

drop trigger if exists exigir_consentimiento on public.gps_en_curso;
create trigger exigir_consentimiento
  before insert on public.gps_en_curso
  for each row execute function public.exigir_consentimiento();

drop trigger if exists exigir_consentimiento on public.lesiones;
create trigger exigir_consentimiento
  before insert or update of persona on public.lesiones
  for each row execute function public.exigir_consentimiento();

drop trigger if exists exigir_consentimiento on public.evaluaciones;
create trigger exigir_consentimiento
  before insert or update of persona on public.evaluaciones
  for each row execute function public.exigir_consentimiento();

drop trigger if exists exigir_consentimiento on public.gps;
create trigger exigir_consentimiento
  before insert or update of persona on public.gps
  for each row execute function public.exigir_consentimiento();

-- ------------------------- Las personas que ya estaban, confirmadas --
-- Una fila por club y base con las que todavía no estén (al volver a
-- correrla, ninguna).

insert into public.consentimientos (equipo_id, alcance, base, personas, texto)
select x.equipo_id, 'personas', x.base, array_agg(distinct x.persona order by x.persona),
       'Ya estaban cargadas antes de pedir el consentimiento (20261103).'
  from (select l.equipo_id, 'lesiones' as base, btrim(regexp_replace(l.persona, '\s+', ' ', 'g')) as persona
          from public.lesiones l where btrim(coalesce(l.persona, '')) <> ''
        union
        select e.equipo_id, 'evaluaciones', btrim(regexp_replace(e.persona, '\s+', ' ', 'g'))
          from public.evaluaciones e where btrim(coalesce(e.persona, '')) <> ''
        union
        select g.equipo_id, 'gps', btrim(regexp_replace(g.persona, '\s+', ' ', 'g'))
          from public.gps g where btrim(coalesce(g.persona, '')) <> '') x
 where not public.persona_con_consentimiento(x.equipo_id, x.persona)
 group by x.equipo_id, x.base;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.consentimientos'::regclass) then
    raise exception 'consentimientos quedó sin RLS.';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'consentimientos') <> 2 then
    raise exception 'consentimientos no tiene sus dos políticas.';
  end if;
  if has_table_privilege('authenticated', 'public.consentimientos', 'UPDATE, DELETE, TRUNCATE')
     or has_any_column_privilege('anon', 'public.consentimientos', 'SELECT, INSERT, UPDATE') then
    raise exception 'consentimientos solo se agrega y se lee, y anon no la toca.';
  end if;
  if (select count(*) from pg_trigger where tgname = 'exigir_consentimiento' and not tgisinternal) <> 5 then
    raise exception 'Faltan los disparadores que piden el consentimiento.';
  end if;
  if exists (select 1 from public.huecos_entre_clubes()) then
    raise exception 'Quedaron huecos entre clubes: select * from public.huecos_entre_clubes();';
  end if;
end $$;

commit;

-- Que la app vea la tabla nueva sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: cada club, si ya confirmó y cuántas personas de
-- afuera quedaron confirmadas.
select e.nombre as club,
       exists (select 1 from public.consentimientos c where c.equipo_id = e.id and c.alcance = 'club') as club_confirmo,
       (select count(*) from public.consentimientos c, unnest(c.personas) where c.equipo_id = e.id and c.alcance = 'personas') as personas_confirmadas
  from public.equipos e
 order by e.nombre;
