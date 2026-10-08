-- =====================================================================
-- Escenarios de cuentas y permisos, contra la base de verdad.
--
-- Dos clubes y una cuenta para cada caso. Cada línea entra como una cuenta
-- (el "sub" del JWT, como hace Supabase) y comprueba qué ve y qué puede
-- cambiar. Si algo no da lo esperado, se corta con FALLA y el motivo.
-- =====================================================================

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ------------------------------------------------------- Herramientas --

create schema if not exists pruebas;
grant usage on schema pruebas to anon, authenticated;

create or replace function pruebas.esperar(p_que text, p_obtenido bigint, p_esperado bigint)
returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'FALLA: % (se esperaba %, salió %)', p_que, p_esperado, p_obtenido;
  end if;
end $$;

create or replace function pruebas.esperar(p_que text, p_obtenido text, p_esperado text)
returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'FALLA: % (se esperaba %, salió %)', p_que, p_esperado, p_obtenido;
  end if;
end $$;

-- Cuántas filas tocó una sentencia (con permisos de quien la corre).
create or replace function pruebas.filas(p_sql text)
returns bigint language plpgsql as $$
declare v bigint;
begin
  execute p_sql;
  get diagnostics v = row_count;
  return v;
end $$;

-- El error de una sentencia que tiene que fallar; null si no falló.
create or replace function pruebas.error(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

create or replace function pruebas.debe_fallar(p_que text, p_sql text, p_motivo text default null)
returns void language plpgsql as $$
declare v text := pruebas.error(p_sql);
begin
  if v is null then
    raise exception 'FALLA: % (tenía que fallar y no falló)', p_que;
  end if;
  if p_motivo is not null and position(p_motivo in v) = 0 then
    raise exception 'FALLA: % (falló por otra cosa: %)', p_que, v;
  end if;
end $$;

-- Entrar como una cuenta: el "sub" del JWT, como lo pone Supabase.
create or replace function pruebas.ser(p_email text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text,
    false);
end $$;

grant execute on all functions in schema pruebas to anon, authenticated;

-- ------------------------------------------------------------ El elenco --

insert into public.equipos (id, nombre) values
  ('00000000-0000-0000-0000-0000000000c1', 'Club Uno'),
  ('00000000-0000-0000-0000-0000000000c2', 'Club Dos');

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@uno.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'beto@uno.com', now()),
  ('00000000-0000-0000-0000-00000000000c', 'carla@uno.com', now()),
  ('00000000-0000-0000-0000-00000000000d', 'dario@uno.com', now()),
  ('00000000-0000-0000-0000-00000000000e', 'eva@dos.com', now()),
  ('00000000-0000-0000-0000-00000000000f', 'fede@libre.com', now()),
  ('00000000-0000-0000-0000-000000000010', 'gaby@uno.com', now()),
  ('00000000-0000-0000-0000-000000000011', 'hugo@nuevo.com', null);

update public.perfiles set estado = 'autorizado'
 where email in ('ana@uno.com', 'beto@uno.com', 'carla@uno.com', 'dario@uno.com', 'eva@dos.com');
update public.perfiles set estado = 'bloqueado' where email = 'gaby@uno.com';

-- Ana administra Uno; Beto es staff de Partido y Flujo; Carla, médica (solo
-- Lesiones); Darío estuvo en Uno hasta el 31/03 y hoy está en Dos; Eva
-- administra Dos; Gaby está en Uno pero su cuenta está bloqueada.
insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', '2026-01-01', null, 'admin', true, true, true),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', '2026-01-01', null, 'staff', true, true, false),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', '2026-01-01', null, 'staff', false, false, true),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000d', '2026-01-01', '2026-03-31', 'staff', true, true, true),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000010', '2026-01-01', null, 'staff', true, true, true),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000e', '2026-04-01', null, 'admin', true, true, true),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000d', '2026-04-01', null, 'staff', true, true, false);

-- Los datos: en Uno, uno de antes y uno de después de que se fue Darío.
insert into public.jugadores (id, nombre, equipo_id, creado_en) overriding system value values
  (9001, 'VIEJO', '00000000-0000-0000-0000-0000000000c1', '2026-01-10'),
  (9002, 'NUEVO', '00000000-0000-0000-0000-0000000000c1', '2026-09-01'),
  (9003, 'DE DOS', '00000000-0000-0000-0000-0000000000c2', '2026-04-10');

insert into public.registros_partido (fecha, rival, equipo_id, created_at) values
  ('2026-02-10', 'Rival A', '00000000-0000-0000-0000-0000000000c1', '2026-02-10 22:00-03'),
  ('2026-06-15', 'Rival B', '00000000-0000-0000-0000-0000000000c1', '2026-06-15 22:00-03'),
  ('2026-05-05', 'Rival A', '00000000-0000-0000-0000-0000000000c2', '2026-05-05 22:00-03');

insert into public.entrenamientos (id, equipo_id, fecha, creado_en) values
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000000c1', '2026-03-01', '2026-03-01 12:00-03'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000000c1', '2026-07-01', '2026-07-01 12:00-03');

insert into public.lesiones (equipo_id, jugador_id, fecha_lesion, datos, creado_en) values
  ('00000000-0000-0000-0000-0000000000c1', 9001, '2026-03-10', '{"parte_cuerpo":"coxa","lado":"direito"}', '2026-03-10 18:00-03'),
  ('00000000-0000-0000-0000-0000000000c1', 9001, '2026-08-20', '{"parte_cuerpo":"joelho","lado":"esquerdo"}', '2026-08-20 18:00-03');

-- Las versiones se anotan con la hora de la carga: acá, el día de cada dato.
-- Y un detalle: el último día de Darío (31/03) termina a las 23:59 de San
-- Pablo, aunque en UTC ya sea 1/04.
update public.versiones_datos
   set cuando = coalesce((fila ->> 'creado_en')::timestamptz, (fila ->> 'created_at')::timestamptz);
insert into public.registros_partido (fecha, rival, equipo_id, created_at) values
  ('2026-03-31', 'Rival Noche', '00000000-0000-0000-0000-0000000000c1', '2026-03-31 23:30-03');
update public.versiones_datos set cuando = '2026-03-31 23:30-03' where fila ->> 'rival' = 'Rival Noche';
insert into public.registros_partido (fecha, rival, equipo_id, created_at) values
  ('2026-04-01', 'Rival Madrugada', '00000000-0000-0000-0000-0000000000c1', '2026-04-01 00:30-03');
update public.versiones_datos set cuando = '2026-04-01 00:30-03' where fila ->> 'rival' = 'Rival Madrugada';

\set C1 '''00000000-0000-0000-0000-0000000000c1'''
\set C2 '''00000000-0000-0000-0000-0000000000c2'''

-- ---------------------------------------------- Lo que ve cada cuenta --

select pruebas.ser('ana@uno.com'); set role authenticated;
select pruebas.esperar('Ana ve los cuatro partidos de Uno', (select count(*) from registros_partido where equipo_id = :C1), 4);
select pruebas.esperar('Ana no ve nada de Dos', (select count(*) from registros_partido where equipo_id = :C2), 0);
select pruebas.esperar('Ana ve las dos lesiones de Uno', (select count(*) from lesiones), 2);
select pruebas.esperar('Ana ve solo su club', (select count(*) from equipos), 1);
reset role;

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto ve los partidos de Uno', (select count(*) from registros_partido), 4);
select pruebas.esperar('Beto ve los entrenamientos de Uno', (select count(*) from entrenamientos), 2);
select pruebas.esperar('Beto no tiene Lesiones: no ve ninguna', (select count(*) from lesiones), 0);
select pruebas.esperar('Beto ve el plantel de Uno', (select count(*) from jugadores), 2);
reset role;

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla (solo Lesiones) no ve partidos', (select count(*) from registros_partido), 0);
select pruebas.esperar('Carla no ve entrenamientos', (select count(*) from entrenamientos), 0);
select pruebas.esperar('Carla ve las lesiones', (select count(*) from lesiones), 2);
reset role;

select pruebas.ser('dario@uno.com'); set role authenticated;
select pruebas.esperar('Darío ya no lee las tablas de Uno', (select count(*) from registros_partido where equipo_id = :C1), 0);
select pruebas.esperar('...ni lesiones', (select count(*) from lesiones where equipo_id = :C1), 0);
select pruebas.esperar('...ni jugadores', (select count(*) from jugadores where equipo_id = :C1), 0);
select pruebas.esperar('En la foto de su último día: dos partidos', (select count(*) from datos_al_dia('registros_partido', :C1)), 2);
select pruebas.esperar('...el del 10/02 y el de esa noche, no el de la madrugada siguiente',
  (select string_agg(f ->> 'rival', ',' order by f ->> 'fecha') from datos_al_dia('registros_partido', :C1) f), 'Rival A,Rival Noche');
select pruebas.esperar('La foto tiene el entrenamiento de antes', (select count(*) from datos_al_dia('entrenamientos', :C1)), 1);
select pruebas.esperar('...la lesión de antes', (select count(*) from datos_al_dia('lesiones', :C1)), 1);
select pruebas.esperar('...y el jugador que ya estaba', (select string_agg(f ->> 'nombre', ',') from datos_al_dia('jugadores', :C1) f), 'VIEJO');
select pruebas.esperar('Darío ve todo lo de Dos, donde sigue', (select count(*) from registros_partido where equipo_id = :C2), 1);
select pruebas.esperar('...y en Dos la foto es lo de hoy', (select count(*) from datos_al_dia('registros_partido', :C2)), 1);
select pruebas.debe_fallar('La foto es solo de las tablas de datos', $$select * from datos_al_dia('perfiles', '00000000-0000-0000-0000-0000000000c1')$$, 'tabla_invalida');
select pruebas.esperar('Darío ve sus dos clubes', (select count(*) from equipos), 2);
select pruebas.esperar('En sus clubes: Uno con fecha de salida', (select hasta::text from v_mis_clubes where id = :C1), '2026-03-31');
select pruebas.esperar('...y Dos sin fecha', (select coalesce(hasta::text, 'sigue') from v_mis_clubes where id = :C2), 'sigue');
reset role;

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva no ve nada de Uno', (select count(*) from registros_partido where equipo_id = :C1), 0);
select pruebas.esperar('...ni con la foto', (select count(*) from datos_al_dia('registros_partido', :C1)), 0);
select pruebas.esperar('Eva no ve jugadores de Uno', (select count(*) from jugadores where equipo_id = :C1), 0);
select pruebas.esperar('Eva no ve la gente de Uno', (select count(*) from club_miembros where equipo_id = :C1), 0);
reset role;

select pruebas.ser('fede@libre.com'); set role authenticated;
select pruebas.esperar('Fede (pendiente) no ve clubes', (select count(*) from equipos), 0);
select pruebas.esperar('Fede no ve partidos', (select count(*) from registros_partido), 0);
select pruebas.esperar('...ni la foto de ningún club', (select count(*) from datos_al_dia('registros_partido', :C1)), 0);
reset role;

select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.esperar('Gaby (bloqueada) no ve partidos aunque esté en Uno', (select count(*) from registros_partido), 0);
select pruebas.esperar('Gaby no ve lesiones', (select count(*) from lesiones), 0);
select pruebas.esperar('...ni la foto de partidos de Uno', (select count(*) from datos_al_dia('registros_partido', :C1)), 0);
select pruebas.esperar('...ni la del plantel', (select count(*) from datos_al_dia('jugadores', :C1)), 0);
reset role;

-- El dueño de la plataforma no ve nada de un club donde no está: ni el club,
-- ni su gente, ni su historia, ni sus invitaciones. Del panel, solo lo justo.
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El dueño no ve los clubes donde no está', (select count(*) from equipos where id in (:C1, :C2)), 0);
select pruebas.esperar('...ni en sus clubes', (select count(*) from v_mis_clubes where id in (:C1, :C2)), 0);
select pruebas.esperar('...ni los datos de esos clubes', (select count(*) from registros_partido where equipo_id = :C1), 0);
select pruebas.esperar('...ni sus lesiones', (select count(*) from lesiones where equipo_id = :C1), 0);
select pruebas.esperar('...ni la gente de cada club', (select count(*) from club_miembros where equipo_id in (:C1, :C2)), 0);
select pruebas.esperar('...ni sus correos', (select count(*) from v_miembros_club where equipo_id in (:C1, :C2)), 0);
select pruebas.esperar('...ni la historia de Uno', (select count(*) from club_miembros_historial where equipo_id = :C1), 0);
select pruebas.esperar('...ni sus invitaciones', (select count(*) from club_invitaciones where equipo_id = :C1), 0);
select pruebas.esperar('...ni cuentas ajenas', (select count(*) from perfiles where user_id <> auth.uid()), 0);
select pruebas.esperar('En el panel, Uno con su administradora', (select correo_admin from panel_clubes() where equipo_id = :C1), 'ana@uno.com');
select pruebas.esperar('...y tres personas (sin Darío, que se fue, ni Gaby, que está bloqueada)', (select personas from panel_clubes() where equipo_id = :C1), 3);
select pruebas.esperar('...Dos con Eva', (select correo_admin from panel_clubes() where equipo_id = :C2), 'eva@dos.com');
select pruebas.esperar('...y dos personas', (select personas from panel_clubes() where equipo_id = :C2), 2);
select pruebas.esperar('...los dos sin entidad', (select count(*) from panel_clubes() where equipo_id in (:C1, :C2) and correo_entidad is null), 2);
reset role;

set role anon;
select pruebas.debe_fallar('Sin cuenta no se lee nada', 'select count(*) from registros_partido', 'permission denied');
select pruebas.debe_fallar('...ni la foto', $$select * from datos_al_dia('registros_partido', '00000000-0000-0000-0000-0000000000c1')$$, 'permission denied');
select pruebas.debe_fallar('...ni las versiones', 'select count(*) from versiones_datos', 'permission denied');
select pruebas.debe_fallar('Sin cuenta no se ven las lesiones', 'select count(*) from lesiones', 'permission denied');
reset role;

