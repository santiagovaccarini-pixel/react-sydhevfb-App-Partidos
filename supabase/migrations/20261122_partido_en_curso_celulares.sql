-- =====================================================================
-- Partido compartido entre celulares, parte 4c (paso 4 de la nota «cargar
-- sin señal y a la vez que otra persona»; Santiago, 23/10, en cuestionarios:
-- sin señal, un «Aviso chico en el partido»; al volver, avisa «Solo si se
-- pisó algo»; «Guardar partido» no guarda hasta que se junte lo de todos los
-- celulares: si otro celular sumado no se conecta hace más de un minuto,
-- «Espera, con "Guardar igual"»).
--
--   · partidos_en_curso_celulares: los celulares sumados a cada partido en
--     curso y cuándo se supo de cada uno por última vez. Un celular sin señal
--     no puede avisar que tiene algo sin subir; lo que se sabe es desde
--     cuándo no se conecta. Quién y cuándo lo pone la base (con su hora, no
--     la del celular). Lo ve quien tiene Partido en el club; lo anota quien
--     lo tiene con Edición. No va en vivo (Realtime): se lee al anotarse.
--   · partido_en_curso_celulares: este celular avisa que sigue (o que se fue,
--     con p_sumado en false: «Limpiar» o sumarse a otro) y trae los del
--     partido, con los segundos desde que se supo de cada uno.
--
-- Requiere 20261120_partido_en_curso.sql. Se corre en Supabase > SQL Editor,
-- entera y de una vez. Solo agrega: la app de antes sigue andando. Se puede
-- volver a correr.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('public.partidos_en_curso') is null then
    raise exception 'Primero hay que correr 20261120_partido_en_curso.sql.';
  end if;
end $$;

create table if not exists public.partidos_en_curso_celulares (
  partido_id uuid not null references public.partidos_en_curso (id) on delete cascade,
  celular    text not null,
  equipo_id  uuid not null references public.equipos (id) on delete cascade,
  sumado     boolean not null default true,
  usuario_id uuid references auth.users (id) on delete set null,
  email      text not null default '',
  visto_en   timestamptz not null default now(),
  constraint partidos_en_curso_celulares_pkey primary key (partido_id, celular),
  constraint partidos_en_curso_celulares_celular check (celular ~ '^[A-Za-z0-9_-]{8,64}$')
);

comment on table public.partidos_en_curso_celulares is
  'Los celulares sumados a cada partido en curso y cuándo se supo de cada uno por última vez (para que «Guardar partido» espere lo de los que no se conectan).';

-- El club es el del partido; quién y cuándo, la base. El partido y el
-- celular no cambian.
create or replace function public.partidos_en_curso_celulares_preparar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.equipo_id := (select p.equipo_id from public.partidos_en_curso p where p.id = new.partido_id);
  else
    new.partido_id := old.partido_id;
    new.celular := old.celular;
    new.equipo_id := old.equipo_id;
  end if;
  new.usuario_id := auth.uid();
  new.email := coalesce((select u.email from auth.users u where u.id = auth.uid()), '');
  new.visto_en := now();
  return new;
end;
$$;
revoke execute on function public.partidos_en_curso_celulares_preparar() from public, anon, authenticated;

drop trigger if exists partidos_en_curso_celulares_preparar on public.partidos_en_curso_celulares;
create trigger partidos_en_curso_celulares_preparar
  before insert or update on public.partidos_en_curso_celulares
  for each row execute function public.partidos_en_curso_celulares_preparar();

-- Permisos justos: nada para anon; las cuentas leen, se anotan y dicen si
-- siguen sumadas. Las políticas dicen quién.
alter table public.partidos_en_curso_celulares enable row level security;
revoke all on table public.partidos_en_curso_celulares from public, anon, authenticated;
grant select on table public.partidos_en_curso_celulares to authenticated;
grant insert (partido_id, celular, sumado) on table public.partidos_en_curso_celulares to authenticated;
grant update (sumado) on table public.partidos_en_curso_celulares to authenticated;

drop policy if exists partidos_en_curso_celulares_ver on public.partidos_en_curso_celulares;
create policy partidos_en_curso_celulares_ver on public.partidos_en_curso_celulares
  for select to authenticated
  using (equipo_id in (select public.clubes_donde_puedo('partido')));

drop policy if exists partidos_en_curso_celulares_anotar on public.partidos_en_curso_celulares;
create policy partidos_en_curso_celulares_anotar on public.partidos_en_curso_celulares
  for insert to authenticated
  with check (equipo_id in (select public.clubes_donde_edito('partido')));

drop policy if exists partidos_en_curso_celulares_cambiar on public.partidos_en_curso_celulares;
create policy partidos_en_curso_celulares_cambiar on public.partidos_en_curso_celulares
  for update to authenticated
  using (equipo_id in (select public.clubes_donde_edito('partido')))
  with check (equipo_id in (select public.clubes_donde_edito('partido')));

-- Este celular sigue (o se fue) y los del partido, el último visto primero,
-- con los segundos desde que se supo de cada uno (la hora de la base).
create or replace function public.partido_en_curso_celulares(
  p_id uuid,
  p_celular text,
  p_sumado boolean default true
)
returns table (celular text, email text, sumado boolean, segundos integer)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_celular is null or p_celular !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'partido_en_curso_celular' using errcode = 'P0001';
  end if;
  -- Si ya no está (o no se ve), lo borraron.
  perform 1 from public.partidos_en_curso p where p.id = p_id;
  if not found then
    raise exception 'partido_en_curso_no_esta' using errcode = 'P0001';
  end if;

  insert into public.partidos_en_curso_celulares as c (partido_id, celular, sumado)
  values (p_id, p_celular, coalesce(p_sumado, true))
  on conflict on constraint partidos_en_curso_celulares_pkey
  do update set sumado = excluded.sumado;

  return query
    select c.celular, c.email, c.sumado,
           greatest(0, floor(extract(epoch from now() - c.visto_en)))::integer
      from public.partidos_en_curso_celulares c
     where c.partido_id = p_id
     order by c.visto_en desc
     limit 50;
end;
$$;

revoke execute on function public.partido_en_curso_celulares(uuid, text, boolean) from public, anon;
grant execute on function public.partido_en_curso_celulares(uuid, text, boolean) to authenticated;

-- Antes de guardar, que haya quedado bien.
do $$
declare
  v_huecos text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.partidos_en_curso_celulares'::regclass) then
    raise exception 'partidos_en_curso_celulares quedó sin reglas.';
  end if;
  if has_any_column_privilege('anon', 'public.partidos_en_curso_celulares', 'SELECT, INSERT, UPDATE')
     or has_table_privilege('anon', 'public.partidos_en_curso_celulares', 'DELETE') then
    raise exception 'anon no puede tener permisos en partidos_en_curso_celulares.';
  end if;
  if has_function_privilege('anon', 'public.partido_en_curso_celulares(uuid, text, boolean)', 'EXECUTE') then
    raise exception 'anon no puede anotar celulares.';
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
select to_regclass('public.partidos_en_curso_celulares') as tabla,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'partidos_en_curso_celulares') as reglas,
       to_regprocedure('public.partido_en_curso_celulares(uuid, text, boolean)') as funcion;
