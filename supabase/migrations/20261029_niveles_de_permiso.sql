-- =====================================================================
-- Niveles de permiso por módulo (Santiago, 17/10: «Vamos a implementar un
-- nivel mas de permisos para cada modulo (Solo Lectura y Edicion) solo
-- lectura no deja editar nada y edicion si»; en Cuentas, «Un desplegable por
-- módulo»; quien tiene «Solo lectura» «Puede ver todo, siempre que tenga los
-- permisos pero no puede editar nada»; Datos básicos, «Deja eso para el
-- final»: sigue como estaba).
--
--   · club_miembros.solo_lectura y club_invitaciones.solo_lectura: los
--     módulos (partido, flujo, lesiones, evaluaciones, gps) que la cuenta
--     tiene para mirar. Vacío (como quedan todos al correrla): Edición en
--     todo lo que tiene, como hasta ahora. Tener el módulo sigue siendo su
--     columna de siempre (partido, flujo, …): sin el módulo, no lo ve.
--   · puede_editar_en(club, módulo) y clubes_donde_edito(módulo): tiene el
--     módulo, sigue en el club y no lo tiene en solo lectura.
--   · Cargar, cambiar y borrar en Partido, Flujo diario, Lesiones,
--     Evaluaciones y GPS (también sus Ajustes, V.R., cargas sin terminar y
--     el dispositivo recordado) piden además Edición: una política
--     restrictiva por tabla y por acción, que se suma a las de siempre (no
--     las reemplaza). Leer no cambia. Las columnas del jugador que Lesiones
--     comparte con Datos básicos siguen como en 20261028 (las cambia
--     cualquiera que sigue en el club).
--   · Las vistas de los clubes (v_mis_clubes) y de la gente de cada club
--     (v_miembros_club) suman solo_lectura; las invitaciones la pasan a la
--     membresía; aceptar un pedido la recibe; el historial anota sus cambios
--     como un cambio de módulos; a los dueños de la app nadie del club se la
--     cambia.
--   · mi_cuenta suma flujo_edita: el servidor solo deja mandar cortes a
--     Catapult a quien tiene Flujo diario con Edición en el club del token.
--
-- Requiere 20261028_datos_basicos_ajustes.sql. Se corre en Supabase > SQL
-- Editor, entera y de una vez. Solo agrega: la app de antes sigue andando
-- (todos quedan con Edición). Se puede volver a correr. Después de esta,
-- 20261016_gps.sql ya no se vuelve a correr (se frena sola: desharía los
-- niveles en las vistas, las invitaciones y los pedidos).
-- =====================================================================

begin;

do $$
begin
  if to_regprocedure('public.es_columna_de_datos_basicos(text)') is null or to_regprocedure('public.clubes_donde_puedo(text)') is null then
    raise exception 'Primero hay que correr 20261028_datos_basicos_ajustes.sql.';
  end if;
end $$;

-- ------------------------------------------------------------ El nivel --

alter table public.club_miembros
  add column if not exists solo_lectura text[] not null default '{}';
alter table public.club_invitaciones
  add column if not exists solo_lectura text[] not null default '{}';

alter table public.club_miembros drop constraint if exists club_miembros_solo_lectura_valida;
alter table public.club_miembros
  add constraint club_miembros_solo_lectura_valida
  check (solo_lectura <@ array['partido', 'flujo', 'lesiones', 'evaluaciones', 'gps']::text[]);
alter table public.club_invitaciones drop constraint if exists club_invitaciones_solo_lectura_valida;
alter table public.club_invitaciones
  add constraint club_invitaciones_solo_lectura_valida
  check (solo_lectura <@ array['partido', 'flujo', 'lesiones', 'evaluaciones', 'gps']::text[]);

comment on column public.club_miembros.solo_lectura is
  'Los módulos que esta cuenta tiene en este club solo para mirar (Solo lectura). Los demás que tiene, con Edición.';
comment on column public.club_invitaciones.solo_lectura is
  'Los módulos con los que entra solo para mirar (Solo lectura).';

