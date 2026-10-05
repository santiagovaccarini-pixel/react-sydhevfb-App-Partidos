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

select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El dueño ve todos los clubes', (select count(*) from equipos where id in (:C1, :C2)), 2);
select pruebas.esperar('...pero no los datos de un club donde no está', (select count(*) from registros_partido where equipo_id = :C1), 0);
select pruebas.esperar('...ni sus lesiones', (select count(*) from lesiones where equipo_id = :C1), 0);
select pruebas.esperar('...y sí la gente de cada club', (select count(*) from club_miembros where equipo_id = :C1), 5);
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
select pruebas.esperar('Ana no cambia el estado de una cuenta', pruebas.filas($$update perfiles set estado = 'bloqueado' where email = 'beto@uno.com'$$), 0);
select pruebas.esperar('Ana le da Lesiones a Beto', pruebas.filas($$update club_miembros set lesiones = true where user_id = '00000000-0000-0000-0000-00000000000b'$$), 1);
select pruebas.debe_fallar('Ana no pone una salida futura', $$update club_miembros set hasta = current_date + 5 where user_id = '00000000-0000-0000-0000-00000000000b'$$, 'hasta_futura');
select pruebas.debe_fallar('Ana no muda una membresía a otro club', $$update club_miembros set equipo_id = '00000000-0000-0000-0000-0000000000c2' where user_id = '00000000-0000-0000-0000-00000000000b'$$);
select pruebas.debe_fallar('Ana no se saca el rol: es la única administradora', $$update club_miembros set rol = 'staff' where user_id = auth.uid()$$, 'ultimo_admin');
select pruebas.debe_fallar('Ana no se va: es la única administradora', $$update club_miembros set hasta = current_date where user_id = auth.uid()$$, 'ultimo_admin');
select pruebas.esperar('Ana le saca Lesiones a Darío (ya se fue)', pruebas.filas($$update club_miembros set lesiones = false where user_id = '00000000-0000-0000-0000-00000000000d' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('Eva no está en Uno: Ana no la puede tocar en Dos', pruebas.filas($$update club_miembros set rol = 'staff' where equipo_id = '00000000-0000-0000-0000-0000000000c2'$$), 0);
reset role;

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto ahora ve las lesiones', (select count(*) from lesiones), 3);
reset role;

select pruebas.ser('dario@uno.com'); set role authenticated;
select pruebas.esperar('Darío sin Lesiones en Uno ya no ve ni la foto de las de antes', (select count(*) from datos_al_dia('lesiones', :C1)), 0);
reset role;

-- Ana nombra a Beto administrador y recién ahí se puede ir.
select pruebas.ser('ana@uno.com'); set role authenticated;
select pruebas.esperar('Ana nombra a Beto administrador', pruebas.filas($$update club_miembros set rol = 'admin' where user_id = '00000000-0000-0000-0000-00000000000b'$$), 1);
select pruebas.esperar('Ahora Ana se puede ir', pruebas.filas($$update club_miembros set hasta = current_date where user_id = auth.uid()$$), 1);
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
select pruebas.esperar('Una invitación vencida', pruebas.filas($$insert into club_invitaciones (equipo_id, email, vence_en) values ('00000000-0000-0000-0000-0000000000c1', 'tarde@uno.com', now() - interval '1 day')$$), 1);
select pruebas.esperar('Una invitación cancelada', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'arrepentido@uno.com')$$), 1);
select pruebas.esperar('...que se cancela', pruebas.filas($$update club_invitaciones set cancelada_en = now() where email = 'arrepentido@uno.com'$$), 1);
reset role;

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
select pruebas.debe_fallar('Un admin de club no crea clubes', $$insert into equipos (nombre) values ('Club Pirata')$$, 'row-level security');
select pruebas.debe_fallar('Ni toca los ajustes generales', $$insert into ajustes (clave, valor) values ('x', 'y')$$, 'row-level security');
reset role;

select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El dueño crea un club', pruebas.filas($$insert into equipos (id, nombre) values ('00000000-0000-0000-0000-0000000000c3', 'Club Tres')$$), 1);
select pruebas.esperar('...y queda como su administrador', (select rol from club_miembros where equipo_id = '00000000-0000-0000-0000-0000000000c3' and user_id = auth.uid()), 'admin');
select pruebas.esperar('...con todos los módulos, también Evaluaciones', (select evaluaciones::text from club_miembros where equipo_id = '00000000-0000-0000-0000-0000000000c3' and user_id = auth.uid()), 'true');
select pruebas.esperar('El dueño bloquea una cuenta', pruebas.filas($$update perfiles set estado = 'bloqueado' where email = 'beto@uno.com'$$), 1);
select pruebas.esperar('...pero no la suya', pruebas.filas($$update perfiles set estado = 'bloqueado' where user_id = auth.uid()$$), 0);
reset role;

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto bloqueado no ve nada', (select count(*) from registros_partido), 0);
select pruebas.esperar('...ni administra', pruebas.filas($$update club_miembros set partido = false$$), 0);
reset role;

select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El dueño le devuelve el acceso', pruebas.filas($$update perfiles set estado = 'autorizado' where email = 'beto@uno.com'$$), 1);
select pruebas.esperar('El dueño borra un club con gente adentro', pruebas.filas($$delete from equipos where id = '00000000-0000-0000-0000-0000000000c3'$$), 1);
reset role;

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
select pruebas.esperar('...le cambia el autor (a Eva, de otro club)', pruebas.filas($$update club_invitaciones set creado_por = '00000000-0000-0000-0000-00000000000e' where email = 'cambiada@x.com'$$), 1);
select pruebas.esperar('...pero sigue diciendo que invitó Beto', (select creado_por::text from club_invitaciones where email = 'cambiada@x.com'), '00000000-0000-0000-0000-00000000000b');
select pruebas.debe_fallar('Un correo inválido no entra al cambiarla', $$update club_invitaciones set email = 'NO ES UN CORREO' where email = 'cambiada@x.com'$$, 'correo_invalido');
select pruebas.esperar('...y uno válido entra limpio', pruebas.filas($$update club_invitaciones set email = ' Cambiada2@X.com ' where email = 'cambiada@x.com'$$), 1);
select pruebas.esperar('...en minúsculas y sin espacios', (select count(*) from club_invitaciones where email = 'cambiada2@x.com'), 1);
reset role;
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

select 'ESCENARIOS: todos bien' as resultado;