-- ------------------------------------------- Lo que cada uno cambia --

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto carga un partido en Uno', pruebas.filas($$insert into registros_partido (fecha, rival, equipo_id) values ('2026-09-20', 'Rival C', '00000000-0000-0000-0000-0000000000c1')$$), 1);
select pruebas.debe_fallar('Beto no carga en Dos', $$insert into registros_partido (fecha, rival, equipo_id) values ('2026-09-21', 'Rival D', '00000000-0000-0000-0000-0000000000c2')$$, 'row-level security');
select pruebas.debe_fallar('Beto no carga lesiones (no tiene el módulo)', $$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, '2026-09-25', '{"parte_cuerpo":"pe","lado":"direito"}')$$, 'row-level security');
reset role;

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla carga una lesión', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, '2026-09-25', '{"parte_cuerpo":"pe","lado":"direito"}')$$), 1);
reset role;

-- Después de que Darío se fue, en Uno cambian y borran cosas.
select pruebas.ser('ana@uno.com'); set role authenticated;
select pruebas.esperar('Ana corrige el resultado del 10/02', pruebas.filas($$update registros_partido set resultado = '2-1' where rival = 'Rival A' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('...y lo vuelve a corregir el mismo día', pruebas.filas($$update registros_partido set resultado = '3-1' where rival = 'Rival A' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('Ana borra el partido de esa noche', pruebas.filas($$delete from registros_partido where rival = 'Rival Noche'$$), 1);
select pruebas.esperar('Ana ve el resultado nuevo', (select resultado from registros_partido where rival = 'Rival A' and equipo_id = :C1), '3-1');
reset role;
select pruebas.esperar('Dos cambios el mismo día son una sola versión', (select count(*) from versiones_datos where tabla = 'registros_partido' and fila ->> 'rival' = 'Rival A' and equipo_id = :C1), 2);

select pruebas.ser('dario@uno.com'); set role authenticated;
select pruebas.esperar('Darío sigue viendo el resultado de su último día', (select f ->> 'resultado' from datos_al_dia('registros_partido', :C1) f where f ->> 'rival' = 'Rival A'), '');
select pruebas.esperar('...y el partido que borraron después', (select count(*) from datos_al_dia('registros_partido', :C1) f where f ->> 'rival' = 'Rival Noche'), 1);
reset role;

select pruebas.ser('dario@uno.com'); set role authenticated;
select pruebas.debe_fallar('Darío ya no carga partidos en Uno', $$insert into registros_partido (fecha, rival, equipo_id) values ('2026-03-01', 'Rival E', '00000000-0000-0000-0000-0000000000c1')$$, 'row-level security');
select pruebas.esperar('Darío no cambia un partido viejo de Uno', pruebas.filas($$update registros_partido set resultado = '9-0' where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.esperar('Darío no borra nada de Uno', pruebas.filas($$delete from registros_partido where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.debe_fallar('Darío no agrega jugadores en Uno', $$insert into jugadores (nombre, equipo_id) values ('INTRUSO', '00000000-0000-0000-0000-0000000000c1')$$, 'row-level security');
select pruebas.esperar('Darío no toca las lesiones de Uno', pruebas.filas($$update lesiones set fecha_alta = '2026-03-20'$$), 0);
select pruebas.esperar('Darío sí carga en Dos', pruebas.filas($$insert into registros_partido (fecha, rival, equipo_id) values ('2026-09-22', 'Rival F', '00000000-0000-0000-0000-0000000000c2')$$), 1);
reset role;

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva no renombra Uno', pruebas.filas($$update equipos set nombre = 'Hackeado' where id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.esperar('Eva renombra su club', pruebas.filas($$update equipos set nombre = 'Club Dos FC' where id = '00000000-0000-0000-0000-0000000000c2'$$), 1);
reset role;

-- ------------------------------------------ Membresías y administración --

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto ve solo su membresía', (select count(*) from club_miembros), 1);
select pruebas.esperar('Beto no se hace administrador', pruebas.filas($$update club_miembros set rol = 'admin' where user_id = auth.uid()$$), 0);
select pruebas.esperar('Beto no le saca nada a nadie', pruebas.filas($$update club_miembros set hasta = current_date$$), 0);
select pruebas.debe_fallar('Beto no invita', $$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'amigo@x.com')$$, 'row-level security');
select pruebas.esperar('Beto no ve correos de otros', (select count(*) from perfiles), 1);
reset role;

select pruebas.ser('ana@uno.com'); set role authenticated;
select pruebas.esperar('Ana ve la gente de Uno, también la que se fue', (select count(*) from club_miembros where equipo_id = :C1), 5);
select pruebas.esperar('Ana ve los correos de su gente', (select count(*) from v_miembros_club where equipo_id = :C1), 5);
select pruebas.esperar('Ana no ve la cuenta de Eva', (select count(*) from perfiles where email = 'eva@dos.com'), 0);
select pruebas.debe_fallar('Ana no cambia el estado de una cuenta', $$update perfiles set estado = 'bloqueado' where email = 'beto@uno.com'$$, 'permission denied');
select pruebas.esperar('Ana le da Lesiones a Beto', pruebas.filas($$update club_miembros set lesiones = true where user_id = '00000000-0000-0000-0000-00000000000b'$$), 1);
select pruebas.debe_fallar('Ana no pone una salida futura', $$update club_miembros set hasta = current_date + 5 where user_id = '00000000-0000-0000-0000-00000000000b'$$, 'hasta_futura');
select pruebas.debe_fallar('Ana no muda una membresía a otro club', $$update club_miembros set equipo_id = '00000000-0000-0000-0000-0000000000c2' where user_id = '00000000-0000-0000-0000-00000000000b'$$);
select pruebas.esperar('Ana no se toca a sí misma: ni el rol', pruebas.filas($$update club_miembros set rol = 'staff' where user_id = auth.uid()$$), 0);
select pruebas.esperar('...ni la fecha de salida', pruebas.filas($$update club_miembros set hasta = current_date where user_id = auth.uid()$$), 0);
select pruebas.debe_fallar('...y no se va: es la única administradora', $$select salir_del_club('00000000-0000-0000-0000-0000000000c1')$$, 'ultimo_admin');
select pruebas.esperar('Ana le saca Lesiones a Darío (ya se fue)', pruebas.filas($$update club_miembros set lesiones = false where user_id = '00000000-0000-0000-0000-00000000000d' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('Eva no está en Uno: Ana no la puede tocar en Dos', pruebas.filas($$update club_miembros set rol = 'staff' where equipo_id = '00000000-0000-0000-0000-0000000000c2'$$), 0);
reset role;

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto ahora ve las lesiones', (select count(*) from lesiones), 3);
reset role;

select pruebas.ser('dario@uno.com'); set role authenticated;
select pruebas.esperar('Darío sin Lesiones en Uno ya no ve ni la foto de las de antes', (select count(*) from datos_al_dia('lesiones', :C1)), 0);
reset role;

-- Un administrador no nombra administradores (en el paso 3 lo hace la
-- entidad del club): acá a Beto lo nombra el SQL Editor. Con dos
-- administradores, ninguno toca al otro, y recién ahí Ana se puede ir.
select pruebas.ser('ana@uno.com'); set role authenticated;
select pruebas.debe_fallar('Ana no nombra a Beto administrador', $$update club_miembros set rol = 'admin' where user_id = '00000000-0000-0000-0000-00000000000b'$$, 'row-level security');
reset role;
select set_config('request.jwt.claims', '', false);
update club_miembros set rol = 'admin' where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-00000000000b';
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto (admin) no pasa a Ana a staff', pruebas.filas($$update club_miembros set rol = 'staff' where user_id = '00000000-0000-0000-0000-00000000000a'$$), 0);
select pruebas.esperar('...ni le da de baja', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-00000000000a'$$), 0);
select pruebas.esperar('...ni le saca módulos', pruebas.filas($$update club_miembros set lesiones = false where user_id = '00000000-0000-0000-0000-00000000000a'$$), 0);
reset role;
select pruebas.ser('ana@uno.com'); set role authenticated;
select pruebas.esperar('Ana tampoco toca a Beto', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-00000000000b'$$), 0);
select salir_del_club(:C1);
select pruebas.esperar('Ahora Ana se puede ir (salir_del_club)', (select hasta::text from v_mis_clubes where id = :C1), current_date::text);
select pruebas.debe_fallar('...una sola vez', $$select salir_del_club('00000000-0000-0000-0000-0000000000c1')$$, 'no_es_miembro_activo');
select pruebas.esperar('Y ya no administra nada', pruebas.filas($$update club_miembros set flujo = false where user_id = '00000000-0000-0000-0000-00000000000c'$$), 0);
select pruebas.debe_fallar('Ni carga partidos', $$insert into registros_partido (fecha, rival, equipo_id) values ('2026-09-30', 'Rival G', '00000000-0000-0000-0000-0000000000c1')$$, 'row-level security');
select pruebas.esperar('Ya no lee las tablas', (select count(*) from registros_partido), 0);
select pruebas.esperar('Pero en la foto de hoy está todo lo de Uno', (select count(*) from datos_al_dia('registros_partido', :C1)), 4);
reset role;

-- Beto reincorpora a Darío: vuelve a ver todo y a cargar.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto reincorpora a Darío', pruebas.filas($$update club_miembros set hasta = null, desde = current_date, lesiones = true where user_id = '00000000-0000-0000-0000-00000000000d' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;

select pruebas.ser('dario@uno.com'); set role authenticated;
select pruebas.esperar('Darío vuelve a ver todos los partidos de Uno', (select count(*) from registros_partido where equipo_id = :C1), 4);
select pruebas.esperar('...y a cargar', pruebas.filas($$insert into registros_partido (fecha, rival, equipo_id) values ('2026-10-01', 'Rival H', '00000000-0000-0000-0000-0000000000c1')$$), 1);
select pruebas.esperar('Darío ve su historia en Uno, en orden',
  (select string_agg(accion, ',' order by id) from club_miembros_historial where equipo_id = :C1 and user_id = auth.uid()),
  'alta,modulos,reincorporacion,modulos');
select pruebas.esperar('Darío no ve la historia de otros', (select count(*) from club_miembros_historial where user_id <> auth.uid()), 0);
reset role;

-- Lo que queda anotado: quién hizo cada cosa.
select pruebas.esperar('La historia dice que Beto lo reincorporó',
  (select quien_email from club_miembros_historial where user_id = '00000000-0000-0000-0000-00000000000d' and accion = 'reincorporacion'), 'beto@uno.com');
select pruebas.esperar('...y que Ana se fue',
  (select count(*) from club_miembros_historial where user_id = '00000000-0000-0000-0000-00000000000a' and accion = 'baja' and quien_email = 'ana@uno.com'), 1);

-- --------------------------------------------------------- Invitaciones --

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto (admin) invita a alguien sin cuenta', pruebas.filas($$insert into club_invitaciones (equipo_id, email, rol, partido, flujo, lesiones) values ('00000000-0000-0000-0000-0000000000c1', ' Nuevo@Uno.com ', 'staff', false, false, true)$$), 1);
select pruebas.debe_fallar('No hay dos invitaciones abiertas para el mismo correo', $$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'nuevo@uno.com')$$, 'duplicate key');
select pruebas.debe_fallar('El correo tiene que ser un correo', $$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'cualquiera')$$, 'correo_invalido');
select pruebas.esperar('Invita al pendiente de confirmar', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'hugo@nuevo.com')$$), 1);
select pruebas.esperar('Invita a la cuenta bloqueada', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'gaby@uno.com')$$), 1);
select pruebas.debe_fallar('El vencimiento no lo elige el administrador', $$insert into club_invitaciones (equipo_id, email, vence_en) values ('00000000-0000-0000-0000-0000000000c1', 'tarde@uno.com', now() - interval '1 day')$$, 'permission denied');
select pruebas.debe_fallar('Beto no invita como administrador', $$insert into club_invitaciones (equipo_id, email, rol) values ('00000000-0000-0000-0000-0000000000c1', 'jefe@uno.com', 'admin')$$, 'row-level security');
select pruebas.esperar('Una invitación cancelada', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'arrepentido@uno.com')$$), 1);
select pruebas.esperar('...que se cancela', pruebas.filas($$update club_invitaciones set cancelada_en = now() where email = 'arrepentido@uno.com'$$), 1);
select pruebas.debe_fallar('Una invitación no se reabre', $$update club_invitaciones set cancelada_en = null, usada_en = null where email = 'arrepentido@uno.com'$$, 'permission denied');
select pruebas.debe_fallar('...ni se borra', $$delete from club_invitaciones where email = 'arrepentido@uno.com'$$, 'permission denied');
reset role;
-- Una invitación vencida, armada en el SQL Editor (con la sesión de Beto: la
-- invitó él).
insert into club_invitaciones (equipo_id, email, vence_en) values (:C1, 'tarde@uno.com', now() - interval '1 day');

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.debe_fallar('Eva no invita a Uno', $$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'espia@dos.com')$$, 'row-level security');
select pruebas.esperar('Eva no ve las invitaciones de Uno', (select count(*) from club_invitaciones where equipo_id = :C1), 0);
select pruebas.esperar('Eva invita a Fede, que ya tiene cuenta', pruebas.filas($$insert into club_invitaciones (equipo_id, email, rol) values ('00000000-0000-0000-0000-0000000000c2', 'fede@libre.com', 'staff')$$), 1);
reset role;

-- La invitada sin cuenta se registra con ese correo (ya confirmado).
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000012', 'nuevo@uno.com', now());
select pruebas.esperar('La cuenta nueva quedó autorizada', (select estado from perfiles where email = 'nuevo@uno.com'), 'autorizado');
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('...y adentro de Uno', (select count(*) from v_mis_clubes where id = :C1 and hasta is null), 1);
select pruebas.esperar('...solo con Lesiones', (select count(*) from lesiones), 3);
select pruebas.esperar('...sin Partido', (select count(*) from registros_partido), 0);
reset role;

select pruebas.esperar('Fede entró a Dos en el acto', (select count(*) from club_miembros where user_id = '00000000-0000-0000-0000-00000000000f' and equipo_id = :C2 and hasta is null), 1);
select pruebas.esperar('...y quedó autorizado', (select estado from perfiles where email = 'fede@libre.com'), 'autorizado');

select pruebas.esperar('Hugo no confirmó el correo: todavía no entra', (select count(*) from club_miembros where user_id = '00000000-0000-0000-0000-000000000011'), 0);
update auth.users set email_confirmed_at = now() where email = 'hugo@nuevo.com';
select pruebas.esperar('Al confirmar, Hugo entra a Uno', (select count(*) from club_miembros where user_id = '00000000-0000-0000-0000-000000000011' and equipo_id = :C1), 1);
select pruebas.esperar('...y queda autorizado', (select estado from perfiles where email = 'hugo@nuevo.com'), 'autorizado');

select pruebas.esperar('La invitación no desbloquea a Gaby', (select estado from perfiles where email = 'gaby@uno.com'), 'bloqueado');
select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.esperar('...que sigue sin ver nada', (select count(*) from registros_partido), 0);
reset role;

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000013', 'tarde@uno.com', now()),
  ('00000000-0000-0000-0000-000000000014', 'arrepentido@uno.com', now());
select pruebas.esperar('La invitación vencida no hace entrar a nadie', (select count(*) from club_miembros where user_id = '00000000-0000-0000-0000-000000000013'), 0);
select pruebas.esperar('...ni la cancelada', (select count(*) from club_miembros where user_id = '00000000-0000-0000-0000-000000000014'), 0);
select pruebas.esperar('Sin invitación, la cuenta queda pendiente', (select estado from perfiles where email = 'tarde@uno.com'), 'pendiente');

-- ------------------------------------------------------- Clubes y dueño --

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Un admin de club no crea clubes', $$insert into equipos (nombre) values ('Club Pirata')$$, 'permission denied');
select pruebas.debe_fallar('...ni con la función de los dueños', $$select crear_club('Club Pirata')$$, 'solo_duenos');
select pruebas.debe_fallar('Ni toca los ajustes generales', $$insert into ajustes (clave, valor) values ('x', 'y')$$, 'permission denied');
reset role;

select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.debe_fallar('El dueño no crea clubes a mano', $$insert into equipos (nombre) values ('Club Tres')$$, 'permission denied');
select crear_club('Club Tres') as club_tres \gset
select pruebas.esperar('...los crea con crear_club, y no lo ve como club propio', (select count(*) from equipos where id = :'club_tres'), 0);
select pruebas.debe_fallar('El dueño no bloquea cuentas desde la app', $$update perfiles set estado = 'bloqueado' where email = 'beto@uno.com'$$, 'permission denied');
reset role;
select pruebas.esperar('Quien crea un club no queda adentro', (select count(*) from club_miembros where equipo_id = :'club_tres'), 0);
-- Bloquear una cuenta en toda la app es solo por SQL.
select set_config('request.jwt.claims', '', false);
update perfiles set estado = 'bloqueado' where email = 'beto@uno.com';

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto bloqueado no ve nada', (select count(*) from registros_partido), 0);
select pruebas.esperar('...ni administra', pruebas.filas($$update club_miembros set partido = false$$), 0);
reset role;

select set_config('request.jwt.claims', '', false);
update perfiles set estado = 'autorizado' where email = 'beto@uno.com';
-- Los clubes no se borran desde la app: solo por SQL.
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.debe_fallar('El dueño no borra clubes', format('delete from equipos where id = %L', :'club_tres'), 'permission denied');
reset role;
select set_config('request.jwt.claims', '', false);
select pruebas.esperar('Un club se borra por SQL', pruebas.filas(format('delete from equipos where id = %L', :'club_tres')), 1);

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto vuelve a ver todo', (select count(*) from registros_partido), 5);
reset role;

-- Dos clubes pueden cargar el mismo día contra un rival del mismo nombre.
select pruebas.esperar('El partido repetido es por club', (select count(*) from registros_partido where fecha in ('2026-02-10', '2026-05-05') and rival = 'Rival A'), 2);
insert into registros_partido (fecha, rival, equipo_id) values ('2026-02-10', 'Rival A', '00000000-0000-0000-0000-0000000000c2');
select pruebas.debe_fallar('...pero en el mismo club no se repite', $$insert into registros_partido (fecha, rival, equipo_id) values ('2026-02-10', 'rival a ', '00000000-0000-0000-0000-0000000000c2')$$, 'duplicate key');

-- ---------------------------------------------- La zona horaria del club --

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Un admin de club no cambia la zona horaria', $$update equipos set zona_horaria = 'Etc/GMT+12' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'permission denied');
select pruebas.esperar('...pero sí el nombre', pruebas.filas($$update equipos set nombre = 'Club Uno' where id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;

select pruebas.debe_fallar('Una zona que no existe no entra', $$update equipos set zona_horaria = 'Hora/Mala' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'zona_horaria_invalida');
select pruebas.debe_fallar('...ni en un club nuevo', $$insert into equipos (nombre, zona_horaria) values ('Club Cuatro', 'Hora/Mala')$$, 'zona_horaria_invalida');
select pruebas.esperar('Una que existe, sí', pruebas.filas($$update equipos set zona_horaria = 'America/Argentina/Buenos_Aires' where id = '00000000-0000-0000-0000-0000000000c1'$$), 1);

-- Si igual quedara una mala (a mano, salteando el control), cargar no se frena.
alter table equipos disable trigger equipos_validar_zona;
update equipos set zona_horaria = 'Hora/Mala' where id = '00000000-0000-0000-0000-0000000000c1';
alter table equipos enable trigger equipos_validar_zona;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Con la zona rota, Beto igual guarda un cambio', pruebas.filas($$update registros_partido set resultado = '4-1' where rival = 'Rival A' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('...y la foto se sigue armando', (select count(*) from datos_al_dia('registros_partido', :C1)), (select count(*) from registros_partido where equipo_id = :C1));
reset role;
alter table equipos disable trigger equipos_validar_zona;
update equipos set zona_horaria = 'America/Sao_Paulo' where id = '00000000-0000-0000-0000-0000000000c1';
alter table equipos enable trigger equipos_validar_zona;

-- --------------------------------------- Una fila que se pasa a otro club --

-- Beto cambia el resultado de Rival B hoy y después (a mano: la app no mueve
-- filas) el partido pasa a Dos el mismo día.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto corrige Rival B', pruebas.filas($$update registros_partido set resultado = '1-1' where rival = 'Rival B' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
update registros_partido set equipo_id = '00000000-0000-0000-0000-0000000000c2' where rival = 'Rival B' and equipo_id = '00000000-0000-0000-0000-0000000000c1';
select pruebas.esperar('El cambio de club es otra versión: no pisa la de Uno', (select count(*) from versiones_datos where tabla = 'registros_partido' and fila ->> 'rival' = 'Rival B'), 3);
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('En la foto de Uno ya no está', (select count(*) from datos_al_dia('registros_partido', :C1) f where f ->> 'rival' = 'Rival B'), 0);
select pruebas.esperar('...y la foto coincide con la tabla', (select count(*) from datos_al_dia('registros_partido', :C1)), (select count(*) from registros_partido where equipo_id = :C1));
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('En la de Dos, sí, con el resultado corregido', (select f ->> 'resultado' from datos_al_dia('registros_partido', :C2) f where f ->> 'rival' = 'Rival B'), '1-1');
reset role;

-- ------------------------------------ Horas entre la lesión y la imagen --

select pruebas.esperar('Horas: del comienzo del día de la lesión a la imagen', public.lesiones_horas_imagen('2026-09-02T10:30', date '2026-09-01'), 35);
select pruebas.esperar('...redondeadas como en la app: media hora antes da 0', public.lesiones_horas_imagen('2026-08-31T23:30', date '2026-09-01'), 0);
select pruebas.esperar('...y -2,5 da -2', public.lesiones_horas_imagen('2026-09-09T21:30', date '2026-09-10'), -2);
select pruebas.esperar('...con espacio y segundos, igual', public.lesiones_horas_imagen('2026-09-01 18:14:59', date '2026-09-01'), 18);
select pruebas.esperar('Un 30 de febrero no da horas', public.lesiones_horas_imagen('2026-02-30T10:00', date '2026-02-01'), null::bigint);
select pruebas.esperar('...ni las 24:00', public.lesiones_horas_imagen('2026-09-01T24:00', date '2026-09-01'), null::bigint);
select pruebas.esperar('...ni las 25:99', public.lesiones_horas_imagen('2026-09-01T25:99', date '2026-09-01'), null::bigint);
select pruebas.esperar('...ni el año 50', public.lesiones_horas_imagen('0050-09-01T10:00', date '2026-09-01'), null::bigint);
select pruebas.esperar('...ni un texto', public.lesiones_horas_imagen('ayer', date '2026-09-01'), null::bigint);

-- Lo que se escribía a mano antes queda en la vista si no hay hora de la imagen.
insert into public.lesiones (equipo_id, jugador_id, fecha_lesion, fecha_alta, datos) values
  (:C1, 9002, '2026-05-01', '2026-05-02', '{"parte_cuerpo":"mao","lado":"direito","medico":"horas-1","horas_imagen":"12"}'),
  (:C1, 9002, '2026-05-01', '2026-05-02', '{"parte_cuerpo":"punho","lado":"direito","medico":"horas-2","horas_imagen":"12","hora_imagen":"2026-05-02T10:30"}'),
  (:C1, 9002, '2026-05-01', '2026-05-02', '{"parte_cuerpo":"cotovelo","lado":"direito","medico":"horas-3","horas_imagen":"doce"}'),
  (:C1, 9002, '2026-05-01', '2026-05-02', '{"parte_cuerpo":"antebraco","lado":"direito","medico":"horas-4","horas_imagen":"6,5","hora_imagen":"2026-02-30T10:00"}'),
  (:C1, 9002, '2026-05-01', '2026-05-02', '{"parte_cuerpo":"cabeca_face","lado":"direito","medico":"horas-5","horas_imagen":".5"}');
select pruebas.esperar('Vista: sin hora de la imagen, las horas escritas a mano', (select horas_passadas_imagem_lesao::text from v_lesiones_excel_v1 where medico = 'horas-1'), '12');
select pruebas.esperar('...con hora de la imagen, la cuenta', (select horas_passadas_imagem_lesao::text from v_lesiones_excel_v1 where medico = 'horas-2'), '35');
select pruebas.esperar('...lo que no es un número no rompe la vista', (select coalesce(horas_passadas_imagem_lesao::text, 'vacío') from v_lesiones_excel_v1 where medico = 'horas-3'), 'vacío');
select pruebas.esperar('...y con una hora imposible, lo escrito a mano', (select horas_passadas_imagem_lesao::text from v_lesiones_excel_v1 where medico = 'horas-4'), '6.5');
select pruebas.esperar('...y ".5", como lo aceptaba el campo de antes', (select horas_passadas_imagem_lesao::text from v_lesiones_excel_v1 where medico = 'horas-5'), '0.5');
delete from public.lesiones where datos->>'medico' like 'horas-%';

-- --------------------------------------- Horas de entrenamiento previas --

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla anota las horas previas de un jugador de Uno', pruebas.filas($$update jugadores set horas_previas = 30.25 where id = 9002$$), 1);
select pruebas.debe_fallar('...pero no horas negativas', $$update jugadores set horas_previas = -1 where id = 9002$$, 'jugadores_horas_previas_no_negativas');
select pruebas.debe_fallar('...ni NaN', $$update jugadores set horas_previas = 'NaN' where id = 9002$$, 'jugadores_horas_previas_no_negativas');
select pruebas.debe_fallar('...ni infinitas', $$update jugadores set horas_previas = 'Infinity' where id = 9002$$, 'jugadores_horas_previas_no_negativas');
reset role;
select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.esperar('Gaby (bloqueada) no las cambia', pruebas.filas($$update jugadores set horas_previas = 99 where id = 9002$$), 0);
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('...ni Eva, que es de otro club', pruebas.filas($$update jugadores set horas_previas = 99 where id = 9002$$), 0);
reset role;
select pruebas.esperar('Quedan las de Carla', (select horas_previas::text from jugadores where id = 9002), '30.25');

-- ------------------------------------- Recaída durante la recuperación --

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla carga una lesión con su N° de caso (como el importador del Excel)', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, numero_caso, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 500, '2026-06-01', '{"parte_cuerpo":"coxa","lado":"esquerdo"}')$$), 1);
select pruebas.esperar('...y queda con ese número', (select count(*) from lesiones where numero_caso = 500 and jugador_id = 9002), 1);
select pruebas.esperar('Una recaída en la misma parte y lado, antes del alta, se puede cargar', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, '2026-06-09', '{"parte_cuerpo":"coxa","lado":"esquerdo"}')$$), 1);
select pruebas.debe_fallar('...pero la misma lesión dos veces (mismo día), no', $$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, '2026-06-01', '{"parte_cuerpo":"coxa","lado":"esquerdo"}')$$, 'lesiones_sin_repetir');
select pruebas.debe_fallar('...ni con un N° de caso que ya existe', $$insert into lesiones (equipo_id, jugador_id, numero_caso, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 500, '2026-07-01', '{"parte_cuerpo":"joelho","lado":"esquerdo"}')$$, 'lesiones_numero_caso_unico');
reset role;

-- ------------------- Sin fecha de inicio y personas fuera de Datos básicos --

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla carga una lesión sin fecha de inicio (un caso sin terminar del Excel)', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, numero_caso, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 600, '{"parte_cuerpo":"coxa","lado":"esquerdo"}')$$), 1);
select pruebas.esperar('...y otra igual, también sin fecha (sin fecha no se compara)', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, numero_caso, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 601, '{"parte_cuerpo":"coxa","lado":"esquerdo"}')$$), 1);
select pruebas.esperar('Carla carga la lesión de alguien que no está en Datos básicos', pruebas.filas($$insert into lesiones (equipo_id, persona, numero_caso, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 'Cata Tres', 602, '2026-05-01', '{"parte_cuerpo":"joelho","lado":"direito"}')$$), 1);
select pruebas.esperar('...y otra de la misma persona, después', pruebas.filas($$insert into lesiones (equipo_id, persona, numero_caso, fecha_lesion, fecha_alta, datos) values ('00000000-0000-0000-0000-0000000000c1', 'Cata Tres', 603, '2026-04-01', '2026-04-20', '{"parte_cuerpo":"joelho","lado":"direito"}')$$), 1);
select pruebas.debe_fallar('La misma lesión de esa persona dos veces, no (sin importar mayúsculas)', $$insert into lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', ' cata tres ', '2026-05-01', '{"parte_cuerpo":"joelho","lado":"direito"}')$$, 'lesiones_sin_repetir_persona');
select pruebas.debe_fallar('Una lesión es de un jugador o de una persona: de nadie, no', $$insert into lesiones (equipo_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', '2026-05-02', '{}')$$, 'lesiones_de_quien');
select pruebas.debe_fallar('...ni de los dos', $$insert into lesiones (equipo_id, jugador_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 'Cata Tres', '2026-05-03', '{}')$$, 'lesiones_de_quien');
select pruebas.debe_fallar('...ni con un nombre en blanco', $$insert into lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', '   ', '2026-05-04', '{}')$$, 'lesiones_de_quien');
select pruebas.esperar('Power Query ve a la persona con su nombre', (select count(*) from v_lesiones_excel_v1 where nome_e_sobrenome = 'Cata Tres'), 2);
select pruebas.esperar('...numerada aparte de los jugadores', (select string_agg(n_de_registro::text, ',' order by n_de_caso) from v_lesiones_excel_v1 where nome_e_sobrenome = 'Cata Tres'), '1,2');
select pruebas.esperar('...con su recurrencia (la de abril, dentro de los 60 días)', (select recorrencia from v_lesiones_excel_v1 where n_de_caso = 602), 'sim');
select pruebas.esperar('...y sin datos de Datos básicos', (select count(*) from v_lesiones_excel_v1 where nome_e_sobrenome = 'Cata Tres' and d_nac is null and posicao is null), 2);
select pruebas.esperar('Power Query ve también las sin fecha, sin días ni severidad', (select count(*) from v_lesiones_excel_v1 where n_de_caso in (600, 601) and data_de_inicio_da_lesao is null and recuperacao is null and severidade is null), 2);
select pruebas.esperar('...ni recurrencia ni recidiva (todavía no se sabe)', (select count(*) from v_lesiones_excel_v1 where n_de_caso in (600, 601) and recorrencia is null and recidiva is null), 2);
select pruebas.esperar('Una sin fecha pero con alta no tiene severidad', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, numero_caso, fecha_alta, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 604, '2026-05-10', '{}')$$), 1);
select pruebas.esperar('...(ni "mayor")', (select coalesce(severidade, 'vacía') from v_lesiones_excel_v1 where n_de_caso = 604), 'vacía');
select pruebas.esperar('La vista general: la persona con su nombre', (select count(*) from v_lesiones where jugador = 'Cata Tres'), 2);
select pruebas.esperar('...y las sin fecha no están activas', (select count(*) from v_lesiones where numero_caso in (600, 601, 604) and not activa and etapa = 'sin_fecha'), 3);
reset role;

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva no ve las lesiones de la persona de Uno', (select count(*) from lesiones where persona is not null), 0);
reset role;

-- ------------------------------------------------ Períodos guardados --

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla guarda un período de Lesiones c/1000h', pruebas.filas($$insert into lesiones_periodos (equipo_id, nombre, desde, hasta) values ('00000000-0000-0000-0000-0000000000c1', 'Primer semestre', '2026-01-01', '2026-06-30')$$), 1);
select pruebas.esperar('...y uno sin fecha de inicio (desde la primera lesión)', pruebas.filas($$insert into lesiones_periodos (equipo_id, nombre, hasta) values ('00000000-0000-0000-0000-0000000000c1', 'Base completa', '2026-10-01')$$), 1);
select pruebas.esperar('...y los ve', (select count(*) from lesiones_periodos), 2);
select pruebas.debe_fallar('El mismo nombre no se repite (ni con otras mayúsculas)', $$insert into lesiones_periodos (equipo_id, nombre, hasta) values ('00000000-0000-0000-0000-0000000000c1', ' primer SEMESTRE ', '2026-07-01')$$, 'lesiones_periodos_nombre_unico');
select pruebas.debe_fallar('...ni sin nombre', $$insert into lesiones_periodos (equipo_id, nombre, hasta) values ('00000000-0000-0000-0000-0000000000c1', '   ', '2026-07-01')$$, 'lesiones_periodos_nombre');
select pruebas.debe_fallar('...ni con el final antes del inicio', $$insert into lesiones_periodos (equipo_id, nombre, desde, hasta) values ('00000000-0000-0000-0000-0000000000c1', 'Al revés', '2026-07-01', '2026-06-01')$$, 'lesiones_periodos_fechas');
select pruebas.esperar('Carla lo renombra', pruebas.filas($$update lesiones_periodos set nombre = '1° semestre' where nombre = 'Primer semestre'$$), 1);
reset role;

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva no ve los períodos de Uno', (select count(*) from lesiones_periodos where equipo_id = :C1), 0);
select pruebas.debe_fallar('...ni guarda uno en Uno', $$insert into lesiones_periodos (equipo_id, nombre, hasta) values ('00000000-0000-0000-0000-0000000000c1', 'Espía', '2026-07-01')$$, 'row-level security');
select pruebas.esperar('...ni borra los de Uno', pruebas.filas($$delete from lesiones_periodos$$), 0);
reset role;

select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.esperar('Gaby (bloqueada) no ve los períodos', (select count(*) from lesiones_periodos), 0);
reset role;

set role anon;
select pruebas.debe_fallar('Sin cuenta no se ven los períodos', 'select count(*) from lesiones_periodos', 'permission denied');
reset role;
select pruebas.esperar('Quedan los dos de Uno', (select count(*) from lesiones_periodos where equipo_id = :C1), 2);

-- ------------------------------------------- Quién está en el plantel actual --

select pruebas.esperar('Los jugadores que ya estaban quedan en el plantel actual', (select count(*) from jugadores where not actual), 0);
select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla desmarca a un jugador de Uno que se fue', pruebas.filas($$update jugadores set actual = false where id = 9001$$), 1);
select pruebas.debe_fallar('...y no se puede dejar sin dato', $$update jugadores set actual = null where id = 9001$$, 'null value');
reset role;
select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.esperar('Gaby (bloqueada) no lo vuelve a marcar', pruebas.filas($$update jugadores set actual = true where id = 9001$$), 0);
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('...ni Eva, que es de otro club', pruebas.filas($$update jugadores set actual = true where id = 9001$$), 0);
reset role;
select pruebas.esperar('Sigue desmarcado, y sus lesiones siguen a su nombre', (select count(*) from jugadores j where j.id = 9001 and not j.actual and exists (select 1 from lesiones l where l.jugador_id = j.id)), 1);
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Uno nuevo entra marcado', pruebas.filas($$insert into jugadores (nombre, equipo_id) values ('RECIEN LLEGADO', '00000000-0000-0000-0000-0000000000c1')$$), 1);
select pruebas.esperar('...en el plantel actual', (select count(*) from jugadores where nombre = 'RECIEN LLEGADO' and actual), 1);
reset role;

-- ----------------------------------------------------------- Evaluaciones --

-- Un jugador de Uno para evaluar y los valores de referencia de cada club
-- (se cargan con SQL, como en producción).
insert into public.jugadores (id, nombre, equipo_id) overriding system value values
  (9004, 'EVALUADO', '00000000-0000-0000-0000-0000000000c1');
insert into public.evaluaciones_referencias (equipo_id, test, datos) values
  ('00000000-0000-0000-0000-0000000000c1', 'zona_media', '{"categorias":{}}'),
  ('00000000-0000-0000-0000-0000000000c2', 'zona_media', '{"categorias":{}}');

select pruebas.esperar('Nadie arranca con Evaluaciones', (select count(*) from club_miembros where evaluaciones), 0);

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto (admin de Uno) le da Evaluaciones a Carla', pruebas.filas($$update club_miembros set evaluaciones = true where user_id = '00000000-0000-0000-0000-00000000000c' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('Beto, sin Evaluaciones, no ve ninguna', (select count(*) from evaluaciones), 0);
select pruebas.debe_fallar('...ni carga', $$insert into evaluaciones (equipo_id, test, jugador_id, fecha, datos) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 9004, '2026-06-12', '{"lumbar":184}')$$, 'row-level security');
select pruebas.esperar('...ni ve los valores de referencia', (select count(*) from evaluaciones_referencias), 0);
reset role;
select pruebas.esperar('El permiso nuevo queda en la historia de Carla', (select count(*) from club_miembros_historial where user_id = '00000000-0000-0000-0000-00000000000c' and accion = 'modulos' and detalle ->> 'evaluaciones' = 'true'), 1);

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla carga una evaluación de un jugador de Uno', pruebas.filas($$insert into evaluaciones (equipo_id, test, jugador_id, fecha, datos) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 9004, '2026-06-12', '{"seleccion":"mayor","lumbar":184}')$$), 1);
select pruebas.esperar('...y la de alguien que no está en Datos básicos', pruebas.filas($$insert into evaluaciones (equipo_id, test, persona, fecha, datos) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 'Cata Tres', '2026-06-12', '{"lumbar":200}')$$), 1);
select pruebas.esperar('...y las ve en el orden en que las cargó', (select string_agg(coalesce(persona, jugador_id::text), ',' order by orden) from evaluaciones), '9004,Cata Tres');
select pruebas.debe_fallar('Una evaluación es de un jugador o de una persona: de nadie, no', $$insert into evaluaciones (equipo_id, test, fecha) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', '2026-06-12')$$, 'evaluaciones_de_quien');
select pruebas.debe_fallar('...ni de los dos', $$insert into evaluaciones (equipo_id, test, jugador_id, persona, fecha) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 9004, 'Cata Tres', '2026-06-12')$$, 'evaluaciones_de_quien');
select pruebas.debe_fallar('...ni con un nombre en blanco', $$insert into evaluaciones (equipo_id, test, persona, fecha) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', '   ', '2026-06-12')$$, 'evaluaciones_de_quien');
select pruebas.debe_fallar('...ni de un jugador de otro club', $$insert into evaluaciones (equipo_id, test, jugador_id, fecha) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 9003, '2026-06-12')$$, 'jugador_de_otro_club');
select pruebas.debe_fallar('...ni con un test mal escrito', $$insert into evaluaciones (equipo_id, test, jugador_id, fecha) values ('00000000-0000-0000-0000-0000000000c1', 'Zona Media', 9004, '2026-06-12')$$, 'evaluaciones_test');
select pruebas.debe_fallar('...ni con fecha futura', $$insert into evaluaciones (equipo_id, test, jugador_id, fecha) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 9004, current_date + 1)$$, 'evaluaciones_sin_futuro');
select pruebas.debe_fallar('...ni en otro club', $$insert into evaluaciones (equipo_id, test, persona, fecha) values ('00000000-0000-0000-0000-0000000000c2', 'zona_media', 'Cata Tres', '2026-06-12')$$, 'row-level security');
select pruebas.esperar('Carla corrige un tiempo', pruebas.filas($$update evaluaciones set datos = datos || '{"lumbar":185}' where jugador_id = 9004$$), 1);
select pruebas.debe_fallar('...pero no la pasa a otro test', $$update evaluaciones set test = 'saltos' where jugador_id = 9004$$, 'evaluacion_fija');
select pruebas.debe_fallar('...ni le cambia el orden de carga', $$update evaluaciones set orden = 1 where jugador_id = 9004$$, 'orden');
select pruebas.esperar('Carla ve los valores de referencia de Uno', (select count(*) from evaluaciones_referencias), 1);
select pruebas.debe_fallar('...pero no los cambia', $$update evaluaciones_referencias set datos = '{}'$$, 'permission denied');
select pruebas.debe_fallar('...ni carga otros', $$insert into evaluaciones_referencias (equipo_id, test, datos) values ('00000000-0000-0000-0000-0000000000c1', 'saltos', '{}')$$, 'permission denied');
reset role;