-- El admin del club lo cambia como los módulos (las mismas políticas).
grant update (solo_lectura) on table public.club_miembros to authenticated;
grant insert (solo_lectura) on table public.club_invitaciones to authenticated;

-- Tiene el módulo en ese club, sigue y lo tiene con Edición.
create or replace function public.puede_editar_en(p_equipo uuid, p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.esta_autorizado()
     and exists (select 1 from public.club_miembros m
                  where m.equipo_id = p_equipo and m.user_id = auth.uid() and m.hasta is null
                    and not (p_modulo = any (m.solo_lectura))
                    and case p_modulo
                          when 'partido' then m.partido
                          when 'flujo' then m.flujo
                          when 'lesiones' then m.lesiones
                          when 'evaluaciones' then m.evaluaciones
                          when 'gps' then m.gps
                          else false end);
$$;

comment on function public.puede_editar_en(uuid, text) is
  'Tiene el módulo en ese club, sigue en el club y lo tiene con Edición (no en solo lectura).';

-- Los clubes donde la cuenta carga y cambia en ese módulo. Para las
-- políticas: se revisa una vez por pedido, no en cada fila.
create or replace function public.clubes_donde_edito(p_modulo text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.equipo_id
    from public.club_miembros m
   where m.user_id = auth.uid()
     and public.puede_editar_en(m.equipo_id, p_modulo);
$$;

comment on function public.clubes_donde_edito(text) is
  'Los clubes donde la cuenta tiene el módulo con Edición y sigue en el club.';

-- Las políticas las usan con la cuenta de quien pide: se sacan de PUBLIC y
-- se dan solo a las cuentas.
revoke execute on function public.puede_editar_en(uuid, text), public.clubes_donde_edito(text) from public, anon;
grant execute on function public.puede_editar_en(uuid, text), public.clubes_donde_edito(text) to authenticated;

-- ------------------------------------- Cargar y cambiar piden Edición --
-- Una política restrictiva por tabla y por acción: se suma a las de siempre.

do $$
declare
  v record;
  v_condicion text;
begin
  for v in
    select * from (values
      ('registros_partido', 'partido'),
      ('entrenamientos', 'flujo'),
      ('lesiones', 'lesiones'),
      ('lesiones_campos', 'lesiones'),
      ('lesiones_opciones', 'lesiones'),
      ('lesiones_periodos', 'lesiones'),
      ('evaluaciones', 'evaluaciones'),
      ('evaluaciones_campos', 'evaluaciones'),
      ('evaluaciones_opciones', 'evaluaciones'),
      ('evaluaciones_referencias', 'evaluaciones'),
      ('gps', 'gps'),
      ('gps_campos', 'gps'),
      ('gps_opciones', 'gps'),
      ('gps_reglas', 'gps'),
      ('gps_referencias', 'gps'),
      ('gps_en_curso', 'gps'),
      ('gps_en_curso_datos', 'gps'),
      ('gps_preferencias', 'gps')
    ) as t (tabla, modulo)
  loop
    if to_regclass('public.' || v.tabla) is null then
      raise exception 'Falta la tabla %: corré antes las migraciones que la crean.', v.tabla;
    end if;
    v_condicion := case
      -- Las cargas sin terminar del GPS: lo que tiene, por la carga.
      when v.tabla = 'gps_en_curso_datos' then
        format('exists (select 1 from public.gps_en_curso c where c.id = en_curso_id and c.equipo_id in (select public.clubes_donde_edito(%L)))', v.modulo)
      -- Las columnas del jugador las cambia cualquiera del club (20261028).
      when v.tabla in ('lesiones_campos', 'lesiones_opciones') then
        format('(public.es_columna_de_datos_basicos(campo) or equipo_id in (select public.clubes_donde_edito(%L)))', v.modulo)
      else
        format('equipo_id in (select public.clubes_donde_edito(%L))', v.modulo)
    end;
    execute format('drop policy if exists %I on public.%I', v.tabla || '_nivel_crear', v.tabla);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)',
                   v.tabla || '_nivel_crear', v.tabla, v_condicion);
    execute format('drop policy if exists %I on public.%I', v.tabla || '_nivel_cambiar', v.tabla);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (%s) with check (%s)',
                   v.tabla || '_nivel_cambiar', v.tabla, v_condicion, v_condicion);
    execute format('drop policy if exists %I on public.%I', v.tabla || '_nivel_borrar', v.tabla);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (%s)',
                   v.tabla || '_nivel_borrar', v.tabla, v_condicion);
  end loop;
