-- =====================================================================
-- Revisión para 20261014_duenos_y_pedidos.sql. Solo consultas: no cambia
-- nada. Se corre ANTES (para completar los marcadores y ver si algo va a
-- frenar la revisión final) y se puede correr DESPUÉS.
--
-- Antes de correr la migración, anotar:
--   · el correo exacto del dueño principal y de los sub-dueños (tienen que
--     tener el correo confirmado; el principal, uno de los que hoy tienen
--     admin = true);
--   · el nombre exacto del club del token de Catapult;
--   · si algo aparece en las últimas consultas (permisos de anon, TRUNCATE
--     de authenticated, tablas sin RLS, vistas sin security_invoker,
--     funciones que no son del repositorio): la migración se frenaría.
-- =====================================================================

-- Las cuentas: estado, si hoy son dueñas (admin) y si confirmaron el correo.
select p.email, p.estado, p.admin, p.confirmado_en, p.creado_en
  from public.perfiles p
 order by p.admin desc, p.email;

-- Los clubes, con el nombre tal como está (para el club del token).
select e.nombre, e.zona_horaria, e.creado_en
  from public.equipos e
 order by e.nombre;

-- Quién está o estuvo en cada club, con su rol y sus módulos.
select e.nombre as club, p.email, p.estado as cuenta, m.rol, m.desde, m.hasta,
       m.partido, m.flujo, m.lesiones, m.evaluaciones
  from public.club_miembros m
  join public.equipos e on e.id = m.equipo_id
  join public.perfiles p on p.user_id = m.user_id
 order by e.nombre, m.hasta nulls first, m.rol, p.email;

-- Los administradores activos de cada club (cuenta = 'autorizado' es la que
-- puede actuar).
select e.nombre as club, p.email, p.estado as cuenta
  from public.club_miembros m
  join public.equipos e on e.id = m.equipo_id
  join public.perfiles p on p.user_id = m.user_id
 where m.rol = 'admin' and m.hasta is null
 order by e.nombre, p.email;

-- Membresías que el club nunca decidió: el alta la puso la base sola (la
-- semilla de octubre) o la misma cuenta (al crear un club desde la app), y
-- nadie más la tocó después. Si es de un dueño en un club donde no trabaja,
-- conviene borrarla aparte.
select e.nombre as club, p.email, m.rol, m.hasta
  from public.club_miembros m
  join public.equipos e on e.id = m.equipo_id
  join public.perfiles p on p.user_id = m.user_id
 where exists (select 1 from public.club_miembros_historial h
                where h.equipo_id = m.equipo_id and h.user_id = m.user_id and h.accion = 'alta'
                  and (h.quien is null or h.quien = m.user_id))
   and not exists (select 1 from public.club_miembros_historial h
                    where h.equipo_id = m.equipo_id and h.user_id = m.user_id and h.accion <> 'alta'
                      and h.quien is not null and h.quien <> m.user_id)
 order by e.nombre, p.email;

-- Las invitaciones abiertas (sin usar ni cancelar).
select e.nombre as club, i.email, i.rol, i.creado_en, i.vence_en, i.vence_en < now() as vencida
  from public.club_invitaciones i
  join public.equipos e on e.id = i.equipo_id
 where i.usada_en is null and i.cancelada_en is null
 order by e.nombre, i.email;

-- Lo que anon puede hacer en public (tiene que quedar vacío).
select 'tabla o vista' as que, c.relname as nombre
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
   and (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'))
union all
select 'secuencia', c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'S'
   -- Con case: si no, se pregunta por una relación que no es secuencia.
   and case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'USAGE, SELECT, UPDATE') else false end
union all
select 'función', p.oid::regprocedure::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
 order by 1, 2;

-- TRUNCATE, REFERENCES o TRIGGER de authenticated (la migración los saca;
-- si alguno es de una tabla que no es del rol postgres, frenaría).
select c.relname, pg_get_userbyid(c.relowner) as duena
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
   and has_table_privilege('authenticated', c.oid, 'TRUNCATE, REFERENCES, TRIGGER')
 order by 1;

-- Tablas sin RLS y vistas sin security_invoker (tienen que quedar vacías).
select 'tabla sin RLS' as que, c.relname as nombre
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
union all
select 'vista sin security_invoker', c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and not coalesce(c.reloptions, '{}') && array['security_invoker=true', 'security_invoker=on', 'security_invoker=1', 'security_invoker=yes']
 order by 1, 2;

-- Funciones de public que no son del repositorio (pueden ser de una prueba
-- vieja o de una extensión): mirarlas antes de correr la migración.
select p.oid::regprocedure as funcion, pg_get_userbyid(p.proowner) as duena
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname not in (
     'acceso_club', 'aceptar_pedido', 'agregar_subdueno', 'anotar_version', 'aplicar_invitaciones',
     'asignar_entidad', 'cancelar_pedido', 'club_invitaciones_aplicar', 'club_invitaciones_preparar',
     'club_miembros_anotar', 'club_miembros_historial_anotar', 'club_miembros_proteger_principal',
     'club_miembros_ultimo_admin', 'crear_club', 'datos_al_dia', 'derivar_pedido', 'equipos_sumar_creador',
     'equipos_validar_zona', 'es_admin', 'es_admin_de_club', 'es_dueno', 'es_dueno_principal', 'esta_autorizado',
     'evaluaciones_preparar', 'fecha_segura', 'lesiones_etiqueta', 'lesiones_historial_anotar',
     'lesiones_horas_imagen', 'lesiones_numerar_caso', 'lesiones_preparar', 'mi_cuenta', 'mis_pedidos',
     'normalizar_nombre_club', 'panel_clubes', 'panel_duenos', 'panel_historial', 'pedidos_del_club',
     'pedidos_sin_club', 'pedir_acceso', 'perfiles_alta_usuario', 'perfiles_anotar_decision',
     'perfiles_proteger_principal', 'perfiles_sincronizar_usuario', 'plataforma_anotar', 'plataforma_cuidar',
     'puede_editar', 'puede_usar', 'puede_usar_catapult_servidor', 'puede_usar_en', 'puede_ver',
     'puede_ver_fecha', 'quitar_subdueno', 'rechazar_pedido', 'rechazar_pedido_sin_club', 'salir_del_club',
     'traspasar_principal', 'zona_del_club')
 order by 1;