select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('Con Lesiones y sin Evaluaciones no se ve ninguna', (select count(*) from evaluaciones), 0);
select pruebas.esperar('...ni en la foto', (select count(*) from datos_al_dia('evaluaciones', :C1)), 0);
reset role;

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (de otro club) no ve las de Uno', (select count(*) from evaluaciones where equipo_id = :C1), 0);
select pruebas.esperar('...ni con la foto', (select count(*) from datos_al_dia('evaluaciones', :C1)), 0);
reset role;

-- Una invitación solo con Evaluaciones (una preparadora física).
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto invita a alguien solo con Evaluaciones', pruebas.filas($$insert into club_invitaciones (equipo_id, email, rol, partido, flujo, lesiones, evaluaciones) values ('00000000-0000-0000-0000-0000000000c1', 'pf@uno.com', 'staff', false, false, false, true)$$), 1);
reset role;
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000015', 'pf@uno.com', now());
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('...entra con Evaluaciones y las ve', (select count(*) from evaluaciones), 2);
select pruebas.esperar('...sin Lesiones', (select count(*) from lesiones), 0);
select pruebas.esperar('...y su club dice que tiene Evaluaciones', (select evaluaciones::text from v_mis_clubes where id = :C1), 'true');
select pruebas.debe_fallar('Un jugador con evaluaciones no se borra', $$delete from jugadores where id = 9004$$, 'evaluaciones_jugador_id_fkey');
reset role;