end $$;

-- ----------------------------------------- Las vistas, con el nivel --

create or replace view public.v_mis_clubes with (security_invoker = true) as
  select e.id,
         e.nombre,
         e.creado_en,
         m.desde,
         m.hasta,
         m.rol,
         m.partido,
         m.flujo,
         m.lesiones,
         m.evaluaciones,
         m.gps,
         coalesce(m.solo_lectura, '{}'::text[]) as solo_lectura
    from public.equipos e
    left join public.club_miembros m on m.equipo_id = e.id and m.user_id = auth.uid()
   order by e.nombre;

create or replace view public.v_miembros_club with (security_invoker = true) as
  select m.equipo_id,
         m.user_id,
         m.desde,
         m.hasta,
         m.rol,
         m.partido,
         m.flujo,
         m.lesiones,
         m.decidido_en,
         m.creado_en,
         p.email,
         p.estado,
         p.confirmado_en,
         m.evaluaciones,
         public.miembro_protegido(m.user_id) as protegido,
         m.gps,
         m.solo_lectura
    from public.club_miembros m
    join public.perfiles p on p.user_id = m.user_id;

-- ---------------------------------- Invitaciones, pedidos e historial --

-- La de 20261016, pasando también el nivel.
create or replace function public.aplicar_invitaciones(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_inv record;
  v_cuantas integer := 0;
begin
  select lower(btrim(u.email)) into v_email
    from auth.users u
   where u.id = p_user and u.email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return 0;
  end if;
  for v_inv in
    select * from public.club_invitaciones i
     where i.email = v_email and i.usada_en is null and i.cancelada_en is null and i.vence_en > now()
     order by i.creado_en
  loop
    insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones, gps, solo_lectura, decidido_por)
    values (v_inv.equipo_id, p_user, current_date, null, v_inv.rol, v_inv.partido, v_inv.flujo, v_inv.lesiones,
            v_inv.evaluaciones, v_inv.gps, coalesce(v_inv.solo_lectura, '{}'), v_inv.creado_por)
    on conflict (equipo_id, user_id) do update
      set desde = current_date, hasta = null, rol = excluded.rol, partido = excluded.partido,
          flujo = excluded.flujo, lesiones = excluded.lesiones,
          evaluaciones = excluded.evaluaciones, gps = excluded.gps, solo_lectura = excluded.solo_lectura,
          decidido_por = excluded.decidido_por
      where public.club_miembros.hasta is not null;
    update public.club_invitaciones set usada_en = now(), usada_por = p_user where id = v_inv.id;
    update public.club_pedidos
       set estado = 'aceptado', decidido_por = v_inv.creado_por, decidido_en = now()
     where user_id = p_user and equipo_id = v_inv.equipo_id and estado = 'abierto';
    v_cuantas := v_cuantas + 1;
  end loop;
  if v_cuantas > 0 then
    update public.perfiles set estado = 'autorizado' where user_id = p_user and estado = 'pendiente';
  end if;
  return v_cuantas;
end;
$$;

-- Aceptar un pedido con el nivel de cada módulo (la de 20261016 sin él se
-- reemplaza: con el nivel de último y vacío de entrada, se llama igual).
drop function if exists public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean, boolean);
create or replace function public.aceptar_pedido(p_id uuid, p_partido boolean, p_flujo boolean, p_lesiones boolean,
                                                 p_evaluaciones boolean, p_gps boolean default false,
                                                 p_solo_lectura text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.club_pedidos;
begin
  select * into v_pedido from public.club_pedidos cp where cp.id = p_id for update;
  if not found or v_pedido.equipo_id is null or not public.es_admin_de_club(v_pedido.equipo_id) then
    raise exception 'solo_admin' using errcode = '42501';
  end if;
  if v_pedido.estado <> 'abierto' then
    raise exception 'pedido_cerrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.perfiles pf where pf.user_id = v_pedido.user_id and pf.estado = 'bloqueado') then
    raise exception 'cuenta_bloqueada' using errcode = 'P0001';
  end if;
  -- Primero el pedido: así, si es un dueño que se había ido,
  -- club_miembros_proteger_duenos ve que volver lo pidió él.
  update public.club_pedidos set estado = 'aceptado', decidido_por = auth.uid(), decidido_en = now() where id = p_id;
  insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones, gps, solo_lectura)
  values (v_pedido.equipo_id, v_pedido.user_id, current_date, null, 'staff', coalesce(p_partido, false),
          coalesce(p_flujo, false), coalesce(p_lesiones, false), coalesce(p_evaluaciones, false), coalesce(p_gps, false),
          coalesce(p_solo_lectura, '{}'))
  on conflict (equipo_id, user_id) do update
    set desde = current_date, hasta = null, rol = 'staff', partido = excluded.partido, flujo = excluded.flujo,
        lesiones = excluded.lesiones, evaluaciones = excluded.evaluaciones, gps = excluded.gps,
        solo_lectura = excluded.solo_lectura
    where public.club_miembros.hasta is not null;
  update public.perfiles set estado = 'autorizado' where user_id = v_pedido.user_id and estado = 'pendiente';
end;
$$;

revoke execute on function public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean, boolean, text[]) from public, anon;
grant execute on function public.aceptar_pedido(uuid, boolean, boolean, boolean, boolean, boolean, text[]) to authenticated;

-- El historial: el nivel es parte de los módulos.
create or replace function public.club_miembros_historial_anotar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila record;
  v_quien uuid;
  v_email text;
  v_acciones text[] := '{}';
  v_detalle jsonb := '{}'::jsonb;
  v_accion text;
begin
  if tg_op = 'DELETE' then v_fila := old; else v_fila := new; end if;
  v_quien := coalesce(auth.uid(), case when tg_op = 'DELETE' then null else new.decidido_por end);
  select p.email into v_email from public.perfiles p where p.user_id = v_quien;

  if tg_op = 'INSERT' then
    v_acciones := array['alta'];
    v_detalle := jsonb_build_object('rol', new.rol, 'partido', new.partido, 'flujo', new.flujo,
                                    'lesiones', new.lesiones, 'evaluaciones', new.evaluaciones, 'gps', new.gps,
                                    'solo_lectura', to_jsonb(new.solo_lectura),
                                    'desde', new.desde, 'hasta', new.hasta);
  elsif tg_op = 'DELETE' then
    v_acciones := array['borrado'];
  else
    if old.hasta is null and new.hasta is not null then
      v_acciones := v_acciones || 'baja'::text;
      v_detalle := v_detalle || jsonb_build_object('hasta', new.hasta);
    elsif old.hasta is not null and new.hasta is null then
      v_acciones := v_acciones || 'reincorporacion'::text;
    elsif old.hasta is distinct from new.hasta then
      v_acciones := v_acciones || 'baja'::text;
      v_detalle := v_detalle || jsonb_build_object('hasta', new.hasta, 'hasta_antes', old.hasta);
    end if;
    if old.rol is distinct from new.rol then
      v_acciones := v_acciones || 'rol'::text;
      v_detalle := v_detalle || jsonb_build_object('rol', new.rol, 'rol_antes', old.rol);
    end if;
    if old.partido is distinct from new.partido or old.flujo is distinct from new.flujo
       or old.lesiones is distinct from new.lesiones or old.evaluaciones is distinct from new.evaluaciones
       or old.gps is distinct from new.gps or old.solo_lectura is distinct from new.solo_lectura then
      v_acciones := v_acciones || 'modulos'::text;
      v_detalle := v_detalle || jsonb_build_object('partido', new.partido, 'flujo', new.flujo, 'lesiones', new.lesiones,
                                                   'evaluaciones', new.evaluaciones, 'gps', new.gps,
                                                   'solo_lectura', to_jsonb(new.solo_lectura));
    end if;
  end if;

  foreach v_accion in array v_acciones loop
    insert into public.club_miembros_historial (equipo_id, user_id, accion, detalle, quien, quien_email)
    values (v_fila.equipo_id, v_fila.user_id, v_accion, v_detalle, v_quien, coalesce(v_email, ''));
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- A los dueños de la app nadie del club les cambia el nivel tampoco.
create or replace function public.club_miembros_proteger_duenos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() = old.user_id
     or not (exists (select 1 from public.plataforma p where p.dueno_principal = old.user_id)
             or exists (select 1 from public.plataforma_subduenos s where s.user_id = old.user_id)) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Se está borrando el club entero: no hay nada que cuidar.
    if not exists (select 1 from public.equipos e where e.id = old.equipo_id) then
      return old;
    end if;
    raise exception 'dueno_protegido' using errcode = 'P0001';
  end if;
  if old.hasta is not null and new.hasta is null
     and exists (select 1 from public.club_pedidos cp
                  where cp.user_id = old.user_id and cp.equipo_id = old.equipo_id and cp.estado = 'aceptado'
                    and cp.decidido_por = auth.uid() and cp.decidido_en = now()) then
    return new;
  end if;
  if (new.hasta, new.rol, new.desde, new.creado_en) is distinct from (old.hasta, old.rol, old.desde, old.creado_en)
     or (new.partido, new.flujo, new.lesiones, new.evaluaciones, new.gps, new.solo_lectura)
        is distinct from (old.partido, old.flujo, old.lesiones, old.evaluaciones, old.gps, old.solo_lectura) then
    raise exception 'dueno_protegido' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Los disparadores no se ejecutan desde la API.