-- Carla se va de Uno: ve la foto de su último día, mientras tenga el permiso.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Carla se va de Uno', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-00000000000c' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla ya no lee las evaluaciones de Uno', (select count(*) from evaluaciones), 0);
select pruebas.esperar('...pero están en la foto de su último día', (select count(*) from datos_al_dia('evaluaciones', :C1)), 2);
select pruebas.esperar('...con lo que corrigió', (select f -> 'datos' ->> 'lumbar' from datos_al_dia('evaluaciones', :C1) f where f ->> 'jugador_id' = '9004'), '185');
select pruebas.esperar('...y los valores de referencia de Uno', (select count(*) from datos_al_dia('evaluaciones_referencias', :C1)), 1);
select pruebas.debe_fallar('...pero ya no carga', $$insert into evaluaciones (equipo_id, test, jugador_id, fecha) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 9004, '2026-06-13')$$, 'row-level security');
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto le saca Evaluaciones a Carla (ya se fue)', pruebas.filas($$update club_miembros set evaluaciones = false where user_id = '00000000-0000-0000-0000-00000000000c' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Sin el permiso, Carla ya no ve ni la foto', (select count(*) from datos_al_dia('evaluaciones', :C1)), 0);
select pruebas.esperar('...ni la de los valores de referencia', (select count(*) from datos_al_dia('evaluaciones_referencias', :C1)), 0);
reset role;