revoke execute on function public.club_miembros_historial_anotar(), public.club_miembros_proteger_duenos(),
                           public.aplicar_invitaciones(uuid)
  from public, anon, authenticated;

-- ------------------------------------------------ El servidor (Catapult) --
-- mi_cuenta suma flujo_edita (al final): Flujo diario con Edición en el
-- club del token de Catapult. Sin eso, el servidor no manda cortes.

drop function if exists public.mi_cuenta();
create function public.mi_cuenta()
returns table (estado text, dueno text, flujo boolean, catapult boolean, tecnico boolean, flujo_edita boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select pf.estado from public.perfiles pf where pf.user_id = auth.uid()), 'pendiente'),
         case when public.es_dueno_principal() then 'principal'
              when public.es_dueno() then 'sub' end,
         public.puede_usar('flujo'),
         public.puede_usar_catapult_servidor(),
         public.es_dueno_principal() and public.puede_usar_catapult_servidor(),
         public.puede_usar_catapult_servidor()
           and exists (select 1 from public.plataforma p
                         join public.club_miembros m on m.equipo_id = p.catapult_equipo
                        where m.user_id = auth.uid() and m.hasta is null and m.flujo
                          and not ('flujo' = any (m.solo_lectura)));
$$;

revoke execute on function public.mi_cuenta() from public, anon;
grant execute on function public.mi_cuenta() to authenticated;

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public' and policyname like '%\_nivel\_%' and permissive = 'RESTRICTIVE') <> 54 then
    raise exception 'Faltan políticas de nivel (tienen que ser 54: 18 tablas por crear, cambiar y borrar).';
  end if;
  if has_function_privilege('anon', 'public.puede_editar_en(uuid, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.clubes_donde_edito(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.mi_cuenta()', 'EXECUTE') then
    raise exception 'anon no puede ejecutar las funciones del nivel.';
  end if;
end $$;

commit;

-- Que la app vea las columnas nuevas sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: cuántas cuentas tienen algo en solo lectura
-- (al correrla por primera vez, ninguna) y las políticas de nivel.
select (select count(*) from public.club_miembros where solo_lectura <> '{}') as cuentas_con_solo_lectura,
       (select count(*) from pg_policies where schemaname = 'public' and policyname like '%\_nivel\_%') as politicas_de_nivel;