set role anon;
select pruebas.debe_fallar('Sin cuenta no se ven las evaluaciones', 'select count(*) from evaluaciones', 'permission denied');
select pruebas.debe_fallar('...ni los valores de referencia', 'select count(*) from evaluaciones_referencias', 'permission denied');
select pruebas.debe_fallar('...ni su foto', $$select * from datos_al_dia('evaluaciones', '00000000-0000-0000-0000-0000000000c1')$$, 'permission denied');
reset role;

select pruebas.esperar('Las dos evaluaciones quedan en las versiones (un cambio el mismo día pisa la suya)', (select count(*) from versiones_datos where tabla = 'evaluaciones'), 2);
select pruebas.esperar('...y quién la cargó', (select count(*) from evaluaciones where creado_por = '00000000-0000-0000-0000-00000000000c' and actualizado_por = '00000000-0000-0000-0000-00000000000c'), 2);
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('La preparadora corrige una de las que cargó Carla', pruebas.filas($$update evaluaciones set datos = datos || '{"lumbar":201}' where persona = 'Cata Tres'$$), 1);
reset role;
select pruebas.esperar('El jugador evaluado pasa a otro club', pruebas.filas($$update jugadores set equipo_id = '00000000-0000-0000-0000-0000000000c2' where id = 9004$$), 1);
-- Desde Supabase › Authentication › Users, sin la sesión de nadie.
select set_config('request.jwt.claims', '', false);
select pruebas.esperar('Se borra la cuenta de Carla', pruebas.filas($$delete from auth.users where id = '00000000-0000-0000-0000-00000000000c'$$), 1);
select pruebas.esperar('...y sus evaluaciones quedan sin autor, no con una cuenta que ya no existe', (select count(*) from evaluaciones where creado_por is not null and not exists (select 1 from auth.users u where u.id = creado_por)), 0);
select pruebas.esperar('...pero siguen estando', (select count(*) from evaluaciones), 2);
select pruebas.esperar('...y la que corrigió la preparadora sigue diciendo que la cambió ella', (select actualizado_por::text from evaluaciones where persona = 'Cata Tres'), '00000000-0000-0000-0000-000000000015');
select pruebas.esperar('...con lo que cargó', (select datos ->> 'lumbar' from evaluaciones where persona = 'Cata Tres'), '201');

-- ------------------------------------------------------------- Seguridad --

-- El historial de una lesión borrada no se abre con su id desde otro club.
-- Eva carga, corrige y borra una lesión en Dos; el historial queda.
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva carga una lesión en Dos', pruebas.filas($$insert into lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c2', 'Persona de Dos', '2026-08-01', '{"parte_cuerpo":"joelho","lado":"direito","comentarios":"dato clínico de Dos"}')$$), 1);
select pruebas.esperar('...la corrige', pruebas.filas($$update lesiones set datos = datos || '{"comentarios":"dato clínico corregido de Dos"}' where persona = 'Persona de Dos'$$), 1);
select pruebas.esperar('...y la borra', pruebas.filas($$delete from lesiones where persona = 'Persona de Dos'$$), 1);
reset role;
select lesion_id as id_borrada from lesiones_historial where accion = 'borrada' and antes ->> 'persona' = 'Persona de Dos' \gset
-- El mismo id vuelve en Uno (a mano, sin sesión: desde la app la base pone
-- uno nuevo).
select set_config('request.jwt.claims', '', false);
insert into lesiones (id, equipo_id, persona, fecha_lesion, datos)
values (:'id_borrada', '00000000-0000-0000-0000-0000000000c1', 'Id repetido', '2026-08-02', '{}');
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('En Uno se ve la lesión con el id repetido', (select count(*) from lesiones where id = :'id_borrada'), 1);
select pruebas.esperar('...y su propio historial', (select count(*) from lesiones_historial where lesion_id = :'id_borrada' and despues ->> 'persona' = 'Id repetido'), 1);
select pruebas.esperar('...pero no el de la lesión borrada de Dos', (select count(*) from lesiones_historial where lesion_id = :'id_borrada' and coalesce(despues, antes) ->> 'equipo_id' = '00000000-0000-0000-0000-0000000000c2'), 0);
-- Desde la app, el id de una lesión nueva lo pone la base.
select pruebas.esperar('Una lesión con el id elegido por la app se guarda', pruebas.filas($$insert into lesiones (id, equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-0000000000c1', 'Id elegido', '2026-08-03', '{}')$$), 1);
select pruebas.esperar('...pero con otro id', (select count(*) from lesiones where persona = 'Id elegido' and id <> '00000000-0000-0000-0000-00000000ee01'), 1);
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva ve el historial de su lesión borrada, solo el de Dos', (select count(*) from lesiones_historial where lesion_id = :'id_borrada'), 3);
select pruebas.esperar('...con lo que se corrigió', (select count(*) from lesiones_historial where lesion_id = :'id_borrada' and accion = 'editada' and despues -> 'datos' ->> 'comentarios' = 'dato clínico corregido de Dos'), 1);
reset role;
select pruebas.esperar('Todo cambio de lesión queda con su club', (select count(*) from lesiones_historial where equipo_id is null), 0);

-- Una lesión es de un jugador de su club (como una evaluación).
select set_config('request.jwt.claims', '', false);
insert into jugadores (id, nombre, equipo_id) overriding system value values
  (9005, 'SE VA A DOS', '00000000-0000-0000-0000-0000000000c1');
insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos)
values (:C1, 9005, '2026-07-01', '{"parte_cuerpo":"pe","lado":"direito"}');
update jugadores set equipo_id = :C2 where id = 9005;
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.debe_fallar('No se carga en Uno una lesión de un jugador de Dos', $$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9003, '2026-09-02', '{"parte_cuerpo":"pe","lado":"esquerdo"}')$$, 'jugador_de_otro_club');
select pruebas.debe_fallar('...ni se le pasa a una lesión de Uno', $$update lesiones set jugador_id = 9003 where jugador_id = 9002 and numero_caso = 600$$, 'jugador_de_otro_club');
select pruebas.esperar('La lesión de un jugador que después se fue a Dos se sigue editando', pruebas.filas($$update lesiones set fecha_alta = '2026-07-20' where jugador_id = 9005$$), 1);
select pruebas.esperar('...y la de un jugador de Uno, también al cambiarle el jugador', pruebas.filas($$update lesiones set jugador_id = 9001 where jugador_id = 9002 and numero_caso = 601$$), 1);
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.debe_fallar('A quien no es de Uno, Uno no le contesta si el jugador es de ahí', $$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9003, '2026-09-03', '{}')$$, 'row-level security');
reset role;
select set_config('request.jwt.claims', '', false);
select pruebas.debe_fallar('Tampoco a mano desde el SQL Editor', $$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9003, '2026-09-04', '{}')$$, 'jugador_de_otro_club');

-- Quién cargó una lesión y quién la cambió lo pone la base.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000017', 'temporal@uno.com', now());
update perfiles set estado = 'autorizado' where email = 'temporal@uno.com';
insert into club_miembros (equipo_id, user_id, rol, partido, flujo, lesiones)
values (:C1, '00000000-0000-0000-0000-000000000017', 'staff', false, false, true);
select pruebas.ser('temporal@uno.com'); set role authenticated;
select pruebas.esperar('Una lesión con otro autor y otra fecha de carga se guarda', pruebas.filas($$insert into lesiones (equipo_id, persona, fecha_lesion, datos, creado_por, creado_en, actualizado_por) values ('00000000-0000-0000-0000-0000000000c1', 'Autor ajeno', '2026-07-05', '{}', '00000000-0000-0000-0000-00000000000e', '2020-01-01', '00000000-0000-0000-0000-00000000000e')$$), 1);
select pruebas.esperar('...pero a nombre de quien la cargó, hoy', (select count(*) from lesiones where persona = 'Autor ajeno' and creado_por = auth.uid() and actualizado_por = auth.uid() and creado_en > now() - interval '1 hour'), 1);
select pruebas.esperar('El autor no se cambia después', pruebas.filas($$update lesiones set creado_por = '00000000-0000-0000-0000-00000000000e', creado_en = '2020-01-01' where persona = 'Autor ajeno'$$), 1);
select pruebas.esperar('...sigue siendo quien la cargó', (select count(*) from lesiones where persona = 'Autor ajeno' and creado_por = auth.uid() and creado_en > now() - interval '1 hour'), 1);
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto la corrige', pruebas.filas($$update lesiones set fecha_alta = '2026-07-10', actualizado_por = '00000000-0000-0000-0000-00000000000e' where persona = 'Autor ajeno'$$), 1);
select pruebas.esperar('...y queda que la cambió él', (select actualizado_por::text from lesiones where persona = 'Autor ajeno'), '00000000-0000-0000-0000-00000000000b');
reset role;
select actualizado_en as cambio_de_beto from lesiones where persona = 'Autor ajeno' \gset
-- Desde Supabase › Authentication › Users, sin la sesión de nadie.
select set_config('request.jwt.claims', '', false);
select pruebas.esperar('Se borra la cuenta de quien la cargó', pruebas.filas($$delete from auth.users where id = '00000000-0000-0000-0000-000000000017'$$), 1);
select pruebas.esperar('...y la lesión queda sin autor, con quien la cambió y cuándo', (select count(*) from lesiones where persona = 'Autor ajeno' and creado_por is null and actualizado_por = '00000000-0000-0000-0000-00000000000b' and actualizado_en = :'cambio_de_beto'), 1);

-- Una invitación cambiada pasa por el mismo control que al invitar, y quién
-- invitó no cambia.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto invita a alguien', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'cambiada@x.com')$$), 1);
select pruebas.debe_fallar('...no le cambia el autor (a Eva, de otro club)', $$update club_invitaciones set creado_por = '00000000-0000-0000-0000-00000000000e' where email = 'cambiada@x.com'$$, 'permission denied');
select pruebas.debe_fallar('...ni el correo', $$update club_invitaciones set email = 'otra@x.com' where email = 'cambiada@x.com'$$, 'permission denied');
reset role;
-- Igual la base lo controla al cambiarla (a mano, en el SQL Editor).
select pruebas.esperar('Cambiar el autor de una invitación', pruebas.filas($$update club_invitaciones set creado_por = '00000000-0000-0000-0000-00000000000e' where email = 'cambiada@x.com'$$), 1);
select pruebas.esperar('...no cambia quién invitó', (select creado_por::text from club_invitaciones where email = 'cambiada@x.com'), '00000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar('Un correo inválido no entra al cambiarla', $$update club_invitaciones set email = 'NO ES UN CORREO' where email = 'cambiada@x.com'$$, 'correo_invalido');
select pruebas.esperar('...y uno válido entra limpio', pruebas.filas($$update club_invitaciones set email = ' Cambiada2@X.com ' where email = 'cambiada@x.com'$$), 1);
select pruebas.esperar('...en minúsculas y sin espacios', (select count(*) from club_invitaciones where email = 'cambiada2@x.com'), 1);
-- Se registra (Supabase Auth, sin la sesión de nadie).
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000018', 'cambiada2@x.com', now());
select pruebas.esperar('Al entrar, la historia dice que la invitó Beto', (select quien::text from club_miembros_historial where user_id = '00000000-0000-0000-0000-000000000018' and accion = 'alta'), '00000000-0000-0000-0000-00000000000b');

-- La API de OpenField (lib/openfieldAuth.js) pregunta puede_usar('flujo')
-- con el token de cada uno: sale de las membresías, no de los permisos
-- viejos de perfiles.
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000016', 'vieja@uno.com', now());
update perfiles set estado = 'autorizado', partido = true, flujo = true where email = 'vieja@uno.com';
insert into club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones)
values (:C1, '00000000-0000-0000-0000-000000000016', '2026-01-01', current_date - 1, 'staff', true, true, false);
update perfiles set flujo = false where email = 'fede@libre.com';
select pruebas.ser('vieja@uno.com'); set role authenticated;
select pruebas.esperar('Quien se fue de su único club no tiene Flujo diario, aunque su perfil viejo lo diga', public.puede_usar('flujo')::text, 'false');
reset role;
select pruebas.ser('fede@libre.com'); set role authenticated;
select pruebas.esperar('Quien entró por invitación con Flujo diario lo tiene, aunque su perfil viejo no', public.puede_usar('flujo')::text, 'true');
reset role;

-- Al club se entra por invitación: un administrador de club no suma a mano
-- una cuenta cualquiera (y con eso leía su perfil).
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto no ve la cuenta de alguien ajeno a Uno', (select count(*) from perfiles where email = 'tarde@uno.com'), 0);
select pruebas.debe_fallar('...ni la suma a Uno por su id, sin invitación', $$insert into club_miembros (equipo_id, user_id, hasta) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000013', current_date)$$, 'permission denied');
select pruebas.esperar('...así que sigue sin verla', (select count(*) from perfiles where email = 'tarde@uno.com'), 0);
select pruebas.esperar('Beto vuelve a invitar a quien se fue ayer', pruebas.filas($$insert into club_invitaciones (equipo_id, email, flujo) values ('00000000-0000-0000-0000-0000000000c1', 'vieja@uno.com', true)$$), 1);
select pruebas.esperar('...y vuelve a estar en Uno en el acto', (select count(*) from club_miembros where user_id = '00000000-0000-0000-0000-000000000016' and equipo_id = :C1 and hasta is null), 1);
reset role;
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.debe_fallar('Ni el dueño de la plataforma suma a mano', $$insert into club_miembros (equipo_id, user_id, partido, flujo) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000013', false, false)$$, 'permission denied');
reset role;

-- ------------------------------------------------- Lo que firma la base --

-- Lo que esperan el servidor y la app (spec del paso 2): nombres, argumentos
-- y columnas de las funciones nuevas.
select pruebas.esperar('mi_cuenta devuelve lo acordado', pg_get_function_result('public.mi_cuenta()'::regprocedure),
  'TABLE(estado text, dueno text, flujo boolean, catapult boolean, tecnico boolean)');
select pruebas.esperar('panel_clubes, por club solo esto', pg_get_function_result('public.panel_clubes()'::regprocedure),
  'TABLE(equipo_id uuid, nombre text, correo_entidad text, correo_admin text, personas integer)');
select pruebas.esperar('panel_duenos', pg_get_function_result('public.panel_duenos()'::regprocedure),
  'TABLE(user_id uuid, email text, principal boolean, es_mia boolean)');
select pruebas.esperar('panel_historial, las filas de los movimientos', pg_get_function_result('public.panel_historial(integer)'::regprocedure),
  'SETOF plataforma_historial');
select pruebas.esperar('pedidos_sin_club', pg_get_function_result('public.pedidos_sin_club()'::regprocedure),
  'TABLE(id uuid, email text, club_escrito text, pais_escrito text, creado_en timestamp with time zone)');
select pruebas.esperar('mis_pedidos, sin el club al que fue', pg_get_function_result('public.mis_pedidos()'::regprocedure),
  'TABLE(id uuid, club_escrito text, pais_escrito text, estado text, creado_en timestamp with time zone, decidido_en timestamp with time zone)');
select pruebas.esperar('pedidos_del_club', pg_get_function_result('public.pedidos_del_club(uuid)'::regprocedure),
  'TABLE(id uuid, email text, creado_en timestamp with time zone)');
select pruebas.esperar('Los argumentos de las funciones nuevas',
  (select string_agg(p.proname || '(' || pg_get_function_arguments(p.oid) || ')', '; ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('crear_club', 'asignar_entidad', 'agregar_subdueno', 'quitar_subdueno', 'traspasar_principal',
                        'derivar_pedido', 'rechazar_pedido_sin_club', 'pedir_acceso', 'cancelar_pedido',
                        'aceptar_pedido', 'rechazar_pedido', 'salir_del_club', 'panel_historial')),
  'aceptar_pedido(p_id uuid, p_partido boolean, p_flujo boolean, p_lesiones boolean, p_evaluaciones boolean); '
  || 'agregar_subdueno(p_correo text); asignar_entidad(p_equipo uuid, p_correo text); cancelar_pedido(p_id uuid); '
  || 'crear_club(p_nombre text, p_correo_entidad text DEFAULT NULL::text, p_zona text DEFAULT ''America/Sao_Paulo''::text); '
  || 'derivar_pedido(p_id uuid, p_equipo uuid); panel_historial(p_limite integer DEFAULT 50); '
  || 'pedir_acceso(p_club text, p_pais text DEFAULT NULL::text); quitar_subdueno(p_user uuid); '
  || 'rechazar_pedido(p_id uuid); rechazar_pedido_sin_club(p_id uuid); salir_del_club(p_equipo uuid); '
  || 'traspasar_principal(p_user uuid)');

-- ------------------------------------------------------------ Privilegios --

select pruebas.esperar('Ninguna función de public se ejecuta sin cuenta',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')), 0);
select pruebas.esperar('Con cuenta, solo las de la lista (ni disparadores ni internas)',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'acceso_club,aceptar_pedido,agregar_subdueno,asignar_entidad,cancelar_pedido,crear_club,datos_al_dia,derivar_pedido,'
  || 'es_admin_de_club,esta_autorizado,lesiones_etiqueta,lesiones_horas_imagen,mi_cuenta,mis_pedidos,panel_clubes,'
  || 'panel_duenos,panel_historial,pedidos_del_club,pedidos_sin_club,pedir_acceso,puede_editar,puede_usar,'
  || 'puede_usar_catapult_servidor,puede_usar_en,puede_ver,quitar_subdueno,rechazar_pedido,rechazar_pedido_sin_club,'
  || 'salir_del_club,traspasar_principal');
select pruebas.esperar('es_admin() ya no existe', (select count(*) from pg_proc where proname = 'es_admin'), 0);
select pruebas.esperar('...ni lo que nadie usaba', (select count(*) from pg_proc where proname in ('puede_ver_fecha', 'fecha_segura', 'equipos_sumar_creador')), 0);
select pruebas.esperar('Las tablas de los dueños y los pedidos no se tocan desde la API',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('plataforma', 'plataforma_subduenos', 'plataforma_historial', 'club_entidades', 'club_pedidos')
      and (has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
           or has_any_column_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE'))), 0);
select pruebas.esperar('...ni la secuencia de los movimientos', has_sequence_privilege('authenticated', 'public.plataforma_historial_id_seq', 'USAGE, SELECT, UPDATE')::text, 'false');

set role anon;
select pruebas.esperar('Sin cuenta no se lee ninguna tabla ni vista de public',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and coalesce(pruebas.error(format('select 1 from public.%I limit 1', c.relname)), '') not like '%permission denied%'), 0);
select pruebas.debe_fallar('...ni se ve el panel', 'select * from panel_clubes()', 'permission denied');
select pruebas.debe_fallar('...ni mi_cuenta', 'select * from mi_cuenta()', 'permission denied');
select pruebas.debe_fallar('...ni se pide entrar a un club', $$select pedir_acceso('Club Uno')$$, 'permission denied');
reset role;

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Nadie vacía una tabla: partidos', 'truncate registros_partido', 'permission denied');
select pruebas.debe_fallar('...entrenamientos', 'truncate entrenamientos', 'permission denied');
select pruebas.debe_fallar('...clubes', 'truncate equipos cascade', 'permission denied');
select pruebas.debe_fallar('...cuentas de Catapult', 'truncate catapult_cuentas', 'permission denied');
select pruebas.debe_fallar('...ni mueve una secuencia', $$select setval('registros_partido_id_seq', 1)$$, 'permission denied');
select pruebas.debe_fallar('...ni lee los pedidos ni los dueños directo', 'select count(*) from club_pedidos', 'permission denied');
select pruebas.debe_fallar('...ni la plataforma', 'select count(*) from plataforma', 'permission denied');
reset role;

-- ------------------------------------------------------------- Dueños --

-- Una cuenta con el correo de una entidad (para probar que una entidad no
-- puede ser dueña) y el club del token de Catapult en Uno (por SQL, como en
-- producción).
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000025', 'ent1@uno.com', now()),
  ('00000000-0000-0000-0000-000000000026', 'sinconfirmar@prueba.com', null);
update plataforma set catapult_equipo = :C1;

-- La sub-dueña: hace lo mismo que el principal, menos tocar a los dueños.
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pruebas.esperar('La sub-dueña es sub-dueña', (select dueno from mi_cuenta()), 'sub');
select crear_club('  Club   Cuatro ', 'Entidad@Cuatro.com', 'America/Argentina/Buenos_Aires') as club_cuatro \gset
select pruebas.esperar('Crea un club, con el nombre limpio', (select nombre from panel_clubes() where equipo_id = :'club_cuatro'), 'Club Cuatro');
select pruebas.esperar('...con su entidad', (select correo_entidad from panel_clubes() where equipo_id = :'club_cuatro'), 'entidad@cuatro.com');
select pruebas.esperar('...vacío: sin administrador y sin gente', (select count(*) from panel_clubes() where equipo_id = :'club_cuatro' and correo_admin is null and personas = 0), 1);
select pruebas.esperar('...y no queda adentro', (select count(*) from equipos where id = :'club_cuatro'), 0);
select pruebas.debe_fallar('Dos clubes no se escriben igual (ni con otras tildes o mayúsculas)', $$select crear_club('CLUB CUATRÓ')$$, 'nombre_repetido');
select pruebas.debe_fallar('...ni con el nombre de uno que ya está', $$select crear_club('club uno')$$, 'nombre_repetido');
select pruebas.debe_fallar('...un club sin nombre, no', $$select crear_club('   ')$$, 'nombre_invalido');
select pruebas.debe_fallar('...ni con más de 60 letras', format('select crear_club(%L)', repeat('a', 61)), 'nombre_invalido');
select pruebas.debe_fallar('...ni con una zona horaria que no existe', $$select crear_club('Club Cinco', null, 'Hora/Mala')$$, 'zona_horaria_invalida');
select pruebas.debe_fallar('...ni con una entidad que no sirve (y entonces no se crea)', $$select crear_club('Club Cinco', 'subduenia@prueba.com')$$, 'entidad_es_dueno');
select asignar_entidad(:C1, ' Ent1@Uno.com ');
select pruebas.esperar('Pone la entidad de Uno, en minúsculas', (select correo_entidad from panel_clubes() where equipo_id = :C1), 'ent1@uno.com');
select pruebas.debe_fallar('Su correo no puede ser entidad', $$select asignar_entidad('00000000-0000-0000-0000-0000000000c2', 'subduenia@prueba.com')$$, 'entidad_es_dueno');
select pruebas.debe_fallar('...ni el del principal', $$select asignar_entidad('00000000-0000-0000-0000-0000000000c2', 'DUENIO@prueba.com')$$, 'entidad_es_dueno');
select pruebas.debe_fallar('Una entidad es de un solo club', $$select asignar_entidad('00000000-0000-0000-0000-0000000000c2', 'ent1@uno.com')$$, 'entidad_repetida');
select pruebas.debe_fallar('El correo tiene que ser un correo', $$select asignar_entidad('00000000-0000-0000-0000-0000000000c2', 'cualquiera')$$, 'correo_invalido');
select pruebas.debe_fallar('...y el club, uno que exista', $$select asignar_entidad('00000000-0000-0000-0000-0000000000ff', 'ent9@nueve.com')$$, 'club_inexistente');
select pruebas.esperar('Ve a los dueños (ella, sin ser la principal)', (select string_agg(email || ':' || principal || ':' || es_mia, ',' order by email) from panel_duenos()), 'duenio@prueba.com:true:false,subduenia@prueba.com:false:true');
select pruebas.esperar('...y los movimientos (la semilla, Tres, Cuatro y dos entidades)', (select count(*) from panel_historial() where accion in ('semilla', 'crear_club', 'entidad')), 5);
select pruebas.esperar('...lo más nuevo primero', (select accion from panel_historial(1)), 'entidad');
select pruebas.debe_fallar('No suma dueños', $$select agregar_subdueno('otro@prueba.com')$$, 'solo_dueno_principal');
select pruebas.debe_fallar('...ni los quita', $$select quitar_subdueno('00000000-0000-0000-0000-0000000000d1')$$, 'solo_dueno_principal');
select pruebas.debe_fallar('...ni se queda con el lugar del principal', $$select traspasar_principal('00000000-0000-0000-0000-0000000000d2')$$, 'solo_dueno_principal');
select pruebas.esperar('...ni ve la historia de Uno (la entidad queda ahí, para el club)', (select count(*) from club_miembros_historial where equipo_id = :C1), 0);
reset role;
select pruebas.esperar('La entidad queda en la historia de Uno, sin persona', (select count(*) from club_miembros_historial where equipo_id = :C1 and accion = 'entidad' and user_id is null and quien_email = 'subduenia@prueba.com' and detalle ->> 'email' = 'ent1@uno.com'), 1);
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('...y el administrador de Uno la ve', (select count(*) from club_miembros_historial where equipo_id = :C1 and accion = 'entidad'), 1);
reset role;

-- El principal: además suma, quita y pasa su lugar.
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El principal es el principal', (select dueno from mi_cuenta()), 'principal');
select asignar_entidad(:C2, 'ent2@dos.com');
reset role;
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select asignar_entidad(:C2, 'ent2b@dos.com');
select pruebas.esperar('La sub-dueña cambia la entidad que puso el principal', (select correo_entidad from panel_clubes() where equipo_id = :C2), 'ent2b@dos.com');
select asignar_entidad(:C2, '');
select pruebas.esperar('...y la saca', (select coalesce(correo_entidad, 'sin entidad') from panel_clubes() where equipo_id = :C2), 'sin entidad');
reset role;
select pruebas.esperar('Cada cambio queda en la historia de Dos, con el anterior', (select string_agg(coalesce(detalle ->> 'antes', '-') || '>' || coalesce(detalle ->> 'email', '-'), ',' order by id) from club_miembros_historial where equipo_id = :C2 and accion = 'entidad'), '->ent2@dos.com,ent2@dos.com>ent2b@dos.com,ent2b@dos.com>-');

select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El principal suma a otro como sub-dueño', pruebas.filas($$select agregar_subdueno(' OTRO@prueba.com ')$$), 1);
select pruebas.esperar('...y está en la lista', (select count(*) from panel_duenos() where email = 'otro@prueba.com' and not principal), 1);
select pruebas.debe_fallar('...una sola vez', $$select agregar_subdueno('otro@prueba.com')$$, 'ya_es_dueno');
select pruebas.debe_fallar('Una cuenta que no existe no se suma', $$select agregar_subdueno('nadie@prueba.com')$$, 'cuenta_inexistente');
select pruebas.debe_fallar('...ni una sin el correo confirmado', $$select agregar_subdueno('sinconfirmar@prueba.com')$$, 'correo_sin_confirmar');
select pruebas.debe_fallar('...ni una bloqueada', $$select agregar_subdueno('gaby@uno.com')$$, 'cuenta_bloqueada');
select pruebas.debe_fallar('...ni la de una entidad', $$select agregar_subdueno('ent1@uno.com')$$, 'es_entidad');
reset role;
select pruebas.esperar('El sub-dueño nuevo, que estaba pendiente, queda autorizado', (select estado from perfiles where email = 'otro@prueba.com'), 'autorizado');
select pruebas.ser('otro@prueba.com'); set role authenticated;
select pruebas.esperar('...y ve el panel', (select count(*) from panel_clubes() where equipo_id in (:C1, :C2)), 2);
select pruebas.esperar('...sin ser miembro de ningún club', (select count(*) from v_mis_clubes), 0);
reset role;
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select quitar_subdueno('00000000-0000-0000-0000-0000000000d3');
select pruebas.esperar('El principal lo quita', (select count(*) from panel_duenos() where email = 'otro@prueba.com'), 0);
select pruebas.debe_fallar('...una sola vez', $$select quitar_subdueno('00000000-0000-0000-0000-0000000000d3')$$, 'no_es_subdueno');
select pruebas.debe_fallar('No se quita a sí mismo', $$select quitar_subdueno(auth.uid())$$, 'dueno_principal');
select pruebas.debe_fallar('...ni pasa su lugar a quien no es sub-dueño', $$select traspasar_principal('00000000-0000-0000-0000-00000000000b')$$, 'no_es_subdueno');
select traspasar_principal('00000000-0000-0000-0000-0000000000d2');
select pruebas.esperar('Pasa su lugar a la sub-dueña y queda como sub-dueño', (select dueno from mi_cuenta()), 'sub');
select pruebas.debe_fallar('...y ya no suma dueños', $$select agregar_subdueno('otro@prueba.com')$$, 'solo_dueno_principal');
reset role;
select pruebas.ser('otro@prueba.com'); set role authenticated;
select pruebas.debe_fallar('Quien dejó de ser dueño ya no ve el panel', 'select * from panel_clubes()', 'solo_duenos');
reset role;
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pruebas.esperar('Ella es la principal', (select dueno from mi_cuenta()), 'principal');
select traspasar_principal('00000000-0000-0000-0000-0000000000d1');
select pruebas.esperar('...y se lo devuelve', (select dueno from mi_cuenta()), 'sub');
reset role;
select pruebas.esperar('Todo queda en los movimientos', (select string_agg(accion, ',' order by id) from plataforma_historial where accion in ('sumar_subdueno', 'quitar_subdueno', 'traspaso')), 'sumar_subdueno,quitar_subdueno,traspaso,traspaso');
select pruebas.esperar('...con quién lo hizo', (select string_agg(quien_email, ',' order by id) from plataforma_historial where accion = 'traspaso'), 'duenio@prueba.com,subduenia@prueba.com');

-- Desde el SQL Editor (sin sesión): al principal no se lo saca.
select set_config('request.jwt.claims', '', false);
select pruebas.debe_fallar('La cuenta del principal no se borra', $$delete from auth.users where email = 'duenio@prueba.com'$$, 'foreign key');
select pruebas.debe_fallar('...ni se bloquea', $$update perfiles set estado = 'bloqueado' where email = 'duenio@prueba.com'$$, 'dueno_principal');
select pruebas.debe_fallar('La plataforma no se queda sin su fila', 'delete from plataforma', 'dueno_principal');
select pruebas.debe_fallar('...ni se vacía', 'truncate plataforma', 'dueno_principal');
select pruebas.debe_fallar('...ni pasa a una cuenta bloqueada', $$update plataforma set dueno_principal = '00000000-0000-0000-0000-000000000010'$$, 'dueno_principal_invalido');
select pruebas.debe_fallar('...ni a una sin el correo confirmado', $$update plataforma set dueno_principal = '00000000-0000-0000-0000-000000000026'$$, 'dueno_principal_invalido');
select pruebas.esperar('A un sub-dueño sí se lo bloquea por SQL', pruebas.filas($$update perfiles set estado = 'bloqueado' where email = 'subduenia@prueba.com'$$), 1);
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pruebas.debe_fallar('...y bloqueado ya no es dueño', 'select * from panel_clubes()', 'solo_duenos');
reset role;
select set_config('request.jwt.claims', '', false);
update perfiles set estado = 'autorizado' where email = 'subduenia@prueba.com';

-- Quien no es dueño.
select pruebas.ser('ana@uno.com'); set role authenticated;
select pruebas.debe_fallar('Ana no ve el panel', 'select * from panel_clubes()', 'solo_duenos');
select pruebas.debe_fallar('...ni los dueños', 'select * from panel_duenos()', 'solo_duenos');
select pruebas.debe_fallar('...ni los movimientos', 'select * from panel_historial()', 'solo_duenos');
select pruebas.debe_fallar('...ni los pedidos sin club', 'select * from pedidos_sin_club()', 'solo_duenos');
select pruebas.debe_fallar('...no crea clubes', $$select crear_club('Club de Ana')$$, 'solo_duenos');
select pruebas.debe_fallar('...ni pone entidades', $$select asignar_entidad('00000000-0000-0000-0000-0000000000c1', 'ana2@uno.com')$$, 'solo_duenos');
select pruebas.debe_fallar('...ni suma dueños', $$select agregar_subdueno('ana@uno.com')$$, 'solo_dueno_principal');
select pruebas.esperar('...y no es dueña', (select coalesce(dueno, 'no') from mi_cuenta()), 'no');
reset role;

-- mi_cuenta, para el servidor: Catapult solo con Flujo en el club del token.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto (Flujo en Uno, el club del token): autorizado, con Flujo y Catapult, sin ser técnico',
  (select estado || ',' || coalesce(dueno, '-') || ',' || flujo || ',' || catapult || ',' || tecnico from mi_cuenta()), 'autorizado,-,true,true,false');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (Flujo solo en Dos) no usa el Catapult de Uno', (select flujo || ',' || catapult from mi_cuenta()), 'true,false');
reset role;
select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.esperar('Gaby (bloqueada) no usa nada', (select estado || ',' || flujo || ',' || catapult from mi_cuenta()), 'bloqueado,false,false');
reset role;
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El principal, sin Flujo en Uno, tampoco: ni Catapult ni pruebas técnicas', (select catapult || ',' || tecnico from mi_cuenta()), 'false,false');
reset role;
update plataforma set catapult_equipo = (select id from equipos where nombre = 'Atlético Mineiro');
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('Con el token de Atlético, donde tiene Flujo, sí: y es técnico', (select catapult || ',' || tecnico from mi_cuenta()), 'true,true');
reset role;
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pruebas.esperar('La sub-dueña, sin club, no usa Catapult ni es técnica', (select dueno || ',' || catapult || ',' || tecnico from mi_cuenta()), 'sub,false,false');
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto ya no usa Catapult (el token es de otro club)', (select catapult::text from mi_cuenta()), 'false');
reset role;

-- Una cuenta nueva sin invitación queda pendiente y no aparece en ningún lado.
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-000000000020', 'solo@prueba.com', now());
select pruebas.ser('solo@prueba.com'); set role authenticated;
select pruebas.esperar('Una cuenta nueva sin invitación queda pendiente', (select estado || ',' || flujo || ',' || catapult from mi_cuenta()), 'pendiente,false,false');
select pruebas.esperar('...sin ningún club', (select count(*) from v_mis_clubes), 0);
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('...y nadie la ve', (select count(*) from perfiles where email = 'solo@prueba.com'), 0);
reset role;

-- Un administrador bloqueado no cuenta: ni en el panel ni como reemplazo.
select set_config('request.jwt.claims', '', false);
update club_miembros set rol = 'admin' where equipo_id = :C2 and user_id = '00000000-0000-0000-0000-00000000000f';
update perfiles set estado = 'bloqueado' where email = 'fede@libre.com';
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El panel muestra solo al administrador que puede actuar', (select correo_admin from panel_clubes() where equipo_id = :C2), 'eva@dos.com');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.debe_fallar('Eva no se va: el otro administrador está bloqueado', $$select salir_del_club('00000000-0000-0000-0000-0000000000c2')$$, 'ultimo_admin');
reset role;
select set_config('request.jwt.claims', '', false);
update perfiles set estado = 'autorizado' where email = 'fede@libre.com';
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('Habilitado, vuelve a aparecer', (select correo_admin from panel_clubes() where equipo_id = :C2), 'eva@dos.com, fede@libre.com');
reset role;
select set_config('request.jwt.claims', '', false);
update club_miembros set rol = 'staff' where equipo_id = :C2 and user_id = '00000000-0000-0000-0000-00000000000f';

-- ------------------------------------------------- Pedidos de acceso --

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000021', 'pide1@prueba.com', now()),
  ('00000000-0000-0000-0000-000000000022', 'pide2@prueba.com', now()),
  ('00000000-0000-0000-0000-000000000023', 'pide3@prueba.com', now());

-- Pide1 escribe el nombre de Uno a su manera; pide2, uno que no está. Los
-- dos ven lo mismo.
select pruebas.ser('pide1@prueba.com'); set role authenticated;
select pedir_acceso('  club   ÚNO ', ' Argentina ') as pedido1 \gset
select pruebas.esperar('Pide1 pide entrar y ve su pedido esperando, como lo escribió', (select club_escrito || '|' || pais_escrito || '|' || estado || '|' || coalesce(decidido_en::text, '-') from mis_pedidos()), 'club ÚNO|Argentina|abierto|-');
select pruebas.debe_fallar('...no ve a qué club fue', 'select equipo_id from mis_pedidos()', 'equipo_id');
select pruebas.debe_fallar('...ni lee los pedidos', 'select count(*) from club_pedidos', 'permission denied');
select pruebas.debe_fallar('...ni pide otro mientras espera', $$select pedir_acceso('Club Dos FC')$$, 'ya_hay_un_pedido');
select pruebas.debe_fallar('...ni ve los pedidos de Uno', $$select * from pedidos_del_club('00000000-0000-0000-0000-0000000000c1')$$, 'solo_admin');
select pruebas.debe_fallar('...ni se acepta solo', format('select aceptar_pedido(%L, true, true, true, true)', :'pedido1'), 'solo_admin');
reset role;
select pruebas.ser('pide2@prueba.com'); set role authenticated;
select pedir_acceso('Club Inexistente') as pedido2 \gset
select pruebas.esperar('Pide2 pide un club que no está y ve lo mismo', (select club_escrito || '|' || coalesce(pais_escrito, '-') || '|' || estado from mis_pedidos()), 'Club Inexistente|-|abierto');
reset role;
select pruebas.ser('pide3@prueba.com'); set role authenticated;
select pruebas.debe_fallar('Un nombre de una letra no es un club', $$select pedir_acceso(' x ')$$, 'club_invalido');
select pruebas.debe_fallar('...ni uno de más de 80', format('select pedir_acceso(%L)', repeat('a', 81)), 'club_invalido');
reset role;
select pruebas.ser('sinconfirmar@prueba.com'); set role authenticated;
select pruebas.debe_fallar('Sin el correo confirmado no se pide', $$select pedir_acceso('Club Uno')$$, 'correo_sin_confirmar');
reset role;
select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.debe_fallar('Una cuenta bloqueada no pide', $$select pedir_acceso('Club Dos FC')$$, 'cuenta_bloqueada');
reset role;
select pruebas.esperar('El de pide1 fue a Uno; el de pide2, a ningún club', (select string_agg(email || ':' || coalesce(equipo_id::text, 'ninguno'), ',' order by email) from club_pedidos), 'pide1@prueba.com:00000000-0000-0000-0000-0000000000c1,pide2@prueba.com:ninguno');

-- El administrador del club decide: Beto acepta a pide1 con Partido y
-- Evaluaciones.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto (admin de Uno) ve el pedido de pide1, no el de pide2', (select string_agg(email, ',') from pedidos_del_club(:C1)), 'pide1@prueba.com');
select aceptar_pedido(:'pedido1', true, false, false, true);
select pruebas.esperar('...lo acepta y sale de la lista', (select count(*) from pedidos_del_club(:C1)), 0);
select pruebas.esperar('...pide1 queda en Uno como staff, con esos módulos', (select rol || ',' || partido || ',' || flujo || ',' || lesiones || ',' || evaluaciones from club_miembros where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-000000000021' and hasta is null), 'staff,true,false,false,true');
select pruebas.debe_fallar('Un pedido aceptado no se vuelve a decidir', format('select rechazar_pedido(%L)', :'pedido1'), 'pedido_cerrado');
reset role;
select pruebas.esperar('pide1 quedó autorizada', (select estado from perfiles where email = 'pide1@prueba.com'), 'autorizado');
select pruebas.esperar('...y la historia de Uno dice que la sumó Beto', (select quien_email from club_miembros_historial where user_id = '00000000-0000-0000-0000-000000000021' and accion = 'alta'), 'beto@uno.com');
select pruebas.ser('pide1@prueba.com'); set role authenticated;
select pruebas.esperar('pide1 ve su pedido aceptado', (select estado || ',' || (decidido_en is not null) from mis_pedidos()), 'aceptado,true');
select pruebas.esperar('...está en Uno', (select count(*) from v_mis_clubes where id = :C1 and hasta is null), 1);
select pruebas.esperar('...y ve sus partidos', (select count(*) > 0 from registros_partido where equipo_id = :C1)::text, 'true');
reset role;

-- Rechazar: sale de la lista del club y la persona puede volver a pedir.
select pruebas.ser('pide3@prueba.com'); set role authenticated;
select pedir_acceso('Club Uno', 'Brasil') as pedido3 \gset
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.debe_fallar('Eva (admin de Dos) no ve los pedidos de Uno', $$select * from pedidos_del_club('00000000-0000-0000-0000-0000000000c1')$$, 'solo_admin');
select pruebas.debe_fallar('...ni acepta uno', format('select aceptar_pedido(%L, true, true, true, true)', :'pedido3'), 'solo_admin');
select pruebas.debe_fallar('...ni lo rechaza', format('select rechazar_pedido(%L)', :'pedido3'), 'solo_admin');
reset role;
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.debe_fallar('El staff de Uno no ve los pedidos', $$select * from pedidos_del_club('00000000-0000-0000-0000-0000000000c1')$$, 'solo_admin');
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select rechazar_pedido(:'pedido3');
select pruebas.esperar('Beto rechaza el de pide3: sale de la lista', (select count(*) from pedidos_del_club(:C1)), 0);
reset role;
select pruebas.ser('pide3@prueba.com'); set role authenticated;
select pruebas.esperar('pide3 ve que no fue aceptado', (select estado from mis_pedidos()), 'rechazado');
select pruebas.esperar('...sigue sin club', (select count(*) from v_mis_clubes), 0);
select pedir_acceso('Club Uno') as pedido3b \gset
select pruebas.esperar('...y vuelve a pedir', (select string_agg(estado, ',' order by creado_en desc) from mis_pedidos()), 'abierto,rechazado');
select cancelar_pedido(:'pedido3b');
select pruebas.esperar('...o cancela su pedido', (select string_agg(estado, ',' order by creado_en desc) from mis_pedidos()), 'cancelado,rechazado');
select pruebas.debe_fallar('...una sola vez', format('select cancelar_pedido(%L)', :'pedido3b'), 'pedido_cerrado');
select pruebas.debe_fallar('...y no cancela el de otro', format('select cancelar_pedido(%L)', :'pedido2'), 'pedido_cerrado');
reset role;

-- Quien ya está en Uno puede pedir Uno: se guarda sin decir nada, y aceptarlo
-- no le cambia nada.
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pedir_acceso('Club Uno') as pedido_nuevo \gset
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select aceptar_pedido(:'pedido_nuevo', true, true, true, true);
select pruebas.esperar('Aceptar a quien ya está no le cambia los módulos', (select partido || ',' || flujo || ',' || lesiones from club_miembros where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-000000000012'), 'false,false,true');
reset role;

-- Una invitación al club resuelve el pedido que había.
select pruebas.ser('pide3@prueba.com'); set role authenticated;
select pedir_acceso('Club Uno') as pedido3c \gset
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto invita a pide3 en vez de aceptar el pedido', pruebas.filas($$insert into club_invitaciones (equipo_id, email, partido) values ('00000000-0000-0000-0000-0000000000c1', 'pide3@prueba.com', true)$$), 1);
select pruebas.esperar('...el pedido deja de estar en la lista', (select count(*) from pedidos_del_club(:C1)), 0);
reset role;
select pruebas.ser('pide3@prueba.com'); set role authenticated;
select pruebas.esperar('...y pide3 lo ve aceptado, adentro de Uno', (select (select estado from mis_pedidos() order by creado_en desc limit 1) || ',' || count(*) from v_mis_clubes where id = :C1 and hasta is null), 'aceptado,1');
reset role;

-- Los dueños: ven los pedidos que no coinciden con ningún club, los mandan a
-- un club o los rechazan. Nunca aceptan gente ni ven los pedidos de un club.
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pruebas.esperar('Los dueños ven el pedido sin club', (select string_agg(email || '|' || club_escrito || '|' || coalesce(pais_escrito, '-'), ',') from pedidos_sin_club()), 'pide2@prueba.com|Club Inexistente|-');
select pruebas.debe_fallar('...no ven los pedidos de un club ajeno', $$select * from pedidos_del_club('00000000-0000-0000-0000-0000000000c1')$$, 'solo_admin');
select pruebas.debe_fallar('...ni aceptan gente', format('select aceptar_pedido(%L, true, true, true, true)', :'pedido2'), 'solo_admin');
select pruebas.debe_fallar('...ni mandan un pedido a un club que no existe', format('select derivar_pedido(%L, %L)', :'pedido2', '00000000-0000-0000-0000-0000000000ff'), 'club_inexistente');
select derivar_pedido(:'pedido2', :C2);
select pruebas.esperar('...lo mandan a Dos', (select count(*) from pedidos_sin_club()), 0);
select pruebas.debe_fallar('...una sola vez', format('select derivar_pedido(%L, %L)', :'pedido2', '00000000-0000-0000-0000-0000000000c1'), 'pedido_cerrado');
select pruebas.debe_fallar('...ni lo rechazan después', format('select rechazar_pedido_sin_club(%L)', :'pedido2'), 'pedido_cerrado');
select pruebas.debe_fallar('...ni tocan uno que ya era de un club', format('select derivar_pedido(%L, %L)', :'pedido3', '00000000-0000-0000-0000-0000000000c2'), 'pedido_cerrado');
reset role;
select pruebas.ser('pide2@prueba.com'); set role authenticated;
select pruebas.esperar('pide2 sigue viendo lo mismo: esperando', (select estado from mis_pedidos()), 'abierto');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (admin de Dos) lo ve', (select string_agg(email, ',') from pedidos_del_club(:C2)), 'pide2@prueba.com');
select aceptar_pedido(:'pedido2', false, true, false, false);
reset role;
select pruebas.ser('pide2@prueba.com'); set role authenticated;
select pruebas.esperar('...lo acepta y pide2 entra a Dos con Flujo diario', (select count(*) from v_mis_clubes where id = :C2 and hasta is null and flujo and not partido), 1);
select pedir_acceso('Club Fantasma', 'Uruguay') as pedido2b \gset
reset role;
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select rechazar_pedido_sin_club(:'pedido2b');
select pruebas.esperar('El principal rechaza un pedido sin club', (select count(*) from pedidos_sin_club()), 0);
reset role;
select pruebas.ser('pide2@prueba.com'); set role authenticated;
select pruebas.esperar('...y la persona lo ve como cualquier rechazo', (select estado from mis_pedidos() order by creado_en desc limit 1), 'rechazado');
reset role;
select pruebas.esperar('Mandar y rechazar quedan en los movimientos', (select string_agg(accion || ':' || email, ',' order by id) from plataforma_historial where accion in ('derivar_pedido', 'rechazar_pedido')), 'derivar_pedido:pide2@prueba.com,rechazar_pedido:pide2@prueba.com');

-- ---------------------------------------------- Principal protegido --

-- El dueño principal también trabaja en Uno, como staff (por SQL).
select set_config('request.jwt.claims', '', false);
insert into club_miembros (equipo_id, user_id, rol, partido, flujo, lesiones) values (:C1, '00000000-0000-0000-0000-0000000000d1', 'staff', true, true, false);
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Beto (admin de Uno) no le da de baja al dueño principal', $$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d1'$$, 'dueno_protegido');
select pruebas.debe_fallar('...ni le cambia los módulos', $$update club_miembros set lesiones = true where user_id = '00000000-0000-0000-0000-0000000000d1'$$, 'dueno_protegido');
select pruebas.debe_fallar('...ni lo hace administrador', $$update club_miembros set rol = 'admin' where user_id = '00000000-0000-0000-0000-0000000000d1'$$);
reset role;
select pruebas.esperar('Sigue en Uno como estaba', (select coalesce(hasta::text, 'sigue') || ',' || lesiones from club_miembros where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-0000000000d1'), 'sigue,false');
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.debe_fallar('Estando en Uno, igual no ve sus pedidos (no es el administrador)', $$select * from pedidos_del_club('00000000-0000-0000-0000-0000000000c1')$$, 'solo_admin');
select salir_del_club(:C1);
select pruebas.esperar('Él sí se va, con salir_del_club', (select hasta::text from v_mis_clubes where id = :C1), current_date::text);
-- Y vuelve por un pedido, que acepta Beto.
select pedir_acceso('Club Uno') as pedido_principal \gset
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select aceptar_pedido(:'pedido_principal', true, false, false, false);
select pruebas.esperar('Beto lo acepta: vuelve a Uno', (select count(*) from club_miembros where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-0000000000d1' and hasta is null), 1);
select pruebas.debe_fallar('...y otra vez no lo puede sacar', $$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d1'$$, 'dueno_protegido');
reset role;
select pruebas.debe_fallar('Desde el SQL Editor con la sesión de Beto, tampoco se borra', $$delete from club_miembros where user_id = '00000000-0000-0000-0000-0000000000d1' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$, 'dueno_protegido');
select set_config('request.jwt.claims', '', false);
select pruebas.esperar('Sin sesión (el SQL Editor), sí', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d1' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);

-- ------------------------------------------------------------- Notas --

-- Cada nota es de un club: la escribe y la ve la gente que sigue en ese club.
-- Dos clubes nuevos para no depender de lo que cambió arriba: en Siete, Iván
-- (admin), Juana (staff) y Kevin (se fue); en Ocho, Lía.
reset role;
select set_config('request.jwt.claims', '', false);
insert into public.equipos (id, nombre) values
  ('00000000-0000-0000-0000-0000000000c3', 'Club Siete'),
  ('00000000-0000-0000-0000-0000000000c4', 'Club Ocho');
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000031', 'ivan@siete.com', now()),
  ('00000000-0000-0000-0000-000000000032', 'juana@siete.com', now()),
  ('00000000-0000-0000-0000-000000000033', 'kevin@siete.com', now()),
  ('00000000-0000-0000-0000-000000000034', 'lia@ocho.com', now());
update public.perfiles set estado = 'autorizado'
 where email in ('ivan@siete.com', 'juana@siete.com', 'kevin@siete.com', 'lia@ocho.com');
insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones) values
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000031', '2026-01-01', null, 'admin', true, false, false),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000032', '2026-01-01', null, 'staff', false, false, false),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000033', '2026-01-01', current_date - 1, 'staff', true, false, false),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000034', '2026-01-01', null, 'admin', true, false, false);

select pruebas.ser('juana@siete.com'); set role authenticated;
select pruebas.esperar('Juana (staff, sin ningún módulo) anota una mejora en su club', pruebas.filas($$insert into notas (equipo_id, texto) values ('00000000-0000-0000-0000-0000000000c3', '  Filtro por fecha  ')$$), 1);
select pruebas.esperar('...sin los espacios de las puntas', (select count(*) from notas where texto = 'Filtro por fecha'), 1);
select pruebas.esperar('...y la base anota que la escribió ella', (select creado_email from notas where texto = 'Filtro por fecha'), 'juana@siete.com');
select pruebas.debe_fallar('No elige quién la escribió', $$insert into notas (equipo_id, texto, creado_por) values ('00000000-0000-0000-0000-0000000000c3', 'otra', '00000000-0000-0000-0000-000000000031')$$, 'permission denied');
select pruebas.debe_fallar('No elige la fecha', $$insert into notas (equipo_id, texto, creado_en) values ('00000000-0000-0000-0000-0000000000c3', 'otra', '2020-01-01')$$, 'permission denied');
select pruebas.debe_fallar('Una nota vacía no entra', $$insert into notas (equipo_id, texto) values ('00000000-0000-0000-0000-0000000000c3', '   ')$$, 'notas_texto_check');
select pruebas.debe_fallar('No anota en un club donde no está', $$insert into notas (equipo_id, texto) values ('00000000-0000-0000-0000-0000000000c4', 'hola')$$, 'row-level security');
select pruebas.esperar('La corrige', pruebas.filas($$update notas set texto = 'Filtro por fecha y por rival' where texto = 'Filtro por fecha'$$), 1);
select pruebas.debe_fallar('...pero no le cambia el autor', $$update notas set creado_por = null$$, 'permission denied');
select pruebas.debe_fallar('...ni el club', $$update notas set equipo_id = '00000000-0000-0000-0000-0000000000c4'$$, 'permission denied');
reset role;
select pruebas.ser('ivan@siete.com'); set role authenticated;
select pruebas.esperar('Iván, del mismo club, la ve', (select count(*) from notas where texto = 'Filtro por fecha y por rival'), 1);
select pruebas.esperar('...la marca como hecha', pruebas.filas($$update notas set hecha = true where texto = 'Filtro por fecha y por rival'$$), 1);
select pruebas.debe_fallar('...pero no le corrige el texto: es de Juana', $$update notas set texto = 'otra cosa' where texto = 'Filtro por fecha y por rival'$$, 'solo_quien_la_escribio');
select pruebas.esperar('Iván anota la suya', pruebas.filas($$insert into notas (equipo_id, texto) values ('00000000-0000-0000-0000-0000000000c3', 'Exportar a PDF')$$), 1);
reset role;
select pruebas.ser('juana@siete.com'); set role authenticated;
select pruebas.esperar('Juana no borra la de Iván', pruebas.filas($$delete from notas where texto = 'Exportar a PDF'$$), 0);
reset role;
select pruebas.ser('kevin@siete.com'); set role authenticated;
select pruebas.esperar('Kevin, que se fue de Siete, ya no las ve', (select count(*) from notas), 0);
select pruebas.debe_fallar('...ni anota', $$insert into notas (equipo_id, texto) values ('00000000-0000-0000-0000-0000000000c3', 'hola')$$, 'row-level security');
reset role;
select pruebas.ser('lia@ocho.com'); set role authenticated;
select pruebas.esperar('Lía, de otro club (y admin del suyo), no ve las de Siete', (select count(*) from notas), 0);
select pruebas.esperar('...ni las cambia', pruebas.filas($$update notas set hecha = false$$), 0);
select pruebas.esperar('...ni las borra', pruebas.filas($$delete from notas$$), 0);
reset role;
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El dueño de la plataforma tampoco ve las notas de un club donde no está', (select count(*) from notas), 0);
reset role;
set role anon;
select pruebas.debe_fallar('Sin sesión, nada', $$select count(*) from notas$$, 'permission denied');
reset role;
select pruebas.ser('ivan@siete.com'); set role authenticated;
select pruebas.esperar('Iván, administrador de Siete, borra la de Juana', pruebas.filas($$delete from notas where texto = 'Filtro por fecha y por rival'$$), 1);
reset role;
select pruebas.ser('juana@siete.com'); set role authenticated;
select pruebas.esperar('...y Juana ve solo la de Iván', (select count(*) from notas), 1);
reset role;

select 'ESCENARIOS: todos bien' as resultado;
