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

-- El plan de una consulta, en texto (para ver qué índice usa).
create or replace function pruebas.plan(p_sql text)
returns text language plpgsql as $$
declare
  v_linea text;
  v_plan text := '';
begin
  for v_linea in execute 'explain (costs off) ' || p_sql loop
    v_plan := v_plan || v_linea || E'\n';
  end loop;
  return v_plan;
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

-- Los dos clubes ya confirmaron el consentimiento de sus atletas (20261103);
-- sin confirmar, ver «Consentimiento de los atletas».
insert into public.consentimientos (equipo_id, alcance, texto) values
  ('00000000-0000-0000-0000-0000000000c1', 'club', 'Confirmación de prueba.'),
  ('00000000-0000-0000-0000-0000000000c2', 'club', 'Confirmación de prueba.');
-- Y el de las personas fuera de Datos básicos que se cargan más abajo.
insert into public.consentimientos (equipo_id, alcance, base, personas, texto)
select x.equipo_id::uuid, 'personas', 'lesiones',
       array['Cata Tres', 'Autor ajeno', 'Del Futuro', 'Espía', 'Id elegido', 'Juvenil Invitado', 'Nivel Uno', 'Nueva',
             'Persona de Dos', 'Sin Fecha', 'Desc Uno', 'Desc Dos', 'Desc Tres', 'Desc Otro'],
       'Personas de prueba.'
  from (values ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2')) as x (equipo_id);

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

-- Un club lo cambian solo los dueños de la app (09/10): ni su administrador.
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.debe_fallar('Eva no renombra Uno', $$update equipos set nombre = 'Hackeado' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'permission denied');
select pruebas.debe_fallar('...ni su club, que administra', $$update equipos set nombre = 'Club Dos FC' where id = '00000000-0000-0000-0000-0000000000c2'$$, 'permission denied');
select pruebas.debe_fallar('...ni con la función de los dueños', $$select renombrar_club('00000000-0000-0000-0000-0000000000c2', 'Club Dos FC')$$, 'solo_duenos');
reset role;
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select renombrar_club(:C2, 'Club Dos FC');
reset role;
select pruebas.esperar('El dueño de la app lo renombra', (select nombre from equipos where id = :C2), 'Club Dos FC');

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
-- Cuándo entró cambia solo al reincorporar (eso queda en la historia);
-- cuándo se creó la fila y quién decidió, los anota la base.
select pruebas.filas($$update club_miembros set desde = '1990-01-01' where user_id = '00000000-0000-0000-0000-00000000000b'$$);
select pruebas.esperar('Ana no cambia cuándo entró Beto', (select desde::text from club_miembros where user_id = '00000000-0000-0000-0000-00000000000b'), '2026-01-01');
select pruebas.debe_fallar('...ni cuándo se creó su fila', $$update club_miembros set creado_en = '1990-01-01' where user_id = '00000000-0000-0000-0000-00000000000b'$$, 'permission denied');
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
select pruebas.esperar('...y entra de nuevo hoy', (select desde::text from club_miembros where user_id = '00000000-0000-0000-0000-00000000000d' and equipo_id = :C1), current_date::text);
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
select pruebas.esperar('...ni siquiera tocando solo la cancelación: ya no está abierta', pruebas.filas($$update club_invitaciones set cancelada_en = null where email = 'arrepentido@uno.com'$$), 0);
select pruebas.debe_fallar('...ni se borra', $$delete from club_invitaciones where email = 'arrepentido@uno.com'$$, 'permission denied');
select pruebas.debe_fallar('De una abierta, lo único que hace es cancelarla', $$update club_invitaciones set cancelada_en = null where email = 'hugo@nuevo.com'$$, 'row-level security');
select pruebas.debe_fallar('...no le cambia el rol', $$update club_invitaciones set rol = 'admin' where email = 'hugo@nuevo.com'$$, 'permission denied');
reset role;
-- Igual la base lo frena (a mano, en el SQL Editor con la sesión de Beto, y
-- sin sesión).
select pruebas.debe_fallar('Con la sesión de Beto, por SQL, tampoco se reabre', $$update club_invitaciones set cancelada_en = null where email = 'arrepentido@uno.com'$$, 'invitacion_cancelada');
select pruebas.debe_fallar('...ni cambia de rol', $$update club_invitaciones set rol = 'admin' where email = 'hugo@nuevo.com'$$, 'invitacion_rol_fijo');
select set_config('request.jwt.claims', '', false);
select pruebas.debe_fallar('Sin sesión, una cancelada tampoco se reabre', $$update club_invitaciones set cancelada_en = null where email = 'arrepentido@uno.com'$$, 'invitacion_cancelada');
-- Las de administrador que correr.sh dejó antes de volver a correr la
-- migración de dueños: la abierta pasó a staff; la cancelada y la vencida,
-- que no hacen entrar a nadie, quedaron como estaban.
select pruebas.esperar('La migración pasó a staff la invitación abierta de administrador',
  (select string_agg(email || ':' || rol, ',' order by email) from club_invitaciones where email like 'jefa.%@prueba.com'),
  'jefa.abierta@prueba.com:staff,jefa.cancelada@prueba.com:admin,jefa.vencida@prueba.com:admin');
-- Una invitación vencida, armada en el SQL Editor (con la sesión de Beto: la
-- invitó él).
select pruebas.ser('beto@uno.com');
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
select pruebas.debe_fallar('...ni el nombre (lo cambian solo los dueños de la app)', $$update equipos set nombre = 'Club Uno FC' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'permission denied');
select pruebas.debe_fallar('...ni con la función de los dueños', $$select renombrar_club('00000000-0000-0000-0000-0000000000c1', 'Club Uno FC')$$, 'solo_duenos');
reset role;
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.debe_fallar('El staff de Uno tampoco cambia el nombre', $$update equipos set nombre = 'Club Uno FC' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'permission denied');
select pruebas.debe_fallar('...ni con la función de los dueños', $$select renombrar_club('00000000-0000-0000-0000-0000000000c1', 'Club Uno FC')$$, 'solo_duenos');
reset role;
select pruebas.esperar('Uno sigue con su nombre', (select nombre from equipos where id = :C1), 'Club Uno');

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

-- ------------------------------ Fechas de la vuelta previstas (20261031) --

select pruebas.ser('carla@uno.com'); set role authenticated;
select pruebas.esperar('Carla carga una lesión con la vuelta prevista (fechas futuras)', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, numero_caso, fecha_lesion, fecha_transicion, fecha_retorno_entrenamiento, fecha_alta, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 700, current_date - 10, current_date - 2, current_date + 5, current_date + 12, '{"parte_cuerpo":"tornozelo","lado":"direito"}')$$), 1);
select pruebas.debe_fallar('...pero la fecha de la lesión no puede ser futura', $$insert into lesiones (equipo_id, jugador_id, numero_caso, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 701, current_date + 1, '{"parte_cuerpo":"ombro","lado":"direito"}')$$, 'lesiones_sin_futuro');
select pruebas.esperar('La vista general: con el alta cargada ya no está activa', (select count(*) from v_lesiones where numero_caso = 700 and not activa), 1);
select pruebas.esperar('...la etapa, con la última fecha cargada aunque no haya llegado (20261101)', (select etapa from v_lesiones where numero_caso = 700), 'alta');
select pruebas.esperar('...y los días de baja, hasta hoy', (select dias_baja from v_lesiones where numero_caso = 700), 10);
select pruebas.esperar('Power Query: la recuperación hasta hoy', (select recuperacao from v_lesiones_excel_v1 where n_de_caso = 700), 10);
select pruebas.esperar('...Recup 1 hasta la transición y Recup 2 hasta hoy', (select recup_1 || ',' || recup_2 from v_lesiones_excel_v1 where n_de_caso = 700), '8,10');
select pruebas.esperar('...y sin severidad hasta que llegue el alta', (select coalesce(severidade, 'vacía') from v_lesiones_excel_v1 where n_de_caso = 700), 'vacía');
select pruebas.esperar('Con la vuelta al entrenamiento prevista (sin alta)', pruebas.filas($$insert into lesiones (equipo_id, jugador_id, numero_caso, fecha_lesion, fecha_transicion, fecha_retorno_entrenamiento, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, 702, current_date - 3, current_date + 1, current_date + 2, '{"parte_cuerpo":"joelho","lado":"esquerdo"}')$$), 1);
select pruebas.esperar('...ya dice entrenando y sigue activa (20261101)', (select etapa || ',' || activa from v_lesiones where numero_caso = 702), 'entrenando,true');
select pruebas.esperar('...y Recup 1 y Recup 2 van hasta hoy', (select recup_1 || ',' || recup_2 from v_lesiones where numero_caso = 702), '3,0');
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
select pruebas.debe_fallar('...ni los cambia', $$select evaluaciones_referencia_cambiar('00000000-0000-0000-0000-0000000000c1', 'zona_media', '{categorias,mayor,bueno,lumbar}', '1')$$, 'row-level security');
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
select pruebas.esperar('...cambia uno (y arma la categoría que faltaba)', (select evaluaciones_referencia_cambiar(:C1, 'zona_media', '{categorias,mayor,bueno,lumbar}', '0.127777777777778') #>> '{categorias,mayor,bueno,lumbar}'), '0.127777777777778');
select pruebas.esperar('...suma otro al lado', (select evaluaciones_referencia_cambiar(:C1, 'zona_media', '{categorias,mayor,bueno,prono}', '0.2')::text), '{"categorias": {"mayor": {"bueno": {"prono": 0.2, "lumbar": 0.127777777777778}}}}');
select pruebas.esperar('...vacía uno', (select evaluaciones_referencia_cambiar(:C1, 'zona_media', '{categorias,mayor,bueno,prono}', null)::text), '{"categorias": {"mayor": {"bueno": {"lumbar": 0.127777777777778}}}}');
select pruebas.esperar('...cambia el n del resumen', (select evaluaciones_referencia_cambiar(:C1, 'zona_media', '{resumen,n,mayor}', '29') #>> '{resumen,n,mayor}'), '29');
select pruebas.esperar('...borra una categoría', (select evaluaciones_referencia_cambiar(:C1, 'zona_media', '{categorias,mayor}', null) -> 'categorias')::text, '{}');
select pruebas.esperar('...y la trae de vuelta entera', (select evaluaciones_referencia_cambiar(:C1, 'zona_media', '{categorias,mayor}', '{"bueno":{"lumbar":0.127777777777778}}') #>> '{categorias,mayor,bueno,lumbar}'), '0.127777777777778');
select pruebas.esperar('...empieza los de un test que no tenía', (select evaluaciones_referencia_cambiar(:C1, 'saltos', '{categorias,mayor,bueno,altura}', '40') #>> '{categorias,mayor,bueno,altura}'), '40');
select pruebas.debe_fallar('...pero no en otro lado', $$select evaluaciones_referencia_cambiar('00000000-0000-0000-0000-0000000000c1', 'zona_media', '{otra,cosa}', '1')$$, 'referencia_invalida');
select pruebas.debe_fallar('...ni con un texto', $$select evaluaciones_referencia_cambiar('00000000-0000-0000-0000-0000000000c1', 'zona_media', '{categorias,mayor,bueno,lumbar}', '"mucho"')$$, 'referencia_invalida');
select pruebas.debe_fallar('...ni en un test mal escrito', $$select evaluaciones_referencia_cambiar('00000000-0000-0000-0000-0000000000c1', 'Zona Media', '{categorias,mayor,bueno,lumbar}', '1')$$, 'evaluaciones_referencias_test');
select pruebas.debe_fallar('...ni en otro club', $$select evaluaciones_referencia_cambiar('00000000-0000-0000-0000-0000000000c2', 'zona_media', '{categorias,mayor,bueno,lumbar}', '1')$$, 'row-level security');
select pruebas.esperar('...ni toca los de otro club', pruebas.filas($$update evaluaciones_referencias set datos = '{}' where equipo_id = '00000000-0000-0000-0000-0000000000c2'$$), 0);
select pruebas.debe_fallar('...no pasa unos V.R. a otro test', $$update evaluaciones_referencias set test = 'saltos'$$, 'permission denied');
select pruebas.esperar('...borra los de un test', pruebas.filas($$delete from evaluaciones_referencias where test = 'saltos'$$), 1);
select pruebas.esperar('...y todo queda en el historial, con quién', (select string_agg(accion, ',' order by id) from referencias_historial where tabla = 'evaluaciones_referencias' and quien_email = 'carla@uno.com'), 'editada,editada,editada,editada,editada,editada,creada,editada,borrada');
select pruebas.esperar('...cómo estaba y cómo quedó', (select (antes #>> '{datos,categorias,mayor,bueno,prono}') || '→' || coalesce(despues #>> '{datos,categorias,mayor,bueno,prono}', 'vacío') from referencias_historial where tabla = 'evaluaciones_referencias' and antes #>> '{datos,categorias,mayor,bueno,prono}' is not null), '0.2→vacío');
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
select pruebas.debe_fallar('...ni cambia los valores de referencia', $$select evaluaciones_referencia_cambiar('00000000-0000-0000-0000-0000000000c1', 'zona_media', '{categorias,mayor,bueno,lumbar}', '1')$$, 'row-level security');
select pruebas.esperar('...ni ve su historial', (select count(*) from referencias_historial), 0);
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
select pruebas.debe_fallar('...ni los cambia', $$select evaluaciones_referencia_cambiar('00000000-0000-0000-0000-0000000000c1', 'zona_media', '{categorias,mayor,bueno,lumbar}', '1')$$, 'permission denied');
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

-- --------------------------------------------- Evaluaciones › Ajustes --

-- El nombre de cada cabecera y las opciones de cada lista, por club (como
-- Lesiones › Ajustes). La preparadora tiene Evaluaciones en Uno.
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('La preparadora le cambia el nombre a una cabecera en Uno', pruebas.filas($$insert into evaluaciones_campos (equipo_id, test, campo, etiqueta_es, etiqueta_pt) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 'lumbar', 'Lumbar (min)', 'Lombar (min)')$$), 1);
select pruebas.esperar('...y suma una opción a Selección', pruebas.filas($$insert into evaluaciones_opciones (equipo_id, lista, codigo, etiqueta_es, etiqueta_pt, orden) values ('00000000-0000-0000-0000-0000000000c1', 'seleccion', 'reserva_1', 'Reserva', 'Reserva', 6)$$), 1);
select pruebas.esperar('...y la vuelve a cambiar', pruebas.filas($$update evaluaciones_campos set oculto = true where campo = 'lumbar'$$), 1);
select pruebas.esperar('...y las ve', (select count(*) from evaluaciones_campos) + (select count(*) from evaluaciones_opciones), 2);
select pruebas.debe_fallar('Un test mal escrito no se guarda', $$insert into evaluaciones_campos (equipo_id, test, campo) values ('00000000-0000-0000-0000-0000000000c1', 'Zona Media', 'prono')$$, 'evaluaciones_campos_test');
select pruebas.debe_fallar('...ni un nombre de más de 120 letras', $$insert into evaluaciones_campos (equipo_id, test, campo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 'prono', repeat('x', 121))$$, 'evaluaciones_campos_etiquetas');
select pruebas.debe_fallar('No se cambia nada de otro club', $$insert into evaluaciones_opciones (equipo_id, lista, codigo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c2', 'seleccion', 'espia', 'Espía')$$, 'row-level security');
reset role;

select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('Con Lesiones y sin Evaluaciones no se ven los Ajustes de Evaluaciones', (select count(*) from evaluaciones_campos) + (select count(*) from evaluaciones_opciones), 0);
select pruebas.debe_fallar('...ni se cambian', $$insert into evaluaciones_campos (equipo_id, test, campo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 'prono', 'Prono')$$, 'row-level security');
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto, admin de Uno sin Evaluaciones, tampoco los ve', (select count(*) from evaluaciones_campos), 0);
select pruebas.esperar('...ni los borra', pruebas.filas($$delete from evaluaciones_opciones$$), 0);
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (de otro club) no ve los de Uno', (select count(*) from evaluaciones_opciones where equipo_id = :C1), 0);
select pruebas.esperar('...ni los cambia', pruebas.filas($$update evaluaciones_campos set etiqueta_es = 'Espía'$$), 0);
reset role;
set role anon;
select pruebas.debe_fallar('Sin cuenta no se ven las cabeceras de Evaluaciones', 'select count(*) from evaluaciones_campos', 'permission denied');
select pruebas.debe_fallar('...ni las listas', 'select count(*) from evaluaciones_opciones', 'permission denied');
reset role;

-- Quien se fue mira lo que había, pero no cambia nada.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('La preparadora se va de Uno', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-000000000015' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('...sigue viendo los Ajustes de Uno', (select count(*) from evaluaciones_campos) + (select count(*) from evaluaciones_opciones), 2);
select pruebas.esperar('...pero no los cambia', pruebas.filas($$update evaluaciones_campos set oculto = false$$), 0);
select pruebas.debe_fallar('...ni suma opciones', $$insert into evaluaciones_opciones (equipo_id, lista, codigo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'seleccion', 'otra', 'Otra')$$, 'row-level security');
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto la reincorpora', pruebas.filas($$update club_miembros set hasta = null where user_id = '00000000-0000-0000-0000-000000000015' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.esperar('Los Ajustes de Uno siguen como los dejó', (select etiqueta_es || ',' || oculto from evaluaciones_campos where equipo_id = :C1 and campo = 'lumbar'), 'Lumbar (min),true');

-- ------------------------------------------------------------------- GPS --

-- Un jugador de Uno con datos del GPS (y nada más) y una invitación solo con
-- GPS: quien carga el GPS en el club.
insert into public.jugadores (id, nombre, equipo_id) overriding system value values
  (9006, 'CON GPS', '00000000-0000-0000-0000-0000000000c1');

select pruebas.esperar('Nadie arranca con GPS', (select count(*) from club_miembros where gps), 0);

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto invita a alguien solo con GPS', pruebas.filas($$insert into club_invitaciones (equipo_id, email, rol, partido, flujo, lesiones, evaluaciones, gps) values ('00000000-0000-0000-0000-0000000000c1', 'gps@uno.com', 'staff', false, false, false, false, true)$$), 1);
select pruebas.esperar('Beto, sin GPS, no ve ninguna fila', (select count(*) from gps), 0);
select pruebas.debe_fallar('...ni carga', $$insert into gps (equipo_id, fecha, jugador_id, datos) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 9006, '{"d":4155.15}')$$, 'row-level security');
reset role;
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000616', 'gps@uno.com', now());
select pruebas.esperar('La cuenta entra con GPS', (select gps::text from club_miembros where user_id = '00000000-0000-0000-0000-000000000616' and equipo_id = :C1), 'true');
select pruebas.esperar('...y su alta lo dice', (select count(*) from club_miembros_historial where user_id = '00000000-0000-0000-0000-000000000616' and accion = 'alta' and detalle ->> 'gps' = 'true'), 1);

select pruebas.ser('gps@uno.com'); set role authenticated;
select pruebas.esperar('Su club dice que tiene GPS', (select gps::text from v_mis_clubes where id = :C1), 'true');
select pruebas.esperar('...sin Lesiones ni Evaluaciones', (select count(*) from lesiones) + (select count(*) from evaluaciones), 0);
select pruebas.esperar('Carga la fila de un jugador de Uno', pruebas.filas($$insert into gps (equipo_id, fecha, jugador_id, datos) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 9006, '{"d":4155.15,"tiempo":2937}')$$), 1);
select pruebas.esperar('...la de alguien que no está en Datos básicos', pruebas.filas($$insert into gps (equipo_id, fecha, persona, datos) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 'Juvenil Invitado', '{"d":3539.48}')$$), 1);
select pruebas.esperar('...y la del promedio del equipo', pruebas.filas($$insert into gps (equipo_id, fecha, promedio, datos) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 'parcial', '{"d":4213.6}')$$), 1);
select pruebas.esperar('...y las ve en el orden en que las cargó', (select string_agg(coalesce(jugador_id::text, persona, promedio), ',' order by orden) from gps), '9006,Juvenil Invitado,parcial');
select pruebas.debe_fallar('Una fila es de alguien: de nadie, no', $$insert into gps (equipo_id, fecha) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08')$$, 'gps_de_quien');
select pruebas.debe_fallar('...ni de un jugador y del promedio a la vez', $$insert into gps (equipo_id, fecha, jugador_id, promedio) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 9006, 'sesion')$$, 'gps_de_quien');
select pruebas.debe_fallar('...ni con un nombre en blanco', $$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', '   ')$$, 'gps_de_quien');
select pruebas.debe_fallar('...ni un promedio que no es de la tarea ni de la sesión', $$insert into gps (equipo_id, fecha, promedio) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 'mensual')$$, 'gps_promedio');
select pruebas.debe_fallar('...ni de un jugador de otro club', $$insert into gps (equipo_id, fecha, jugador_id) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 9003)$$, 'jugador_de_otro_club');
select pruebas.debe_fallar('...ni sin fecha', $$insert into gps (equipo_id, persona) values ('00000000-0000-0000-0000-0000000000c1', 'Sin Fecha')$$, 'fecha');
select pruebas.debe_fallar('...ni con fecha futura', $$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000c1', current_date + 2, 'Del Futuro')$$, 'gps_sin_futuro');
select pruebas.debe_fallar('...ni en otro club', $$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000c2', '2026-10-08', 'Espía')$$, 'row-level security');
select pruebas.esperar('Corrige un tiempo', pruebas.filas($$update gps set datos = datos || '{"tiempo":1900}' where jugador_id = 9006$$), 1);
select pruebas.debe_fallar('...pero no le cambia el orden de carga', $$update gps set orden = 1 where jugador_id = 9006$$, 'orden');
select pruebas.debe_fallar('...ni la lleva al futuro', $$update gps set fecha = current_date + 2 where jugador_id = 9006$$, 'gps_sin_futuro');
-- Lo cambiado desde la última vez (ponerAlDiaGps) se lee con su índice, ya en
-- orden, también con las reglas puestas (20261106_gps_indice_cambios.sql).
-- Con tan pocas filas Postgres prefiere leer la tabla entera: se le pide que
-- no, para ver qué índice usaría.
set enable_seqscan = off;
select pruebas.esperar('Lo cambiado desde una fecha se lee con su índice, ya en orden',
  (select case when v ~ 'gps_por_cambio' and v !~ 'Sort' then 'con su índice' else v end
     from pruebas.plan($$select id from gps where equipo_id = '00000000-0000-0000-0000-0000000000c1' and actualizado_en >= now() - interval '1 day' order by actualizado_en, id limit 1000$$) v),
  'con su índice');
reset enable_seqscan;
-- Los Ajustes del club: el nombre de una columna, una columna que suma el
-- club y una opción de una lista.
select pruebas.esperar('Le cambia el nombre a una columna', pruebas.filas($$insert into gps_campos (equipo_id, campo, etiqueta_es, etiqueta_pt) values ('00000000-0000-0000-0000-0000000000c1', 'rhie_max', 'RHIE máx', 'RHIE máx')$$), 1);
select pruebas.esperar('...suma una columna propia', pruebas.filas($$insert into gps_campos (equipo_id, campo, etiqueta_es, etiqueta_pt, tipo, orden) values ('00000000-0000-0000-0000-0000000000c1', 'propia_sprints', 'Sprints', 'Sprints', 'numero', 100)$$), 1);
select pruebas.esperar('...y un dispositivo', pruebas.filas($$insert into gps_opciones (equipo_id, lista, codigo, etiqueta_es, etiqueta_pt) values ('00000000-0000-0000-0000-0000000000c1', 'dispositivo', 'catapult', 'Catapult', 'Catapult')$$), 1);
select pruebas.esperar('...y los ve', (select count(*) from gps_campos) + (select count(*) from gps_opciones), 3);
select pruebas.debe_fallar('Una columna propia es de un tipo conocido', $$insert into gps_campos (equipo_id, campo, etiqueta_es, tipo) values ('00000000-0000-0000-0000-0000000000c1', 'propia_otra', 'Otra', 'formula')$$, 'gps_campos_tipo');
select pruebas.debe_fallar('...ni un nombre de más de 120 letras', $$insert into gps_campos (equipo_id, campo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'd', repeat('x', 121))$$, 'gps_campos_etiquetas');
select pruebas.debe_fallar('No cambia los Ajustes de otro club', $$insert into gps_opciones (equipo_id, lista, codigo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c2', 'dispositivo', 'espia', 'Espía')$$, 'row-level security');
-- «Para los V.R.»: Más es mejor o Menos es mejor de cada medida
-- (20261107_sentido_de_las_medidas.sql), en la cabecera.
select pruebas.esperar('Marca «Menos es mejor» en una medida', pruebas.filas($$update gps_campos set sentido = 'menos' where campo = 'rhie_max'$$), 1);
select pruebas.esperar('...lo cambia', pruebas.filas($$update gps_campos set sentido = 'mas' where campo = 'rhie_max'$$), 1);
select pruebas.esperar('...y lo ve', (select sentido from gps_campos where campo = 'rhie_max'), 'mas');
select pruebas.debe_fallar('Solo «mas» o «menos»', $$update gps_campos set sentido = 'igual' where campo = 'rhie_max'$$, 'gps_campos_sentido');
select pruebas.debe_fallar('No lo marca en otro club', $$insert into gps_campos (equipo_id, campo, sentido) values ('00000000-0000-0000-0000-0000000000c2', 'd', 'mas')$$, 'row-level security');
reset role;
select pruebas.esperar('Las cuatro cabeceras lo guardan con su control', (select count(*) from pg_constraint where conname in ('lesiones_campos_sentido', 'evaluaciones_campos_sentido', 'gps_campos_sentido', 'datos_basicos_columnas_sentido')), 4);
select pruebas.ser('gps@uno.com'); set role authenticated;
-- Las reglas de la carga de cada día (20261020_gps_reglas.sql).
select pruebas.esperar('Cambia las reglas de la carga', pruebas.filas($$insert into gps_reglas (equipo_id, reglas) values ('00000000-0000-0000-0000-0000000000c1', '{"parteDelTiempo":0.8}')$$), 1);
select pruebas.esperar('...las vuelve a cambiar', pruebas.filas($$update gps_reglas set reglas = '{"parteDelTiempo":0.75,"minimoRegenerativo":6}' where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('...y las ve', (select reglas ->> 'minimoRegenerativo' from gps_reglas), '6');
select pruebas.debe_fallar('Las reglas son un objeto', $$update gps_reglas set reglas = '[1,2]'$$, 'gps_reglas_objeto');
select pruebas.debe_fallar('...no muy grande', $$update gps_reglas set reglas = jsonb_build_object('x', repeat('y', 5000))$$, 'gps_reglas_objeto');
select pruebas.debe_fallar('No cambia las reglas de otro club', $$insert into gps_reglas (equipo_id, reglas) values ('00000000-0000-0000-0000-0000000000c2', '{}')$$, 'row-level security');
select pruebas.debe_fallar('...ni las borra', $$delete from gps_reglas$$, 'permission denied');
-- Las cargas sin terminar (20261021_gps_en_curso.sql): se dejan para revisar
-- y se siguen desde otro aparato; una por día.
select pruebas.esperar('Deja una carga para revisar', (select (gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c1', '2026-10-09', 3, '{"titulo":"Tarea 1","pasos":8}', '{"csv":[{"nombre":"dia.csv","texto":"Player Name"}]}') ->> 'version')::bigint), 1);
select pruebas.esperar('...y la ve, con quién la dejó y el paso', (select creado_email || ',' || actualizado_email || ',' || paso from gps_en_curso), 'gps@uno.com,gps@uno.com,3');
select pruebas.esperar('...y lo hecho', (select datos #>> '{csv,0,nombre}' from gps_en_curso_datos), 'dia.csv');
select pruebas.esperar('La sigue y la vuelve a dejar más adelante', (select (gps_dejar_en_curso((select id from gps_en_curso where fecha = '2026-10-09'), 1, '00000000-0000-0000-0000-0000000000c1', '2026-10-09', 5, '{"titulo":"Sesión","pasos":8}', '{"csv":[{"nombre":"dia.csv","texto":"Player Name"}],"dia":"+1"}') ->> 'version')::bigint), 2);
select pruebas.esperar('...queda en el paso nuevo, con lo nuevo', (select paso || ',' || (select datos ->> 'dia' from gps_en_curso_datos) from gps_en_curso), '5,+1');
select pruebas.debe_fallar('Desde otro aparato, con la versión que abrió antes, no la pisa', $q$select gps_dejar_en_curso((select id from gps_en_curso where fecha = '2026-10-09'), 1, '00000000-0000-0000-0000-0000000000c1', '2026-10-09', 4, '{}', '{}')$q$, 'gps_en_curso_otro_aparato');
select pruebas.esperar('...y queda la que dejó el otro', (select paso from gps_en_curso), 5);
select pruebas.debe_fallar('Una que ya no está no se sigue', $q$select gps_dejar_en_curso('00000000-0000-0000-0000-0000000e9999', 1, '00000000-0000-0000-0000-0000000000c1', '2026-10-09', 4, '{}', '{}')$q$, 'gps_en_curso_no_esta');
select pruebas.debe_fallar('Otra carga del mismo día, no: ya está en curso', $q$select gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c1', '2026-10-09', 0, '{}', '{}')$q$, 'gps_en_curso_un_dia');
select pruebas.esperar('...de otro día, sí', (select (gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c1', '2026-10-10', 0, '{}', '{"csv":[]}') ->> 'version')::bigint), 1);
select pruebas.esperar('...y quedan las dos', (select count(*) from gps_en_curso) + (select count(*) from gps_en_curso_datos), 4);
select pruebas.debe_fallar('No le cambia el club a una', $q$update gps_en_curso set equipo_id = '00000000-0000-0000-0000-0000000000c2'$q$, 'permission denied');
select pruebas.debe_fallar('...ni la versión a mano', $q$update gps_en_curso set version = 9$q$, 'permission denied');
select pruebas.debe_fallar('...ni quién la dejó', $q$update gps_en_curso set creado_email = 'otro@uno.com'$q$, 'permission denied');
select pruebas.debe_fallar('El resumen es un objeto', $q$update gps_en_curso set resumen = '[1]'$q$, 'gps_en_curso_resumen');
select pruebas.debe_fallar('...y lo hecho, también', $q$update gps_en_curso_datos set datos = '"texto"'$q$, 'gps_en_curso_datos_tamano');
select pruebas.debe_fallar('No deja una carga en otro club', $q$select gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c2', '2026-10-09', 0, '{}', '{}')$q$, 'row-level security');
select pruebas.esperar('Borra la del otro día', pruebas.filas($$delete from gps_en_curso where fecha = '2026-10-10'$$), 1);
select pruebas.esperar('...y se va con lo hecho', (select count(*) from gps_en_curso) + (select count(*) from gps_en_curso_datos), 2);
reset role;
select pruebas.esperar('Las tres filas quedan en las versiones', (select count(*) from versiones_datos where tabla = 'gps'), 3);
select pruebas.esperar('...y quién las cargó', (select count(*) from gps where creado_por = '00000000-0000-0000-0000-000000000616' and actualizado_por = '00000000-0000-0000-0000-000000000616'), 3);
-- Los V.R. de cada dispositivo (20261024_gps_referencias.sql): los primeros
-- los carga un SQL; desde 20261025_referencias_editables.sql se cambian,
-- se suman y se borran desde la app.
insert into public.gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo, orden, promedio, desvio) values
  (:C1, 'catapult', 'FUTBOL', 'Oficial EdLP', 'TOTAL FUTBOL', 1, '{"d":100.5,"d_min":10.25,"tiempo":5700}', '{"d":9.5}'),
  (:C1, 'sport', 'FUTBOL', 'FUTBOL 2', 'TOTAL FUTBOL', 2, '{"d":90}', '{}'),
  (:C2, 'catapult', 'FUTBOL', 'Oficial EdLP', 'TOTAL FUTBOL', 1, '{"d":1}', '{}');
select id as vr_c1 from gps_referencias where equipo_id = :C1 and dispositivo = 'catapult' \gset
select id as vr_s1 from gps_referencias where equipo_id = :C1 and dispositivo = 'sport' \gset
select pruebas.debe_fallar('Un V.R. es de un grupo de una tabla una sola vez', $$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo) values ('00000000-0000-0000-0000-0000000000c1', 'sport', 'FUTBOL', 'FUTBOL 2', 'TOTAL FUTBOL')$$, 'gps_referencias_una');
select pruebas.debe_fallar('...con sus valores en un objeto', $$update gps_referencias set promedio = '[1]' where dispositivo = 'sport'$$, 'gps_referencias_valores');
select pruebas.debe_fallar('...solo con números', $$update gps_referencias set promedio = '{"d":"mucho"}' where dispositivo = 'sport'$$, 'gps_referencias_numeros');
select pruebas.esperar('Cargarlos por SQL queda en el historial', (select count(*) from referencias_historial where tabla = 'gps_referencias' and accion = 'creada' and equipo_id in (:C1, :C2)), 3);
-- El V.R. de partido que Atlético tenía en Reglas de carga (lo pone
-- correr.sh antes de 20261025) pasó a cada uno de sus dispositivos.
select id as atletico_gps from equipos where nombre = 'Atlético Mineiro' \gset
select pruebas.esperar('El V.R. de partido de las reglas pasó a cada dispositivo, con sus números', (select string_agg(dispositivo || ':' || tipo || ' · ' || tabla || ' · ' || grupo || ':' || promedio::text, ',' order by dispositivo) from gps_referencias where equipo_id = :'atletico_gps' and de_partido), 'cat:PARTIDO · V.R. de partido · TOTAL:{"d_min": 100.5, "d_shi_min": 20},spo:PARTIDO · V.R. de partido · TOTAL:{"d_min": 100.5, "d_shi_min": 20}');
select pruebas.esperar('...y salió de las reglas (lo demás queda)', (select (reglas ? 'vrPartido')::text || ',' || (reglas ->> 'parteDelTiempo') from gps_reglas where equipo_id = :'atletico_gps'), 'false,0.8');
select pruebas.debe_fallar('Un dispositivo tiene un solo V.R. de partido', $$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo, de_partido) values ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'P', 'Uno', 'T', true), ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'P', 'Otro', 'T', true)$$, 'gps_referencias_un_partido');
select pruebas.ser('gps@uno.com'); set role authenticated;
select pruebas.esperar('Con GPS ve los V.R. de su club, de cada dispositivo', (select string_agg(dispositivo || ':' || tabla, ',' order by orden) from gps_referencias), 'catapult:Oficial EdLP,sport:FUTBOL 2');
select pruebas.esperar('...con sus números', (select (promedio ->> 'd_min') || ',' || (promedio ->> 'tiempo') from gps_referencias where dispositivo = 'catapult'), '10.25,5700');
select pruebas.esperar('...cambia uno, de a un número', (select (gps_referencia_cambiar(id, 'promedio', 'd_min', 10.123456789012345)).promedio ->> 'd_min' from gps_referencias where dispositivo = 'catapult'), '10.123456789012345');
select pruebas.esperar('...sin tocar los otros', (select (promedio ->> 'd') || ',' || (promedio ->> 'tiempo') from gps_referencias where dispositivo = 'catapult'), '100.5,5700');
select pruebas.esperar('...le suma uno que no tenía', (select (gps_referencia_cambiar(id, 'desvio', 'tiempo', 300)).desvio::text from gps_referencias where dispositivo = 'catapult'), '{"d": 9.5, "tiempo": 300}');
select pruebas.esperar('...y lo vacía', (select (gps_referencia_cambiar(id, 'desvio', 'd', null)).desvio::text from gps_referencias where dispositivo = 'catapult'), '{"tiempo": 300}');
select pruebas.debe_fallar('...pero no en otro lado', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_c1', 'equipo_id', 'd'), 'referencia_invalida');
select pruebas.debe_fallar('...ni en una columna mal escrita', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_c1', 'promedio', 'D Min'), 'referencia_invalida');
-- Las categorías de un V.R. por jugador (20261026_gps_referencias_categorias.sql).
select pruebas.esperar('...cambia una categoría, de a un número', (select (gps_referencia_cambiar(id, 'excelente', 'd', 120.123456789012345)).categorias::text from gps_referencias where id = :'vr_s1'), '{"excelente": {"d": 120.123456789012345}}');
select pruebas.esperar('...le suma otra, sin tocar la primera', (select (gps_referencia_cambiar(id, 'malo', 'tiempo', 5400)).categorias::text from gps_referencias where id = :'vr_s1'), '{"malo": {"tiempo": 5400}, "excelente": {"d": 120.123456789012345}}');
select pruebas.esperar('...vaciar una que no tiene no cambia nada', (select (gps_referencia_cambiar(id, 'regular', 'd', null)).categorias::text from gps_referencias where id = :'vr_s1'), '{"malo": {"tiempo": 5400}, "excelente": {"d": 120.123456789012345}}');
select pruebas.esperar('...y la que se queda sin números se va', (select (gps_referencia_cambiar(id, 'malo', 'tiempo', null)).categorias::text from gps_referencias where id = :'vr_s1'), '{"excelente": {"d": 120.123456789012345}}');
select pruebas.esperar('...sin tocar el promedio ni el desvío', (select promedio::text || desvio::text from gps_referencias where id = :'vr_s1'), '{"d": 90}{}');
select pruebas.debe_fallar('...pero no una categoría que no existe', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_s1', 'pesimo', 'd'), 'referencia_invalida');
select pruebas.debe_fallar('...ni guarda categorías con otro nombre', $$update gps_referencias set categorias = '{"pesimo": {"d": 1}}' where dispositivo = 'sport'$$, 'gps_referencias_numeros');
select pruebas.debe_fallar('...ni con un texto', $$update gps_referencias set categorias = '{"malo": {"d": "poco"}}' where dispositivo = 'sport'$$, 'gps_referencias_numeros');
select pruebas.debe_fallar('...ni una categoría que no es un objeto', $$update gps_referencias set categorias = '{"malo": 5}' where dispositivo = 'sport'$$, 'gps_referencias_numeros');
select pruebas.debe_fallar('...ni las categorías fuera de un objeto', $$update gps_referencias set categorias = '[1]' where dispositivo = 'sport'$$, 'gps_referencias_categorias');
select pruebas.esperar('...y los cambios de las categorías quedan en el historial, cómo estaban y cómo quedaron', (select string_agg(coalesce(antes #>> '{categorias,excelente,d}', 'vacío') || '→' || coalesce(despues #>> '{categorias,malo,tiempo}', 'vacío'), ',' order by id) from referencias_historial where tabla = 'gps_referencias' and accion = 'editada' and fila_id = :'vr_s1'), 'vacío→vacío,120.123456789012345→5400,120.123456789012345→vacío');
select pruebas.esperar('Suma un V.R.', pruebas.filas($$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo, orden) values ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'DINAMICA', 'DINAMICA 1', 'FUERZA', 3)$$), 1);
select pruebas.esperar('...le cambia el nombre', pruebas.filas($$update gps_referencias set grupo = 'VELOCIDAD' where tabla = 'DINAMICA 1'$$), 1);
select pruebas.esperar('...lo marca de partido (y devuelve los de su dispositivo)', pruebas.filas($$select * from gps_referencia_de_partido((select id from gps_referencias where tabla = 'DINAMICA 1'), true)$$), 2);
select pruebas.esperar('...marca otro: el de antes deja de serlo', (select count(*) from gps_referencia_de_partido((select id from gps_referencias where tabla = 'Oficial EdLP'), true) where de_partido and tabla = 'Oficial EdLP'), 1);
select pruebas.esperar('...uno solo de partido en su dispositivo', (select string_agg(tabla, ',') from gps_referencias where dispositivo = 'catapult' and de_partido), 'Oficial EdLP');
select pruebas.esperar('...lo borra', pruebas.filas($$delete from gps_referencias where tabla = 'DINAMICA 1'$$), 1);
select pruebas.debe_fallar('...no lo pasa a otro club', $$update gps_referencias set equipo_id = '00000000-0000-0000-0000-0000000000c2'$$, 'permission denied');
select pruebas.debe_fallar('...ni a otro dispositivo', $$update gps_referencias set dispositivo = 'sport'$$, 'permission denied');
select pruebas.debe_fallar('...ni suma uno en otro club', $$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo) values ('00000000-0000-0000-0000-0000000000c2', 'catapult', 'FUTBOL', 'Otra', 'TOTAL FUTBOL')$$, 'row-level security');
select pruebas.esperar('Suma un V.R. por jugador, con sus categorías', pruebas.filas($$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo, orden, promedio, categorias) values ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'Microciclo', 'Partidos', 'JUGADOR 1', 4, '{"d": 10}', '{"excelente": {"d": 14}, "muy_bueno": {"d": 12}, "regular": {"d": 8}, "malo": {"d": 6}}')$$), 1);
select pruebas.esperar('...lo ve con las cinco', (select (promedio ->> 'd') || ',' || (categorias #>> '{excelente,d}') || ',' || (categorias #>> '{muy_bueno,d}') || ',' || (categorias #>> '{regular,d}') || ',' || (categorias #>> '{malo,d}') from gps_referencias where grupo = 'JUGADOR 1'), '10,14,12,8,6');
select pruebas.esperar('...le cambia una de un saque', pruebas.filas($$update gps_referencias set categorias = jsonb_set(categorias, '{malo,d}', '5') where grupo = 'JUGADOR 1'$$), 1);
select pruebas.esperar('...y lo borra', pruebas.filas($$delete from gps_referencias where grupo = 'JUGADOR 1'$$), 1);
select pruebas.esperar('Ve el historial de los V.R. de su club, con quién (tres números y el de partido)', (select count(*) || ':' || string_agg(distinct quien_email, ',') from referencias_historial where tabla = 'gps_referencias' and accion = 'editada' and fila_id = (select id from gps_referencias where tabla = 'Oficial EdLP')), '4:gps@uno.com');
select pruebas.esperar('...cómo estaba y cómo quedó', (select (antes -> 'promedio' ->> 'd_min') || '→' || (despues -> 'promedio' ->> 'd_min') from referencias_historial where tabla = 'gps_referencias' and accion = 'editada' order by id limit 1), '10.25→10.123456789012345');
select pruebas.esperar('...también lo borrado', (select count(*) from referencias_historial where accion = 'borrada' and antes ->> 'tabla' = 'DINAMICA 1'), 1);
select pruebas.esperar('...pero no el de otro club', (select count(*) from referencias_historial where equipo_id = :C2), 0);
select pruebas.debe_fallar('...ni lo cambia', $$update referencias_historial set quien_email = 'otro@uno.com'$$, 'permission denied');
select pruebas.debe_fallar('...ni le suma', $$insert into referencias_historial (tabla, fila_id, accion) values ('gps_referencias', gen_random_uuid(), 'creada')$$, 'permission denied');
-- Un V.R. de la planilla (20261108_gps_vr_planilla.sql): un solo nombre y
-- con qué se calculó; «Recalcular» cambia todo de un saque.
select pruebas.esperar('Suma un V.R. de la planilla, con un solo nombre', pruebas.filas($$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo, orden, promedio, categorias, planilla) values ('00000000-0000-0000-0000-0000000000c1', 'catapult', '', 'Partidos 2026', '', 5, '{"d": 10}', '{"excelente": {"d": 14}, "muy_bueno": {"d": 12}, "regular": {"d": 8}, "malo": {"d": 6}}', '{"version": 1, "muestra": {"tarea_partido": ["partido_oficial_torneo"]}, "medidas": {"d": {"sentido": "mas", "modo": "automatico"}}, "filas": 30}')$$), 1);
select pruebas.debe_fallar('...uno escrito a mano sigue con tipo, tabla y grupo', $$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo) values ('00000000-0000-0000-0000-0000000000c1', 'catapult', '', 'Solo', '')$$, 'gps_referencias_textos');
select pruebas.debe_fallar('...la planilla es un objeto', $$update gps_referencias set planilla = '[1]' where tabla = 'Partidos 2026'$$, 'gps_referencias_planilla');
select pruebas.esperar('...lo recalcula de un saque', pruebas.filas($$update gps_referencias set promedio = '{"d": 11}', categorias = '{"excelente": {"d": 15}, "muy_bueno": {"d": 13}, "regular": {"d": 9}, "malo": {"d": 7}}', planilla = planilla || '{"filas": 40}' where tabla = 'Partidos 2026'$$), 1);
select pruebas.esperar('...y en el historial queda cómo estaba', (select (antes #>> '{promedio,d}') || '→' || (despues #>> '{promedio,d}') || ',' || (antes #>> '{planilla,filas}') || '→' || (despues #>> '{planilla,filas}') from referencias_historial where tabla = 'gps_referencias' and accion = 'editada' and despues ->> 'tabla' = 'Partidos 2026'), '10→11,30→40');
select pruebas.debe_fallar('...no suma uno de la planilla en otro club', $$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo, planilla) values ('00000000-0000-0000-0000-0000000000c2', 'catapult', '', 'Otro', '', '{}')$$, 'row-level security');
select pruebas.esperar('...y lo borra', pruebas.filas($$delete from gps_referencias where tabla = 'Partidos 2026'$$), 1);
reset role;

select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('Con Lesiones y sin GPS no se ve ninguna fila', (select count(*) from gps), 0);
select pruebas.esperar('...ni en la foto', (select count(*) from datos_al_dia('gps', :C1)), 0);
select pruebas.esperar('...ni los Ajustes', (select count(*) from gps_campos) + (select count(*) from gps_opciones) + (select count(*) from gps_reglas), 0);
select pruebas.esperar('...ni los V.R.', (select count(*) from gps_referencias), 0);
select pruebas.debe_fallar('...ni cambia uno', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_c1', 'promedio', 'd'), 'referencia_sin_permiso');
select pruebas.debe_fallar('...ni una categoría', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_s1', 'excelente', 'd'), 'referencia_sin_permiso');
select pruebas.esperar('...ni ve su historial', (select count(*) from referencias_historial), 0);
select pruebas.debe_fallar('...ni los cambia', $$insert into gps_campos (equipo_id, campo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'd', 'Distancia')$$, 'row-level security');
select pruebas.debe_fallar('...ni las reglas de la carga', $$insert into gps_reglas (equipo_id, reglas) values ('00000000-0000-0000-0000-0000000000c1', '{}')$$, 'row-level security');
select pruebas.esperar('...ni las cargas sin terminar', (select count(*) from gps_en_curso) + (select count(*) from gps_en_curso_datos), 0);
select pruebas.debe_fallar('...ni deja una', $q$select gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c1', '2026-10-11', 0, '{}', '{}')$q$, 'row-level security');
select pruebas.esperar('...ni borra la que hay', pruebas.filas($$delete from gps_en_curso$$), 0);
reset role;

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (de otro club) no ve las de Uno', (select count(*) from gps where equipo_id = :C1), 0);
select pruebas.esperar('...ni con la foto', (select count(*) from datos_al_dia('gps', :C1)), 0);
select pruebas.esperar('...ni cambia sus Ajustes', pruebas.filas($$update gps_campos set etiqueta_es = 'Espía'$$), 0);
select pruebas.esperar('...ni sus reglas de carga', pruebas.filas($$update gps_reglas set reglas = '{}'$$), 0);
select pruebas.esperar('...ni sus V.R.', (select count(*) from gps_referencias where equipo_id = :C1), 0);
select pruebas.debe_fallar('...ni los cambia', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_c1', 'promedio', 'd'), 'referencia_sin_permiso');
select pruebas.debe_fallar('...ni marca uno de partido', format('select gps_referencia_de_partido(%L, true)', :'vr_c1'), 'referencia_sin_permiso');
select pruebas.esperar('...ni los borra', pruebas.filas($$delete from gps_referencias where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.esperar('...ni ve su historial', (select count(*) from referencias_historial where equipo_id = :C1), 0);
select pruebas.esperar('...ni sus cargas sin terminar', (select count(*) from gps_en_curso where equipo_id = :C1) + (select count(*) from gps_en_curso_datos), 0);
select pruebas.esperar('...ni las sigue', pruebas.filas($$update gps_en_curso set paso = 0$$), 0);
select pruebas.esperar('...ni las borra', pruebas.filas($$delete from gps_en_curso$$), 0);
reset role;

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Un jugador con datos del GPS no se borra', $$delete from jugadores where id = 9006$$, 'gps_jugador_id_fkey');
select pruebas.esperar('Beto le da GPS a la preparadora', pruebas.filas($$update club_miembros set gps = true where user_id = '00000000-0000-0000-0000-000000000015' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.esperar('El permiso nuevo queda en la historia de la preparadora', (select count(*) from club_miembros_historial where user_id = '00000000-0000-0000-0000-000000000015' and accion = 'modulos' and detalle ->> 'gps' = 'true'), 1);
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('Con GPS, la preparadora ve la carga sin terminar que dejó otro', (select count(*) from gps_en_curso where equipo_id = :C1), 1);
select pruebas.esperar('...con lo hecho', (select count(*) from gps_en_curso_datos), 1);
select pruebas.esperar('...la sigue', (select (gps_dejar_en_curso((select id from gps_en_curso where fecha = '2026-10-09'), 2, '00000000-0000-0000-0000-0000000000c1', '2026-10-09', 6, '{}', '{"csv":[]}') ->> 'version')::bigint), 3);
select pruebas.esperar('...y queda que la dejó ella', (select creado_email || ',' || actualizado_email from gps_en_curso), 'gps@uno.com,pf@uno.com');
reset role;

-- Lo que recuerda cada cuenta (20261027_gps_preferencias.sql): el último
-- dispositivo al pegar desde Excel y al cargar un CSV. La app guarda con
-- upsert (el club va también en lo que se cambia); cada cuenta ve lo suyo.
select pruebas.ser('gps@uno.com'); set role authenticated;
select pruebas.esperar('Recuerda el dispositivo con que pegó', pruebas.filas($$insert into gps_preferencias (equipo_id, dispositivo_pegar) values ('00000000-0000-0000-0000-0000000000c1', 'catapult') on conflict (user_id, equipo_id) do update set equipo_id = excluded.equipo_id, dispositivo_pegar = excluded.dispositivo_pegar$$), 1);
select pruebas.esperar('...y el del CSV, sin perder el otro', pruebas.filas($$insert into gps_preferencias (equipo_id, dispositivo_csv) values ('00000000-0000-0000-0000-0000000000c1', 'sport') on conflict (user_id, equipo_id) do update set equipo_id = excluded.equipo_id, dispositivo_csv = excluded.dispositivo_csv$$), 1);
select pruebas.esperar('...los ve, a su nombre', (select user_id || ',' || dispositivo_pegar || ',' || dispositivo_csv from gps_preferencias), '00000000-0000-0000-0000-000000000616,catapult,sport');
select pruebas.esperar('...los vuelve a cambiar', pruebas.filas($$insert into gps_preferencias (equipo_id, dispositivo_pegar) values ('00000000-0000-0000-0000-0000000000c1', 'sport') on conflict (user_id, equipo_id) do update set equipo_id = excluded.equipo_id, dispositivo_pegar = excluded.dispositivo_pegar$$), 1);
select pruebas.esperar('...y quedan', (select dispositivo_pegar || ',' || dispositivo_csv from gps_preferencias), 'sport,sport');
select pruebas.debe_fallar('No los anota a nombre de otra cuenta', $$insert into gps_preferencias (user_id, equipo_id, dispositivo_pegar) values ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-0000000000c1', 'x')$$, 'permission denied');
select pruebas.debe_fallar('...ni se los pasa', $$update gps_preferencias set user_id = '00000000-0000-0000-0000-000000000015'$$, 'permission denied');
select pruebas.esperar('...ni los lleva a otro club', pruebas.filas($$update gps_preferencias set equipo_id = '00000000-0000-0000-0000-0000000000c2'$$), 1);
select pruebas.esperar('...siguen en Uno', (select count(*) from gps_preferencias where equipo_id = :C1), 1);
select pruebas.debe_fallar('...ni anota en un club donde no tiene GPS', $$insert into gps_preferencias (equipo_id, dispositivo_pegar) values ('00000000-0000-0000-0000-0000000000c2', 'x')$$, 'row-level security');
select pruebas.debe_fallar('...ni un nombre de más de 80 letras', $$update gps_preferencias set dispositivo_csv = repeat('x', 81)$$, 'gps_preferencias_dispositivos');
select pruebas.debe_fallar('...ni los borra', $$delete from gps_preferencias$$, 'permission denied');
reset role;
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('La preparadora no ve lo que recuerda la otra cuenta', (select count(*) from gps_preferencias), 0);
select pruebas.esperar('...ni lo cambia', pruebas.filas($$update gps_preferencias set dispositivo_pegar = 'x'$$), 0);
select pruebas.esperar('...y recuerda lo suyo', pruebas.filas($$insert into gps_preferencias (equipo_id, dispositivo_csv) values ('00000000-0000-0000-0000-0000000000c1', 'catapult') on conflict (user_id, equipo_id) do update set equipo_id = excluded.equipo_id, dispositivo_csv = excluded.dispositivo_csv$$), 1);
select pruebas.esperar('...sin tocar lo de la otra', (select count(*) from gps_preferencias), 1);
reset role;
select pruebas.esperar('Cada una, lo suyo', (select string_agg(coalesce(dispositivo_pegar, '-') || '/' || dispositivo_csv, ',' order by user_id) from gps_preferencias), '-/catapult,sport/sport');
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('Sin GPS no se ve lo que recuerdan otras cuentas', (select count(*) from gps_preferencias), 0);
select pruebas.debe_fallar('...ni se recuerda nada', $$insert into gps_preferencias (equipo_id, dispositivo_pegar) values ('00000000-0000-0000-0000-0000000000c1', 'x')$$, 'row-level security');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (de otro club) no ve lo que recuerdan en Uno', (select count(*) from gps_preferencias), 0);
select pruebas.debe_fallar('...ni anota en Uno', $$insert into gps_preferencias (equipo_id, dispositivo_pegar) values ('00000000-0000-0000-0000-0000000000c1', 'x')$$, 'row-level security');
reset role;
set role anon;
select pruebas.debe_fallar('Sin cuenta, nada', 'select count(*) from gps_preferencias', 'permission denied');
reset role;

-- Quien carga el GPS se va de Uno: ve la foto de su último día, mientras
-- tenga el permiso, pero no cambia nada.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('La cuenta del GPS se va de Uno', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-000000000616' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.ser('gps@uno.com'); set role authenticated;
select pruebas.esperar('Ya no lee las filas de Uno', (select count(*) from gps), 0);
select pruebas.esperar('...pero están en la foto de su último día', (select count(*) from datos_al_dia('gps', :C1)), 3);
select pruebas.esperar('...con lo que corrigió', (select f -> 'datos' ->> 'tiempo' from datos_al_dia('gps', :C1) f where f ->> 'jugador_id' = '9006'), '1900');
select pruebas.esperar('...y sigue viendo los Ajustes', (select count(*) from gps_campos) + (select count(*) from gps_opciones), 3);
select pruebas.debe_fallar('...pero ya no carga', $$insert into gps (equipo_id, fecha, jugador_id) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-09', 9006)$$, 'row-level security');
select pruebas.esperar('...ni cambia los Ajustes', pruebas.filas($$update gps_campos set oculto = true$$), 0);
select pruebas.esperar('...ve las reglas de la carga', (select count(*) from gps_reglas), 1);
select pruebas.esperar('...pero no las cambia', pruebas.filas($$update gps_reglas set reglas = '{}'$$), 0);
select pruebas.esperar('...y los V.R. de cada dispositivo', (select count(*) from gps_referencias), 2);
select pruebas.debe_fallar('...pero ya no los cambia', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_c1', 'promedio', 'd'), 'referencia_sin_permiso');
select pruebas.debe_fallar('...ni sus categorías', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_s1', 'muy_bueno', 'd'), 'referencia_sin_permiso');
select pruebas.esperar('...ni de un saque', pruebas.filas($$update gps_referencias set categorias = '{}'$$), 0);
select pruebas.esperar('...ni recalcula uno', pruebas.filas($$update gps_referencias set promedio = '{}', planilla = '{}'$$), 0);
select pruebas.debe_fallar('...ni marca uno de partido', format('select gps_referencia_de_partido(%L, true)', :'vr_c1'), 'referencia_sin_permiso');
select pruebas.esperar('...ni los borra', pruebas.filas($$delete from gps_referencias$$), 0);
select pruebas.debe_fallar('...ni suma uno', $$insert into gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo) values ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'FUTBOL', 'Otra', 'TOTAL FUTBOL')$$, 'row-level security');
select pruebas.esperar('...ni ve su historial', (select count(*) from referencias_historial), 0);
select pruebas.esperar('...pero ya no ve las cargas sin terminar', (select count(*) from gps_en_curso) + (select count(*) from gps_en_curso_datos), 0);
select pruebas.debe_fallar('...ni deja una', $q$select gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c1', '2026-10-12', 0, '{}', '{}')$q$, 'row-level security');
select pruebas.esperar('...ni recuerda el dispositivo (ya no carga)', (select count(*) from gps_preferencias) + pruebas.filas($$update gps_preferencias set dispositivo_pegar = 'x'$$), 0);
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto le saca GPS (ya se fue)', pruebas.filas($$update club_miembros set gps = false where user_id = '00000000-0000-0000-0000-000000000616' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.ser('gps@uno.com'); set role authenticated;
select pruebas.esperar('Sin el permiso, ya no ve ni la foto', (select count(*) from datos_al_dia('gps', :C1)), 0);
select pruebas.esperar('...ni los V.R.', (select count(*) from gps_referencias), 0);
reset role;

set role anon;
select pruebas.debe_fallar('Sin cuenta no se ve el GPS', 'select count(*) from gps', 'permission denied');
select pruebas.debe_fallar('...ni sus Ajustes', 'select count(*) from gps_campos', 'permission denied');
select pruebas.debe_fallar('...ni sus listas', 'select count(*) from gps_opciones', 'permission denied');
select pruebas.debe_fallar('...ni sus reglas de carga', 'select count(*) from gps_reglas', 'permission denied');
select pruebas.debe_fallar('...ni sus V.R.', 'select count(*) from gps_referencias', 'permission denied');
select pruebas.debe_fallar('...ni los cambia', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_c1', 'promedio', 'd'), 'permission denied');
select pruebas.debe_fallar('...ni sus categorías', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_s1', 'excelente', 'd'), 'permission denied');
select pruebas.debe_fallar('...ni de un saque', $$update gps_referencias set categorias = '{}'$$, 'permission denied');
select pruebas.debe_fallar('...ni ve el historial de los V.R.', 'select count(*) from referencias_historial', 'permission denied');
select pruebas.debe_fallar('...ni sus cargas sin terminar', 'select count(*) from gps_en_curso', 'permission denied');
select pruebas.debe_fallar('...ni lo hecho en ellas', 'select count(*) from gps_en_curso_datos', 'permission denied');
select pruebas.debe_fallar('...ni deja una', $q$select gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c1', '2026-10-12', 0, '{}', '{}')$q$, 'permission denied');
select pruebas.debe_fallar('...ni su foto', $$select * from datos_al_dia('gps', '00000000-0000-0000-0000-0000000000c1')$$, 'permission denied');
reset role;

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
  'TABLE(estado text, dueno text, flujo boolean, catapult boolean, tecnico boolean, flujo_edita boolean)');
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
                        'aceptar_pedido', 'rechazar_pedido', 'salir_del_club', 'panel_historial', 'renombrar_club')),
  'aceptar_pedido(p_id uuid, p_partido boolean, p_flujo boolean, p_lesiones boolean, p_evaluaciones boolean, p_gps boolean DEFAULT false, p_solo_lectura text[] DEFAULT ''{}''::text[]); '
  || 'agregar_subdueno(p_correo text); asignar_entidad(p_equipo uuid, p_correo text); cancelar_pedido(p_id uuid); '
  || 'crear_club(p_nombre text, p_correo_entidad text DEFAULT NULL::text, p_zona text DEFAULT ''America/Sao_Paulo''::text); '
  || 'derivar_pedido(p_id uuid, p_equipo uuid); panel_historial(p_limite integer DEFAULT 50); '
  || 'pedir_acceso(p_club text, p_pais text DEFAULT NULL::text); quitar_subdueno(p_user uuid); '
  || 'rechazar_pedido(p_id uuid); rechazar_pedido_sin_club(p_id uuid); renombrar_club(p_equipo uuid, p_nombre text); '
  || 'salir_del_club(p_equipo uuid); traspasar_principal(p_user uuid)');

-- ------------------------------------------------------------ Privilegios --

select pruebas.esperar('Ninguna función de public se ejecuta sin cuenta',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')), 0);
select pruebas.esperar('Con cuenta, solo las de la lista (ni disparadores ni internas)',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'acceso_club,aceptar_pedido,agregar_subdueno,asignar_entidad,cancelar_pedido,clubes_donde_edito,clubes_donde_puedo,crear_club,datos_al_dia,derivar_pedido,'
  || 'es_admin_de_club,es_columna_de_datos_basicos,esta_autorizado,evaluaciones_referencia_cambiar,exportar_atleta,gps_cambiar_en_descripciones,gps_dejar_en_curso,gps_guardar_dia,gps_referencia_cambiar,gps_referencia_de_partido,lesiones_etiqueta,lesiones_horas_imagen,mi_cuenta,miembro_protegido,minutos_de_entrenamiento,mis_pedidos,panel_clubes,'
  || 'panel_duenos,panel_historial,pedidos_del_club,pedidos_sin_club,pedir_acceso,puede_editar,puede_editar_en,puede_usar,'
  || 'puede_usar_catapult_servidor,puede_usar_en,puede_ver,quitar_subdueno,rechazar_pedido,rechazar_pedido_sin_club,'
  || 'renombrar_club,salir_del_club,traspasar_principal');
select pruebas.esperar('es_admin() ya no existe', (select count(*) from pg_proc where proname = 'es_admin'), 0);
select pruebas.esperar('...ni lo que nadie usaba', (select count(*) from pg_proc where proname in ('puede_ver_fecha', 'fecha_segura', 'equipos_sumar_creador')), 0);
select pruebas.esperar('Las tablas de los dueños y los pedidos no se tocan desde la API',
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('plataforma', 'plataforma_subduenos', 'plataforma_historial', 'club_entidades', 'club_pedidos')
      and (has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
           or has_any_column_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE'))), 0);
select pruebas.esperar('Los clubes tampoco se crean, cambian ni borran desde la API (solo con las funciones de los dueños)',
  (has_any_column_privilege('authenticated', 'public.equipos', 'INSERT, UPDATE')
   or has_table_privilege('authenticated', 'public.equipos', 'DELETE'))::text, 'false');
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
select pruebas.esperar('La entidad queda en la historia de Uno, sin persona ni quién la puso', (select count(*) from club_miembros_historial where equipo_id = :C1 and accion = 'entidad' and user_id is null and quien is null and quien_email = '' and detalle ->> 'email' = 'ent1@uno.com'), 1);
select pruebas.esperar('...quién la puso queda solo en los movimientos de los dueños', (select quien_email from plataforma_historial where accion = 'entidad' and email = 'ent1@uno.com'), 'subduenia@prueba.com');
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('...y el administrador de Uno la ve', (select count(*) from club_miembros_historial where equipo_id = :C1 and accion = 'entidad'), 1);
select pruebas.esperar('...sin saber qué dueño fue (no comparte club con ella)', (select count(*) from club_miembros_historial where equipo_id = :C1 and accion = 'entidad' and (quien is not null or quien_email <> '')), 0);
reset role;

-- El nombre de un club lo cambian solo los dueños (el principal y los
-- sub-dueños), con renombrar_club. Queda en los movimientos y en la
-- historia del club, sin quién fue.
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.debe_fallar('El principal tampoco cambia el nombre a mano', $$update equipos set nombre = 'Club Uno FC' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'permission denied');
select renombrar_club(:C1, '  Club   Uno  FC ');
select pruebas.esperar('...lo cambia con renombrar_club, con el nombre limpio', (select nombre from panel_clubes() where equipo_id = :C1), 'Club Uno FC');
select pruebas.debe_fallar('...no al de otro club escrito de otra forma (tildes, mayúsculas, espacios)', $$select renombrar_club('00000000-0000-0000-0000-0000000000c1', '  club   DÓS fc ')$$, 'nombre_repetido');
select pruebas.debe_fallar('...ni a uno vacío', $$select renombrar_club('00000000-0000-0000-0000-0000000000c1', '   ')$$, 'nombre_invalido');
select pruebas.debe_fallar('...ni a uno de más de 60 letras', format('select renombrar_club(%L, %L)', '00000000-0000-0000-0000-0000000000c1', repeat('a', 61)), 'nombre_invalido');
select pruebas.debe_fallar('...ni a un club que no existe', $$select renombrar_club('00000000-0000-0000-0000-0000000000ff', 'Club Nueve')$$, 'club_inexistente');
reset role;
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select renombrar_club(:C1, 'CLUB UNO');
select pruebas.esperar('La sub-dueña también, y con el nombre de antes en mayúsculas (es el mismo club)', (select nombre from panel_clubes() where equipo_id = :C1), 'CLUB UNO');
select renombrar_club(:C1, 'Club Uno');
select renombrar_club(:C1, 'Club Uno');
select pruebas.esperar('...y lo deja como estaba (el mismo nombre otra vez no cambia nada)', (select string_agg(coalesce(detalle ->> 'antes', '-') || '>' || coalesce(detalle ->> 'nombre', '-'), ',' order by id) from panel_historial() where accion = 'renombrar_club' and equipo_id = :C1), 'Club Uno>Club Uno FC,Club Uno FC>CLUB UNO,CLUB UNO>Club Uno');
reset role;
select pruebas.esperar('En los movimientos, con quién lo hizo', (select string_agg(quien_email, ',' order by id) from plataforma_historial where accion = 'renombrar_club' and equipo_id = :C1), 'duenio@prueba.com,subduenia@prueba.com,subduenia@prueba.com');
select pruebas.debe_fallar('Por SQL, la base igual frena un nombre repetido', $$update equipos set nombre = '  club   DÓS fc ' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'nombre_repetido');
select pruebas.debe_fallar('...y uno vacío', $$update equipos set nombre = '   ' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'nombre_invalido');
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('El administrador de Uno ve cada cambio de nombre en la historia del club', (select string_agg(detalle ->> 'nombre', ',' order by id) from club_miembros_historial where equipo_id = :C1 and accion = 'club_renombrado'), 'Club Uno FC,CLUB UNO,Club Uno');
select pruebas.esperar('...sin saber qué dueño fue', (select count(*) from club_miembros_historial where equipo_id = :C1 and accion = 'club_renombrado' and (user_id is not null or quien is not null or quien_email <> '')), 0);
select pruebas.esperar('...y su club se llama como antes', (select nombre from equipos where id = :C1), 'Club Uno');
reset role;
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('El staff de Uno no ve la historia del club', (select count(*) from club_miembros_historial where equipo_id = :C1 and accion = 'club_renombrado'), 0);
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

-- El administrador del club decide: Beto acepta a pide1 con Partido,
-- Evaluaciones y GPS (los demás pedidos se aceptan como antes, sin decir
-- nada de GPS: la app de antes lo llama así).
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto (admin de Uno) ve el pedido de pide1, no el de pide2', (select string_agg(email, ',') from pedidos_del_club(:C1)), 'pide1@prueba.com');
select aceptar_pedido(:'pedido1', true, false, false, true, true);
select pruebas.esperar('...lo acepta y sale de la lista', (select count(*) from pedidos_del_club(:C1)), 0);
select pruebas.esperar('...pide1 queda en Uno como staff, con esos módulos', (select rol || ',' || partido || ',' || flujo || ',' || lesiones || ',' || evaluaciones || ',' || gps from club_miembros where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-000000000021' and hasta is null), 'staff,true,false,false,true,true');
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

-- Quien ya está en un club también pide entrar a otro, con el mismo pedido
-- (09/10): Fede, de Dos, pide Uno y lo decide Beto.
select pruebas.ser('fede@libre.com'); set role authenticated;
select pruebas.esperar('Fede está en Dos', (select string_agg(nombre, ',') from v_mis_clubes where rol is not null and hasta is null), 'Club Dos FC');
select pedir_acceso(' club uno ', 'Brasil') as pedido_fede \gset
select pruebas.esperar('...pide entrar a Uno y espera, como cualquiera', (select club_escrito || '|' || estado from mis_pedidos()), 'club uno|abierto');
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto (admin de Uno) ve el pedido de Fede', (select string_agg(email, ',') from pedidos_del_club(:C1)), 'fede@libre.com');
select aceptar_pedido(:'pedido_fede', false, false, true, false);
reset role;
select pruebas.ser('fede@libre.com'); set role authenticated;
select pruebas.esperar('...lo acepta: Fede queda en Uno como staff, y sigue en Dos', (select string_agg(nombre || ':' || rol, ',' order by nombre) from v_mis_clubes where rol is not null and hasta is null), 'Club Dos FC:staff,Club Uno:staff');
select pruebas.esperar('...en Uno, con Lesiones', (select lesiones::text from v_mis_clubes where id = :C1), 'true');
select pruebas.esperar('...y ve su pedido aceptado', (select estado from mis_pedidos()), 'aceptado');
reset role;

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

-- ---------------------------------------------- Sub-dueños protegidos --

-- La sub-dueña trabaja como staff en Uno y en Atlético, donde el principal
-- es administrador (por SQL). A ella tampoco la saca nadie, ni otro dueño.
select set_config('request.jwt.claims', '', false);
select id as atletico from equipos where nombre = 'Atlético Mineiro' \gset
insert into club_miembros (equipo_id, user_id, rol, partido, flujo, lesiones) values
  (:C1, '00000000-0000-0000-0000-0000000000d2', 'staff', true, false, false),
  (:'atletico', '00000000-0000-0000-0000-0000000000d2', 'staff', true, false, false);
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Beto (admin de Uno) no le da de baja a la sub-dueña', $$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d2'$$, 'dueno_protegido');
select pruebas.debe_fallar('...ni le cambia cuándo se creó su fila', $$update club_miembros set creado_en = '1990-01-01' where user_id = '00000000-0000-0000-0000-0000000000d2'$$, 'permission denied');
select pruebas.filas($$update club_miembros set desde = '1990-01-01' where user_id = '00000000-0000-0000-0000-0000000000d2' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$);
select pruebas.esperar('...ni cuándo entró', (select desde::text from v_miembros_club where user_id = '00000000-0000-0000-0000-0000000000d2' and equipo_id = :C1), current_date::text);
select pruebas.debe_fallar('...ni le cambia los módulos', $$update club_miembros set lesiones = true where user_id = '00000000-0000-0000-0000-0000000000d2'$$, 'dueno_protegido');
select pruebas.esperar('En la gente de Uno, la sub-dueña y el principal (aunque ya se fue) salen protegidos', (select string_agg(email, ',' order by email) from v_miembros_club where equipo_id = :C1 and protegido), 'duenio@prueba.com,subduenia@prueba.com');
select pruebas.esperar('...y nadie más', (select bool_or(protegido)::text from v_miembros_club where equipo_id = :C1 and email not in ('duenio@prueba.com', 'subduenia@prueba.com')), 'false');
reset role;
select pruebas.debe_fallar('Con la sesión de Beto, por SQL, tampoco se borra su fila', $$delete from club_miembros where user_id = '00000000-0000-0000-0000-0000000000d2' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$, 'dueno_protegido');
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.debe_fallar('El principal (admin de Atlético) tampoco le da de baja', $$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d2'$$, 'dueno_protegido');
select pruebas.debe_fallar('...ni le cambia los módulos', $$update club_miembros set flujo = true where user_id = '00000000-0000-0000-0000-0000000000d2'$$, 'dueno_protegido');
select pruebas.esperar('...y en Atlético también la ve protegida', (select protegido::text from v_miembros_club where user_id = '00000000-0000-0000-0000-0000000000d2'), 'true');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (de Dos) no averigua si alguien de otro club es dueño',
  (select public.miembro_protegido('00000000-0000-0000-0000-0000000000d2') || ',' || public.miembro_protegido('00000000-0000-0000-0000-0000000000d1')), 'false,false');
select pruebas.esperar('...y en la gente de Dos nadie sale protegido', (select count(*) from v_miembros_club where equipo_id = :C2 and protegido), 0);
-- Ni invitándolos: a un dueño, la invitación de otro no lo mete en un club
-- (queda abierta, como la de un correo sin cuenta). Eva no pasa a compartir
-- club con ellos, y protegido le sigue diciendo que no.
select pruebas.esperar('Eva invita a Dos a los dos dueños', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c2', 'subduenia@prueba.com'), ('00000000-0000-0000-0000-0000000000c2', 'duenio@prueba.com')$$), 2);
select pruebas.esperar('...las invitaciones quedan abiertas, como las de un correo sin cuenta', (select count(*) from club_invitaciones where equipo_id = :C2 and email in ('subduenia@prueba.com', 'duenio@prueba.com') and usada_en is null), 2);
select pruebas.esperar('...ninguno entra a Dos', (select count(*) from v_miembros_club where equipo_id = :C2 and user_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')), 0);
select pruebas.esperar('...y sigue sin saber si son dueños',
  (select public.miembro_protegido('00000000-0000-0000-0000-0000000000d2') || ',' || public.miembro_protegido('00000000-0000-0000-0000-0000000000d1')), 'false,false');
select pruebas.esperar('Eva las cancela', pruebas.filas($$update club_invitaciones set cancelada_en = now() where equipo_id = '00000000-0000-0000-0000-0000000000c2' and email in ('subduenia@prueba.com', 'duenio@prueba.com')$$), 2);
reset role;
select pruebas.esperar('Ningún dueño quedó en Dos', (select count(*) from club_miembros where equipo_id = :C2 and user_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')), 0);
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select salir_del_club(:C1);
select pruebas.esperar('Ella sí se va de Uno, con salir_del_club', (select hasta::text from v_mis_clubes where id = :C1), current_date::text);
reset role;
-- Volver también lo decide ella: Beto no la vuelve a meter, ni a mano ni con
-- una invitación.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Beto no la reincorpora', $$update club_miembros set hasta = null, desde = current_date where user_id = '00000000-0000-0000-0000-0000000000d2' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$, 'dueno_protegido');
select pruebas.esperar('...ni con una invitación, que queda abierta', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'subduenia@prueba.com')$$), 1);
select pruebas.esperar('...y ella sigue afuera', (select count(*) from club_invitaciones where email = 'subduenia@prueba.com' and equipo_id = :C1 and usada_en is null)
                                                   || ',' || (select hasta::text from v_miembros_club where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-0000000000d2'),
  '1,' || current_date);
select pruebas.esperar('Beto la cancela', pruebas.filas($$update club_invitaciones set cancelada_en = now() where email = 'subduenia@prueba.com' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select set_config('request.jwt.claims', '', false);
select pruebas.esperar('Su historia en Uno: entró y se fue, nada más', (select string_agg(accion, ',' order by id) from club_miembros_historial where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-0000000000d2'), 'alta,baja');
-- Vuelve si ella lo pide: un pedido, que acepta Beto.
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pedir_acceso('Club Uno') as pedido_subduenia \gset
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select aceptar_pedido(:'pedido_subduenia', true, false, false, false);
select pruebas.esperar('Ella lo pide y Beto lo acepta: vuelve a Uno', (select count(*) from club_miembros where equipo_id = :C1 and user_id = '00000000-0000-0000-0000-0000000000d2' and hasta is null), 1);
select pruebas.debe_fallar('...y otra vez no la puede sacar', $$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d2'$$, 'dueno_protegido');
reset role;
-- El principal le saca el lugar de sub-dueña: desde ahí es una más del club.
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select quitar_subdueno('00000000-0000-0000-0000-0000000000d2');
select pruebas.esperar('Ya no sub-dueña, en Atlético no sale protegida', (select protegido::text from v_miembros_club where user_id = '00000000-0000-0000-0000-0000000000d2'), 'false');
select pruebas.esperar('...y el principal le da de baja ahí', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d2'$$), 1);
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('En Uno, Beto la maneja como a cualquiera: le da Lesiones', pruebas.filas($$update club_miembros set lesiones = true where user_id = '00000000-0000-0000-0000-0000000000d2'$$), 1);
select pruebas.esperar('...y le da de baja', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-0000000000d2'$$), 1);
reset role;
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El principal la vuelve a sumar como sub-dueña', pruebas.filas($$select agregar_subdueno('subduenia@prueba.com')$$), 1);
reset role;
-- Ni cambiándose el correo: si un dueño pasa a una dirección que un admin
-- invitó, esa invitación tampoco lo mete (Supabase cambia el correo sin
-- sesión, y sin sesión el freno de arriba no actúa). Queda abierta, como la
-- de un correo sin cuenta, y quien invitó no se entera de que es un dueño.
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva invita a Dos dos correos sin cuenta', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c2', 'casilla.nueva@prueba.com'), ('00000000-0000-0000-0000-0000000000c2', 'casilla.otra@prueba.com')$$), 2);
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('...y Beto invita a Uno el primero', pruebas.filas($$insert into club_invitaciones (equipo_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'casilla.nueva@prueba.com')$$), 1);
reset role;
select set_config('request.jwt.claims', '', false);
update auth.users set email = 'casilla.nueva@prueba.com' where id = '00000000-0000-0000-0000-0000000000d2';
update auth.users set email = 'casilla.otra@prueba.com' where id = '00000000-0000-0000-0000-0000000000d1';
select pruebas.esperar('Los dos dueños se pasan a esos correos: ninguno entra a Dos ni vuelve a Uno', (select count(*) from club_miembros where equipo_id in (:C1, :C2) and user_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2') and hasta is null), 0);
select pruebas.esperar('...las tres invitaciones siguen abiertas', (select count(*) from club_invitaciones where email in ('casilla.nueva@prueba.com', 'casilla.otra@prueba.com') and usada_en is null), 3);
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('...y Eva sigue sin saber si son dueños',
  (select public.miembro_protegido('00000000-0000-0000-0000-0000000000d2') || ',' || public.miembro_protegido('00000000-0000-0000-0000-0000000000d1')), 'false,false');
reset role;
select set_config('request.jwt.claims', '', false);
update auth.users set email = 'subduenia@prueba.com' where id = '00000000-0000-0000-0000-0000000000d2';
update auth.users set email = 'duenio@prueba.com' where id = '00000000-0000-0000-0000-0000000000d1';
-- A cualquier otra cuenta, cambiarse a un correo invitado sí la mete.
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-00000000002a', 'cambia@prueba.com', now());
update auth.users set email = 'casilla.otra@prueba.com' where id = '00000000-0000-0000-0000-00000000002a';
select pruebas.esperar('Una cuenta común que se pasa a un correo invitado entra a Dos', (select count(*) from club_miembros where equipo_id = :C2 and user_id = '00000000-0000-0000-0000-00000000002a' and hasta is null), 1);
select pruebas.esperar('...y esa invitación queda usada', (select count(*) from club_invitaciones where email = 'casilla.otra@prueba.com' and usada_por = '00000000-0000-0000-0000-00000000002a'), 1);

-- ---------------------------------- Pedidos a un club sin administrador --

-- Un club nuevo, sin administrador: los pedidos a ese club van a los dueños,
-- y la persona ve lo mismo que siempre. Su nombre y el de Atlético no chocan.
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select crear_club('Estudiantes de La Plata') as estudiantes \gset
select pruebas.debe_fallar('Atlético escrito de otra forma no es otro club', $$select crear_club('ATLETICO   mineiro')$$, 'nombre_repetido');
reset role;
select set_config('request.jwt.claims', '', false);
select pruebas.esperar('Ningún par de clubes se escribe igual', (select count(*) - count(distinct normalizar_nombre_club(nombre)) from equipos), 0);
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000027', 'pide4@prueba.com', now()),
  ('00000000-0000-0000-0000-000000000028', 'pide5@prueba.com', now()),
  ('00000000-0000-0000-0000-000000000029', 'jefe5@prueba.com', now());
select pruebas.ser('pide4@prueba.com'); set role authenticated;
select pedir_acceso('estudiantes de la plata', 'Argentina') as pedido4 \gset
select pruebas.esperar('pide4 pide un club que está pero no tiene administrador, y ve lo mismo que siempre', (select club_escrito || '|' || estado from mis_pedidos()), 'estudiantes de la plata|abierto');
reset role;
select pruebas.esperar('...su pedido no queda en ese club', (select coalesce(equipo_id::text, 'ninguno') from club_pedidos where id = :'pedido4'), 'ninguno');
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pruebas.esperar('Lo ven los dueños', (select count(*) from pedidos_sin_club() where id = :'pedido4'), 1);
select pruebas.debe_fallar('...y no lo mandan a un club sin administrador', format('select derivar_pedido(%L, %L)', :'pedido4', :'estudiantes'), 'club_sin_admin');
select pruebas.esperar('...que sigue en el panel', (select count(*) from pedidos_sin_club() where id = :'pedido4'), 1);
reset role;
-- Estudiantes tiene administrador (por SQL): el pedido de antes sigue en el
-- panel hasta que los dueños lo manden.
select set_config('request.jwt.claims', '', false);
update perfiles set estado = 'autorizado' where email = 'jefe5@prueba.com';
insert into club_miembros (equipo_id, user_id, rol, partido, flujo, lesiones)
values (:'estudiantes', '00000000-0000-0000-0000-000000000029', 'admin', true, false, false);
select pruebas.ser('jefe5@prueba.com'); set role authenticated;
select pruebas.esperar('El administrador nuevo no lo ve entre los pedidos de su club', (select count(*) from pedidos_del_club(:'estudiantes')), 0);
reset role;
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select derivar_pedido(:'pedido4', :'estudiantes');
select pruebas.esperar('Los dueños lo mandan a Estudiantes y sale del panel', (select count(*) from pedidos_sin_club() where id = :'pedido4'), 0);
reset role;
select pruebas.ser('pide5@prueba.com'); set role authenticated;
select pedir_acceso('Estudiantes de La Plata') as pedido5 \gset
reset role;
select pruebas.ser('jefe5@prueba.com'); set role authenticated;
select pruebas.esperar('Ahora sí los ve el administrador de Estudiantes: el mandado y el nuevo', (select string_agg(email, ',' order by email) from pedidos_del_club(:'estudiantes')), 'pide4@prueba.com,pide5@prueba.com');
reset role;
-- Estudiantes se queda sin administrador (su cuenta se bloquea por SQL): sus
-- pedidos abiertos vuelven al panel.
select set_config('request.jwt.claims', '', false);
update perfiles set estado = 'bloqueado' where email = 'jefe5@prueba.com';
select pruebas.ser('subduenia@prueba.com'); set role authenticated;
select pruebas.esperar('Los pedidos de un club que se quedó sin administrador se ven en el panel', (select string_agg(email, ',' order by email) from pedidos_sin_club()), 'pide4@prueba.com,pide5@prueba.com');
select pruebas.debe_fallar('...no van a otro club sin administrador', format('select derivar_pedido(%L, %L)', :'pedido5', :'club_cuatro'), 'club_sin_admin');
select pruebas.debe_fallar('...ni de vuelta al suyo', format('select derivar_pedido(%L, %L)', :'pedido5', :'estudiantes'), 'club_sin_admin');
select derivar_pedido(:'pedido5', :C2);
select rechazar_pedido_sin_club(:'pedido4');
select pruebas.esperar('...uno va a Dos y el otro se rechaza', (select count(*) from pedidos_sin_club()), 0);
select pruebas.debe_fallar('Un pedido de un club con administrador no se toca desde el panel', format('select rechazar_pedido_sin_club(%L)', :'pedido5'), 'pedido_cerrado');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (admin de Dos) lo ve', (select string_agg(email, ',') from pedidos_del_club(:C2)), 'pide5@prueba.com');
reset role;
select pruebas.ser('pide4@prueba.com'); set role authenticated;
select pruebas.esperar('pide4 lo ve rechazado, como cualquier rechazo', (select estado from mis_pedidos()), 'rechazado');
reset role;
select pruebas.ser('pide5@prueba.com'); set role authenticated;
select pruebas.esperar('...y pide5, esperando como siempre', (select estado from mis_pedidos()), 'abierto');
reset role;
select pruebas.esperar('En los movimientos queda de qué club venía', (select detalle ->> 'club_antes' from plataforma_historial where accion = 'derivar_pedido' and email = 'pide5@prueba.com'), :'estudiantes');

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

-- Lo nuevo sin recargar (20261017_en_vivo): las tablas que la app mira en
-- vivo están en la publicación de Realtime, y anon sigue sin poder leerlas.
select pruebas.esperar('Las tablas en vivo están en la publicación de Realtime',
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename in ('lesiones', 'jugadores', 'evaluaciones', 'gps', 'notas')), 5);
set role anon;
select pruebas.debe_fallar('Sin sesión, las lesiones siguen cerradas', $$select count(*) from lesiones$$, 'permission denied');
select pruebas.debe_fallar('...y el GPS también', $$select count(*) from gps$$, 'permission denied');
reset role;

-- Las horas de Lesiones c/1000h salen del GPS (20261018_minutos_lesiones):
-- por jugador y día, Minutos Campo + Minutos Fuerza Metabólico de todas sus
-- filas; el promedio del equipo no cuenta; la selección va aparte. Las ve
-- quien tiene Lesiones (aunque no tenga GPS), sin ver las filas del GPS.
insert into public.gps (equipo_id, fecha, jugador_id, persona, promedio, datos) values
  (:C1, current_date - 1, 9006, null, null, '{"min_campo": 60.5, "min_fuerza": 30, "d": 4100}'),
  (:C1, current_date - 1, 9006, null, null, '{"min_campo": 25, "descripcion": "Tarea con pelota"}'),
  (:C1, current_date - 1, 9006, null, null, '{"min_campo": 90, "descripcion": "Vs Rival TOTAL Selección"}'),
  (:C1, current_date - 1, null, 'Juvenil Invitado', null, '{"min_campo": 40}'),
  (:C1, current_date - 1, null, null, 'sesion', '{"min_campo": 999}'),
  (:C1, current_date - 2, 9006, null, null, '{"min_campo": "45", "descripcion": "Convocacion Seleccion"}');
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('Con Lesiones y sin GPS, ve los minutos de Uno: por jugador, día y selección',
  (select string_agg(coalesce(jugador_id::text, persona) || ':' || seleccion || ':' || minutos, ', ' order by jugador_id nulls last, seleccion)
     from minutos_de_entrenamiento(:C1)), '9006:false:115.5, 9006:true:90, Juvenil Invitado:false:40');
select pruebas.esperar('...del día que fueron', (select count(distinct fecha) from minutos_de_entrenamiento(:C1) where fecha = current_date - 1), 1);
select pruebas.esperar('...pero sigue sin ver las filas del GPS', (select count(*) from gps), 0);
reset role;
select pruebas.esperar('La cuenta nueva se va de Uno hoy', pruebas.filas($$update club_miembros set hasta = current_date where user_id = '00000000-0000-0000-0000-000000000012' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('...y los sigue viendo en la foto de su último día', (select sum(minutos)::text from minutos_de_entrenamiento(:C1)), '245.5');
reset role;
-- Como si esas filas se hubieran cargado pasado mañana: en la foto de quien
-- se fue hoy ya no están.
update versiones_datos set cuando = cuando + interval '2 days'
 where tabla = 'gps' and equipo_id = :C1 and (fila ->> 'fecha')::date >= current_date - 2;
select pruebas.ser('nuevo@uno.com'); set role authenticated;
select pruebas.esperar('...pero no lo que se cargó después de irse', (select count(*) from minutos_de_entrenamiento(:C1)), 0);
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (de otro club) no ve los minutos de Uno', (select count(*) from minutos_de_entrenamiento(:C1)), 0);
reset role;
select pruebas.ser('gaby@uno.com'); set role authenticated;
select pruebas.esperar('Gaby (bloqueada) tampoco', (select count(*) from minutos_de_entrenamiento(:C1)), 0);
reset role;
select pruebas.ser('gps@uno.com'); set role authenticated;
select pruebas.esperar('Sin Lesiones, aunque haya tenido GPS, tampoco', (select count(*) from minutos_de_entrenamiento(:C1)), 0);
reset role;
set role anon;
select pruebas.debe_fallar('Sin sesión, nada', $$select * from minutos_de_entrenamiento('00000000-0000-0000-0000-0000000000c1')$$, 'permission denied');
reset role;
set role authenticated;
select pruebas.debe_fallar('Las cuentas de adentro no se llaman sueltas', $$select gps_minutos_de_fila('{}')$$, 'permission denied');
reset role;

-- La Base del GPS con muchas filas (20261019_gps_rapido): el permiso se
-- revisa una vez por pedido (los clubes donde la cuenta tiene GPS), no en
-- cada fila. Quién ve y cambia qué lo comprueban los escenarios del GPS.
select pruebas.esperar('Las cuatro políticas del GPS revisan el permiso una vez por pedido',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'gps'
      and coalesce(qual, '') || coalesce(with_check, '') like '%clubes_donde_puedo%'), 4);
select pruebas.esperar('...y no queda ninguna que lo revise fila por fila',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'gps'
      and coalesce(qual, '') || coalesce(with_check, '') like '%puede_usar_en%'), 0);

-- Lesiones y Evaluaciones, igual (20261023_lesiones_evaluaciones_rapido;
-- nota del 12/10). Quién ve y cambia qué lo comprueban sus escenarios.
select pruebas.esperar('Las cuatro de Lesiones y las cuatro de Evaluaciones revisan el permiso una vez por pedido',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename in ('lesiones', 'evaluaciones')
      and coalesce(qual, '') || coalesce(with_check, '') like '%clubes_donde_puedo%'), 8);
select pruebas.esperar('...y ninguna de las dos lo revisa fila por fila',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename in ('lesiones', 'evaluaciones')
      and coalesce(qual, '') || coalesce(with_check, '') like '%puede_usar_en%'), 0);

-- ------------------------------------- Un nombre cambiado, en todos lados --

-- Nota del 12/10: si se cambia el nombre de un jugador en Datos básicos,
-- cambia en todos lados. Partido guarda los nombres escritos en cada partido:
-- la base los cambia (lo del rival, no). 20261022_nombres_en_todos_lados.sql.
insert into public.jugadores (id, nombre, equipo_id) overriding system value values
  (9020, 'Scarpa', '00000000-0000-0000-0000-0000000000c1'),
  (9021, 'ZAGUERO', '00000000-0000-0000-0000-0000000000c1');
insert into public.registros_partido (fecha, rival, equipo_id, titulares, convocados, cambio_1_sale, cambio_1_entra,
                                      rival_cambio_sale1, cambios_extra, captura_tiempo, formacion_cancha)
values ('2026-10-01', 'Rival Nombres', '00000000-0000-0000-0000-0000000000c1', '{Scarpa,ZAGUERO}', '{Scarpa,ZAGUERO,SUPLENTE}', 'Scarpa', 'ZAGUERO',
        'Scarpa', '[{"sale":"Scarpa","entra":"ZAGUERO","hora":"80:00"}]',
        '{"modoTiempo":"transmision","cambios":[{"sale":"Scarpa","entra":"ZAGUERO"}],"cambiosRival":[{"sale":"Scarpa"}]}',
        '{"lineas":{"arquero":1},"puestos":{"arquero-0":{"nombre":"Scarpa","x":10,"y":20},"defensa-0":{"nombre":"ZAGUERO"}}}');

-- La preparadora (Evaluaciones y GPS, sin Partido) le cambia el nombre en
-- Datos básicos.
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('La preparadora no ve partidos', (select count(*) from registros_partido), 0);
select pruebas.esperar('...y le cambia el nombre a un jugador', pruebas.filas($$update jugadores set nombre = 'G. SCARPA' where id = 9020$$), 1);
select pruebas.esperar('...el nombre anterior queda anotado', (select string_agg(nombre, ',') from jugadores_nombres_anteriores where jugador_id = 9020), 'Scarpa');
select pruebas.debe_fallar('...pero nadie lo anota a mano', $$insert into jugadores_nombres_anteriores (jugador_id, equipo_id, nombre) values (9020, '00000000-0000-0000-0000-0000000000c1', 'Otro')$$, 'permission denied');
select pruebas.debe_fallar('...ni lo borra', $$delete from jugadores_nombres_anteriores$$, 'permission denied');
select pruebas.debe_fallar('...ni pasa los partidos a mano', $$select partidos_con_nombres_de_hoy('00000000-0000-0000-0000-0000000000c1')$$, 'permission denied');
reset role;

select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('En Partido, los titulares con el nombre nuevo', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA,ZAGUERO');
select pruebas.esperar('...los convocados', (select array_to_string(convocados, ',') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA,ZAGUERO,SUPLENTE');
select pruebas.esperar('...los cambios', (select cambio_1_sale || '>' || cambio_1_entra from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA>ZAGUERO');
select pruebas.esperar('...los cambios del sexto en adelante, con su hora', (select (cambios_extra -> 0 ->> 'sale') || ' ' || (cambios_extra -> 0 ->> 'hora') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA 80:00');
select pruebas.esperar('...los de la guía de la transmisión', (select captura_tiempo #>> '{cambios,0,sale}' from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA');
select pruebas.esperar('...y la formación, sin moverlo de su lugar', (select (formacion_cancha #>> '{puestos,arquero-0,nombre}') || ' ' || (formacion_cancha #>> '{puestos,arquero-0,x}') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA 10');
select pruebas.esperar('Lo del rival queda como estaba', (select rival_cambio_sale1 || ',' || (captura_tiempo #>> '{cambiosRival,0,sale}') from registros_partido where rival = 'Rival Nombres'), 'Scarpa,Scarpa');
-- Un partido cargado sin señal antes del cambio llega después.
select pruebas.esperar('Un partido que sube tarde con el nombre anterior', pruebas.filas($$insert into registros_partido (fecha, rival, equipo_id, titulares, cambio_1_sale) values ('2026-10-02', 'Rival Tarde', '00000000-0000-0000-0000-0000000000c1', '{Scarpa,ZAGUERO}', 'scarpa ')$$), 1);
select pruebas.esperar('...se guarda con el de hoy', (select array_to_string(titulares, ',') || '|' || cambio_1_sale from registros_partido where rival = 'Rival Tarde'), 'G. SCARPA,ZAGUERO|G. SCARPA');
select pruebas.esperar('...también si se lo corrige', pruebas.filas($$update registros_partido set convocados = '{Scarpa}' where rival = 'Rival Tarde'$$), 1);
select pruebas.esperar('...queda el de hoy', (select array_to_string(convocados, ',') from registros_partido where rival = 'Rival Tarde'), 'G. SCARPA');
-- Solo mayúsculas: también.
select pruebas.esperar('Beto le cambia solo las mayúsculas a otro', pruebas.filas($$update jugadores set nombre = 'Zaguero' where id = 9021$$), 1);
select pruebas.esperar('...y en los partidos queda así', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA,Zaguero');
-- Vuelve a un nombre que ya tuvo: ese deja de ser anterior.
select pruebas.esperar('...y después le vuelve a poner el de antes', pruebas.filas($$update jugadores set nombre = 'ZAGUERO' where id = 9021$$), 1);
select pruebas.esperar('...queda como anterior el del medio', (select string_agg(nombre, ',') from jugadores_nombres_anteriores where jugador_id = 9021), 'Zaguero');
select pruebas.esperar('...y los partidos, con el de hoy', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA,ZAGUERO');
reset role;

select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva no ve los nombres anteriores de Uno', (select count(*) from jugadores_nombres_anteriores), 0);
reset role;

-- Un jugador nuevo con un nombre que fue de otro: desde ahí ese nombre es
-- del nuevo y no se cambia.
insert into public.jugadores (id, nombre, equipo_id) overriding system value values
  (9022, 'SCARPA', '00000000-0000-0000-0000-0000000000c1');
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Un partido con el jugador nuevo', pruebas.filas($$insert into registros_partido (fecha, rival, equipo_id, titulares) values ('2026-10-03', 'Rival Homonimo', '00000000-0000-0000-0000-0000000000c1', '{SCARPA}')$$), 1);
select pruebas.esperar('...queda como vino', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival Homonimo'), 'SCARPA');
select pruebas.esperar('...y los de antes siguen con el otro', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA,ZAGUERO');
reset role;

-- Lo que cambió de nombre antes de esto (en la foto al día): al correr la
-- migración, esos partidos pasan al nombre de hoy.
insert into public.jugadores (id, nombre, equipo_id) overriding system value values
  (9023, 'LATERAL', '00000000-0000-0000-0000-0000000000c1');
insert into public.versiones_datos (tabla, fila_id, equipo_id, accion, fila, cuando)
values ('jugadores', '9023', '00000000-0000-0000-0000-0000000000c1', 'editada',
        '{"id":9023,"nombre":"LATERAL VIEJO","equipo_id":"00000000-0000-0000-0000-0000000000c1"}', '2026-10-06');
insert into public.registros_partido (fecha, rival, equipo_id, titulares)
values ('2026-10-05', 'Rival De Antes', '00000000-0000-0000-0000-0000000000c1', '{LATERAL VIEJO}');
select pruebas.esperar('Antes de correrla, el partido tiene el nombre de antes', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival De Antes'), 'LATERAL VIEJO');
\ir ../migrations/20261022_nombres_en_todos_lados.sql
select pruebas.esperar('...después, el de hoy', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival De Antes'), 'LATERAL');
select pruebas.esperar('...y el de antes queda anotado', (select string_agg(nombre, ',') from jugadores_nombres_anteriores where jugador_id = 9023), 'LATERAL VIEJO');
select pruebas.esperar('...sin tocar lo que ya estaba bien', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival Homonimo'), 'SCARPA');
-- Y los arreglos de después (20261109 y 20261110), que la de arriba acaba
-- de pisar.
\ir ../migrations/20261109_nombres_con_listas_json.sql
\ir ../migrations/20261110_nombres_en_los_vr.sql

-- Los titulares y los convocados de una base de antes (lista JSON en vez de
-- lista de textos, como la del club): cambiar un nombre daba «No se pudo
-- guardar» (20261109).
begin;
alter table public.registros_partido alter column titulares drop default, alter column convocados drop default;
alter table public.registros_partido alter column titulares type jsonb using to_jsonb(titulares),
                                      alter column convocados type jsonb using to_jsonb(convocados);
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Con los partidos de una base de antes (lista JSON), Beto le cambia el nombre a un jugador',
  pruebas.filas($$update jugadores set nombre = 'ZAGUERO DOS' where id = 9021$$), 1);
select pruebas.esperar('...los titulares quedan con el nombre nuevo, como lista JSON', (select titulares::text from registros_partido where rival = 'Rival Nombres'), '["G. SCARPA", "ZAGUERO DOS"]');
select pruebas.esperar('...los convocados también', (select convocados::text from registros_partido where rival = 'Rival Nombres'), '["G. SCARPA", "ZAGUERO DOS", "SUPLENTE"]');
select pruebas.esperar('...y los cambios', (select cambio_1_sale || '>' || cambio_1_entra from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA>ZAGUERO DOS');
select pruebas.esperar('Un partido que sube tarde con el nombre anterior', pruebas.filas($$insert into registros_partido (fecha, rival, equipo_id, titulares, convocados) values ('2026-10-04', 'Rival Lista', '00000000-0000-0000-0000-0000000000c1', '["zaguero ", null, 7]', '"no es una lista"')$$), 1);
select pruebas.esperar('...se guarda con el de hoy (lo que no es un nombre, como vino)', (select titulares::text || ' | ' || convocados::text from registros_partido where rival = 'Rival Lista'), '["ZAGUERO DOS", null, 7] | "no es una lista"');
reset role;
rollback;

-- Los V.R. por jugador del GPS llevan el nombre escrito en grupo: también
-- pasan al de hoy (20261110; Santiago, 20/10: «Sí, que cambien»).
begin;
insert into public.gps_referencias (equipo_id, dispositivo, tipo, tabla, grupo) values
  ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'Microciclo', 'Partidos', 'ZAGUERO'),
  ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'Microciclo', 'Total', 'zaguero '),
  ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'Microciclo', 'Promedio', 'ZAGUERO'),
  ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'Microciclo', 'Promedio', 'ZAGUERO DOS'),
  ('00000000-0000-0000-0000-0000000000c1', 'catapult', 'ZAGUERO', 'ZAGUERO', 'TOTAL FUTBOL'),
  ('00000000-0000-0000-0000-0000000000c2', 'catapult', 'Microciclo', 'Partidos', 'ZAGUERO');
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto le cambia el nombre a un jugador con V.R. por jugador en GPS',
  pruebas.filas($$update jugadores set nombre = 'ZAGUERO DOS' where id = 9021$$), 1);
reset role;
select pruebas.esperar('...sus V.R. pasan al nombre nuevo (también el escrito distinto); si en la tabla ya hay uno con el nuevo, queda',
  (select string_agg(tabla || ' · ' || grupo, ', ' order by tabla, grupo) from gps_referencias
    where equipo_id = '00000000-0000-0000-0000-0000000000c1' and tipo = 'Microciclo' and grupo ilike 'zaguero%'),
  'Partidos · ZAGUERO DOS, Promedio · ZAGUERO, Promedio · ZAGUERO DOS, Total · ZAGUERO DOS');
select pruebas.esperar('...el tipo y la tabla no se tocan', (select count(*) from gps_referencias where tipo = 'ZAGUERO' and tabla = 'ZAGUERO' and grupo = 'TOTAL FUTBOL'), 1);
select pruebas.esperar('...ni los de otro club', (select grupo from gps_referencias where equipo_id = '00000000-0000-0000-0000-0000000000c2' and tipo = 'Microciclo'), 'ZAGUERO');
select pruebas.esperar('...y queda en los últimos cambios, a nombre de Beto',
  (select count(*) from referencias_historial
    where tabla = 'gps_referencias' and accion = 'editada' and quien = '00000000-0000-0000-0000-00000000000b'
      and antes ->> 'grupo' ilike 'zaguero%' and despues ->> 'grupo' = 'ZAGUERO DOS'), 2);
-- Si algo fallara con los V.R., el nombre se cambia igual.
create function pruebas.vr_que_falla() returns trigger language plpgsql as $$ begin raise exception 'falla a propósito'; end $$;
create trigger vr_que_falla before update on public.gps_referencias for each row execute function pruebas.vr_que_falla();
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Con los V.R. fallando, el nombre se cambia igual', pruebas.filas($$update jugadores set nombre = 'ZAGUERO TRES' where id = 9021$$), 1);
select pruebas.esperar('...y en los partidos también', (select array_to_string(titulares, ',') from registros_partido where rival = 'Rival Nombres'), 'G. SCARPA,ZAGUERO TRES');
reset role;
select pruebas.esperar('...los V.R. quedan como estaban', (select grupo from gps_referencias where equipo_id = '00000000-0000-0000-0000-0000000000c1' and tipo = 'Microciclo' and tabla = 'Partidos' and grupo ilike 'zaguero%'), 'ZAGUERO DOS');
rollback;

-- GPS › Cargar un día (20261111): se guarda entero, sin repetir un CSV que ya
-- está, y con la Regla 1 (Santiago, 20/10): con filas de esos jugadores ese
-- día y con ese dispositivo, se pregunta; reemplazar las cambia por las
-- nuevas, con el promedio del equipo. La preparadora tiene GPS.
begin;
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('Guarda un día entero de una vez, en su orden (también la tarea y el total iguales de quien hizo una sola tarea)',
  (select (gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'cat', $j$[
    {"fecha":"2026-09-20","jugador_id":9006,"datos":{"d":4100.1234,"tiempo":3000,"inicio":36000,"dispositivo":"cat","descripcion":"Tarea"}},
    {"fecha":"2026-09-20","jugador_id":9006,"datos":{"d":4100.1234,"tiempo":3000,"inicio":36000,"dispositivo":"cat","descripcion":"Total"}},
    {"fecha":"2026-09-20","jugador_id":9022,"datos":{"d":3900.5,"tiempo":2900,"inicio":36000,"dispositivo":"cat"}},
    {"fecha":"2026-09-20","persona":"Juvenil Invitado","datos":{"d":3500.25,"tiempo":2800,"inicio":36000,"dispositivo":"cat"}},
    {"fecha":"2026-09-20","promedio":"sesion","datos":{"d":3833.6,"dispositivo":"cat"}}
  ]$j$::jsonb)) ->> 'creadas'), '5');
select pruebas.esperar('...en el orden de carga', (select string_agg(coalesce(jugador_id::text, persona, promedio), ',' order by orden) from gps where fecha = '2026-09-20'), '9006,9006,9022,Juvenil Invitado,sesion');
select pruebas.debe_fallar('El mismo CSV otra vez, no: ya está en la Base', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'cat',
  '[{"fecha":"2026-09-20","jugador_id":9006,"datos":{"d":4100.12345,"tiempo":3000.2,"inicio":36000,"dispositivo":"cat"}}]')$q$, 'gps_ya_esta');
select pruebas.debe_fallar('...tampoco con otro dispositivo (el CSV es el mismo)', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'spo',
  '[{"fecha":"2026-09-20","jugador_id":9022,"datos":{"d":3900.5,"tiempo":2900,"inicio":36000,"dispositivo":"spo"}}]')$q$, 'gps_ya_esta');
select pruebas.debe_fallar('Regla 1: los mismos jugadores ese día, con el mismo dispositivo y otros datos, pregunta', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'cat',
  '[{"fecha":"2026-09-20","jugador_id":9006,"datos":{"d":5000,"tiempo":3100,"inicio":36000,"dispositivo":"cat"}}]')$q$, 'gps_dia_con_otras');
select pruebas.debe_fallar('...también una persona fuera de Datos básicos, escrita distinto', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'cat',
  '[{"fecha":"2026-09-20","persona":"juvenil invitado ","datos":{"d":3600,"tiempo":2800,"inicio":36000,"dispositivo":"cat"}}]')$q$, 'gps_dia_con_otras');
select pruebas.esperar('...y no guardó nada', (select count(*) from gps where fecha = '2026-09-20'), 5);
select pruebas.esperar('Con otro dispositivo ese día, entra sin preguntar',
  (select (gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'spo', '[{"fecha":"2026-09-20","jugador_id":9006,"datos":{"d":4200,"tiempo":3050,"inicio":50000,"dispositivo":"spo"}}]')) ->> 'creadas'), '1');
select pruebas.esperar('Otro turno (otra hora de inicio), los mismos jugadores y el mismo dispositivo: entra sin preguntar',
  (select (gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'cat', '[{"fecha":"2026-09-20","jugador_id":9022,"datos":{"d":2000,"tiempo":1500,"inicio":61200,"dispositivo":"cat"}},{"fecha":"2026-09-20","jugador_id":9022,"datos":{"d":2000,"tiempo":1500,"dispositivo":"cat","condicion":"total"}}]')) ->> 'creadas'), '2');
select pruebas.esperar('Reemplazar: cambia las filas de ese jugador ese día con ese dispositivo (sus tareas y su total) y el promedio, por las nuevas',
  (select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-20', 'cat', $j$[
    {"fecha":"2026-09-20","jugador_id":9006,"datos":{"d":5000,"tiempo":3100,"inicio":36000,"dispositivo":"cat"}},
    {"fecha":"2026-09-20","promedio":"sesion","datos":{"d":4400,"dispositivo":"cat"}}
  ]$j$::jsonb, true)::text), '{"creadas": 2, "reemplazadas": 3}');
select pruebas.esperar('...quedan las de los otros jugadores (también su otro turno) y las del otro dispositivo',
  (select string_agg(coalesce(jugador_id::text, persona, promedio) || ':' || (datos ->> 'dispositivo') || ':' || (datos ->> 'd'), ',' order by orden) from gps where fecha = '2026-09-20'),
  '9022:cat:3900.5,Juvenil Invitado:cat:3500.25,9006:spo:4200,9022:cat:2000,9022:cat:2000,9006:cat:5000,sesion:cat:4400');
select pruebas.debe_fallar('Las filas son todas de ese día', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-21', 'cat', '[{"fecha":"2026-09-20","jugador_id":9006,"datos":{"d":1,"dispositivo":"cat"}}]')$q$, 'gps_dia_filas');
select pruebas.debe_fallar('...y de ese dispositivo', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-21', 'cat', '[{"fecha":"2026-09-21","jugador_id":9006,"datos":{"d":1,"dispositivo":"spo"}}]')$q$, 'gps_dia_filas');
select pruebas.debe_fallar('...y alguna hay', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-21', 'cat', '[]')$q$, 'gps_dia_filas');
select pruebas.debe_fallar('No guarda en otro club', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c2', '2026-09-21', 'cat', '[{"fecha":"2026-09-21","persona":"Espía","datos":{"d":1,"dispositivo":"cat"}}]')$q$, 'row-level security');
reset role;
select pruebas.esperar('Lo reemplazado queda en las versiones, como todo borrado', (select count(*) from versiones_datos where tabla = 'gps' and accion = 'borrada' and fila ->> 'fecha' = '2026-09-20'), 3);
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.debe_fallar('Sin GPS no guarda', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-21', 'cat', '[{"fecha":"2026-09-21","jugador_id":9006,"datos":{"d":1,"dispositivo":"cat"}}]')$q$, 'row-level security');
reset role;
set role anon;
select pruebas.debe_fallar('Anon, nada', $q$select gps_guardar_dia('00000000-0000-0000-0000-0000000000c1', '2026-09-21', 'cat', '[{"fecha":"2026-09-21","jugador_id":9006,"datos":{"d":1,"dispositivo":"cat"}}]')$q$, 'permission denied');
reset role;
rollback;

-- GPS: al renombrar una opción de estrategia, cambia también en la
-- Descripción ya guardada (donde empieza cada parte).
insert into public.gps (equipo_id, fecha, persona, datos) values
  ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 'Desc Uno', '{"descripcion":"2026_10_08_CPS Rondo 4v4"}'),
  ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 'Desc Dos', '{"descripcion":"2026_10_08 PR Juego + CPS Rondo"}'),
  ('00000000-0000-0000-0000-0000000000c1', '2026-10-08', 'Desc Tres', '{"descripcion":"2026_10_08_PR Rondo CPS"}'),
  ('00000000-0000-0000-0000-0000000000c2', '2026-10-08', 'Desc Otro', '{"descripcion":"2026_10_08_CPS Rondo"}');
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('Renombra una estrategia: cambian las descripciones guardadas', (select gps_cambiar_en_descripciones('00000000-0000-0000-0000-0000000000c1', array['CPS'], 'CPS+')), 2);
select pruebas.esperar('...al principio de la parte', (select datos ->> 'descripcion' from gps where persona = 'Desc Uno'), '2026_10_08_CPS+ Rondo 4v4');
select pruebas.esperar('...y después de « + »', (select datos ->> 'descripcion' from gps where persona = 'Desc Dos'), '2026_10_08 PR Juego + CPS+ Rondo');
select pruebas.esperar('...pero no adentro del nombre de la tarea', (select datos ->> 'descripcion' from gps where persona = 'Desc Tres'), '2026_10_08_PR Rondo CPS');
select pruebas.esperar('Un nombre con signos también se cambia', (select gps_cambiar_en_descripciones('00000000-0000-0000-0000-0000000000c1', array['CPS+', 'CPS'], 'C.P.S')), 2);
select pruebas.esperar('...tal cual', (select datos ->> 'descripcion' from gps where persona = 'Desc Uno'), '2026_10_08_C.P.S Rondo 4v4');
select pruebas.esperar('...y queda quién lo cambió', (select actualizado_por::text from gps where persona = 'Desc Uno'), '00000000-0000-0000-0000-000000000015');
select pruebas.debe_fallar('Un nombre vacío, no', $$select gps_cambiar_en_descripciones('00000000-0000-0000-0000-0000000000c1', array['C.P.S'], '  ')$$, 'gps_descripcion_nombre');
reset role;
select pruebas.esperar('En otro club no cambia nada', (select datos ->> 'descripcion' from gps where persona = 'Desc Otro'), '2026_10_08_CPS Rondo');
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva no cambia las descripciones de Uno', (select gps_cambiar_en_descripciones('00000000-0000-0000-0000-0000000000c1', array['C.P.S'], 'X')), 0);
reset role;
select pruebas.esperar('...siguen como estaban', (select datos ->> 'descripcion' from gps where persona = 'Desc Uno'), '2026_10_08_C.P.S Rondo 4v4');

-- Datos básicos › Ajustes (20261028_datos_basicos_ajustes.sql): el nombre y
-- las listas de las columnas del jugador que comparte con Lesiones los
-- cambia cualquiera que sigue en el club; lo demás de Lesiones, solo quien
-- tiene Lesiones. Lo propio de Datos básicos, cualquiera que sigue.
insert into public.lesiones_campos (equipo_id, campo, etiqueta_es) values
  ('00000000-0000-0000-0000-0000000000c1', 'categoria', 'Categoría'),
  ('00000000-0000-0000-0000-0000000000c1', 'tipo_lesion', 'Tipo de lesión'),
  ('00000000-0000-0000-0000-0000000000c2', 'categoria', 'Categoría de Dos');
insert into public.lesiones_opciones (equipo_id, campo, codigo, etiqueta_es) values
  ('00000000-0000-0000-0000-0000000000c1', 'pie_dominante', 'destro', 'Derecho'),
  ('00000000-0000-0000-0000-0000000000c1', 'tipo_lesion', 'muscular', 'Muscular');
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('Sin Lesiones, la preparadora ve el nombre de las columnas del jugador', (select count(*) from lesiones_campos), 1);
select pruebas.esperar('...y sus listas, nada más', (select string_agg(campo, ',') from lesiones_opciones), 'pie_dominante');
select pruebas.esperar('...cambia el nombre de una', pruebas.filas($$update lesiones_campos set etiqueta_es = 'Categoría actual' where campo = 'categoria'$$), 1);
select pruebas.esperar('...renombra una opción', pruebas.filas($$update lesiones_opciones set etiqueta_es = 'Diestro' where codigo = 'destro'$$), 1);
select pruebas.esperar('...suma una (como la app, con upsert)', pruebas.filas($$insert into lesiones_opciones (equipo_id, campo, codigo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'categoria', 'sub21', 'Sub-21') on conflict (equipo_id, campo, codigo) do update set etiqueta_es = excluded.etiqueta_es$$), 1);
select pruebas.esperar('...y la esconde', pruebas.filas($$update lesiones_opciones set oculto = true where codigo = 'sub21'$$), 1);
select pruebas.esperar('...pero no la borra', pruebas.filas($$delete from lesiones_opciones where codigo = 'sub21'$$), 0);
select pruebas.esperar('...ni toca lo que es solo de Lesiones', pruebas.filas($$update lesiones_campos set etiqueta_es = 'x' where campo = 'tipo_lesion'$$) + pruebas.filas($$update lesiones_opciones set etiqueta_es = 'x' where campo = 'tipo_lesion'$$), 0);
select pruebas.debe_fallar('...ni lo suma', $$insert into lesiones_opciones (equipo_id, campo, codigo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'tipo_lesion', 'otra', 'Otra')$$, 'row-level security');
select pruebas.debe_fallar('...ni suma una columna del jugador en otro club', $$insert into lesiones_opciones (equipo_id, campo, codigo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c2', 'categoria', 'x', 'X')$$, 'row-level security');
select pruebas.esperar('...ni ve las de otro club', (select count(*) from lesiones_campos where equipo_id = :C2), 0);
select pruebas.esperar('Lo propio de Datos básicos: nombra una columna', pruebas.filas($$insert into datos_basicos_columnas (equipo_id, columna, etiqueta_es, etiqueta_pt) values ('00000000-0000-0000-0000-0000000000c1', 'foto_url', 'Foto carnet', 'Foto 3x4') on conflict (equipo_id, columna) do update set etiqueta_es = excluded.etiqueta_es, etiqueta_pt = excluded.etiqueta_pt$$), 1);
select pruebas.esperar('...esconde una compartida, solo en Datos básicos', pruebas.filas($$insert into datos_basicos_columnas (equipo_id, columna, oculto) values ('00000000-0000-0000-0000-0000000000c1', 'pie_dominante', true) on conflict (equipo_id, columna) do update set oculto = excluded.oculto$$), 1);
select pruebas.esperar('...y las ve', (select string_agg(columna || ':' || oculto, ',' order by columna) from datos_basicos_columnas), 'foto_url:false,pie_dominante:true');
select pruebas.debe_fallar('...pero no las borra', $$delete from datos_basicos_columnas$$, 'permission denied');
select pruebas.debe_fallar('...ni pone un nombre de más de 120 letras', $$update datos_basicos_columnas set etiqueta_es = repeat('x', 121)$$, 'datos_basicos_columnas_textos');
select pruebas.debe_fallar('...ni anota en otro club', $$insert into datos_basicos_columnas (equipo_id, columna) values ('00000000-0000-0000-0000-0000000000c2', 'foto_url')$$, 'row-level security');
reset role;
select pruebas.esperar('En Lesiones la columna compartida no quedó escondida', (select oculto::text from lesiones_campos where equipo_id = :C1 and campo = 'categoria'), 'false');
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Con Lesiones, Beto ve el nombre que puso la preparadora', (select etiqueta_es from lesiones_campos where equipo_id = :C1 and campo = 'categoria'), 'Categoría actual');
select pruebas.esperar('...y lo de Lesiones, como siempre', (select count(*) from lesiones_opciones where equipo_id = :C1), 3);
select pruebas.esperar('...y lo de Datos básicos', (select count(*) from datos_basicos_columnas), 2);
reset role;
select pruebas.ser('gps@uno.com'); set role authenticated;
select pruebas.esperar('Quien ya se fue de Uno no ve lo de Datos básicos', (select count(*) from datos_basicos_columnas) + (select count(*) from lesiones_campos) + (select count(*) from lesiones_opciones), 0);
select pruebas.esperar('...ni lo cambia', pruebas.filas($$update datos_basicos_columnas set oculto = false$$) + pruebas.filas($$update lesiones_opciones set etiqueta_es = 'x'$$), 0);
select pruebas.debe_fallar('...ni lo suma', $$insert into datos_basicos_columnas (equipo_id, columna) values ('00000000-0000-0000-0000-0000000000c1', 'edad')$$, 'row-level security');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva (de otro club) no ve lo de Datos básicos de Uno', (select count(*) from datos_basicos_columnas) + (select count(*) from lesiones_campos where equipo_id = :C1), 0);
select pruebas.esperar('...ni lo cambia', pruebas.filas($$update datos_basicos_columnas set oculto = false$$) + pruebas.filas($$update lesiones_campos set etiqueta_es = 'x' where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.esperar('...y en su club sí nombra la categoría', pruebas.filas($$update lesiones_campos set etiqueta_es = 'Categoria' where equipo_id = '00000000-0000-0000-0000-0000000000c2' and campo = 'categoria'$$), 1);
reset role;
set role anon;
select pruebas.debe_fallar('Sin cuenta, nada de Datos básicos', 'select count(*) from datos_basicos_columnas', 'permission denied');
reset role;

-- Niveles de permiso por módulo (20261029_niveles_de_permiso.sql): con un
-- módulo en «Solo lectura» se ve todo lo de ese módulo, pero no se carga,
-- no se cambia y no se borra nada; lo demás que tiene, con Edición.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto deja a la preparadora con GPS solo para mirar', pruebas.filas($$update club_miembros set solo_lectura = array['gps'] where user_id = '00000000-0000-0000-0000-000000000015' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.debe_fallar('...con un módulo que existe', $$update club_miembros set solo_lectura = array['otro'] where user_id = '00000000-0000-0000-0000-000000000015' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$, 'club_miembros_solo_lectura_valida');
select pruebas.esperar('...y lo ve en Cuentas', (select array_to_string(solo_lectura, ',') from v_miembros_club where user_id = '00000000-0000-0000-0000-000000000015' and equipo_id = :C1), 'gps');
reset role;
select pruebas.esperar('Queda en su historia como un cambio de módulos', (select count(*) from club_miembros_historial where user_id = '00000000-0000-0000-0000-000000000015' and accion = 'modulos' and detalle -> 'solo_lectura' ? 'gps'), 1);
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('La preparadora sabe que tiene GPS solo para mirar', (select array_to_string(solo_lectura, ',') from v_mis_clubes where id = :C1), 'gps');
select pruebas.esperar('...ve el GPS de Uno', (select (count(*) > 0)::int from gps where equipo_id = :C1), 1);
select pruebas.esperar('...y sus Ajustes y sus V.R.', (select (count(*) > 0)::int from gps_campos) + (select (count(*) > 0)::int from gps_referencias), 2);
select pruebas.debe_fallar('...pero no carga', $$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-10', 'Nueva')$$, 'row-level security');
select pruebas.esperar('...ni cambia', pruebas.filas($$update gps set datos = '{}' where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.esperar('...ni borra', pruebas.filas($$delete from gps where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.esperar('...ni toca los Ajustes', pruebas.filas($$update gps_campos set oculto = true$$) + pruebas.filas($$update gps_opciones set oculto = true$$) + pruebas.filas($$update gps_reglas set reglas = '{}'$$), 0);
select pruebas.debe_fallar('...ni los V.R.', format('select gps_referencia_cambiar(%L, %L, %L, 1)', :'vr_c1', 'promedio', 'd'), 'referencia_sin_permiso');
select pruebas.esperar('...ni renombra estrategias en las descripciones', (select gps_cambiar_en_descripciones('00000000-0000-0000-0000-0000000000c1', array['C.P.S'], 'X')), 0);
select pruebas.debe_fallar('...ni deja una carga sin terminar', $q$select gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000c1', '2026-10-12', 0, '{}', '{}')$q$, 'row-level security');
select pruebas.esperar('...ni sigue una', pruebas.filas($$update gps_en_curso set paso = 0$$) + pruebas.filas($$update gps_en_curso_datos set datos = '{}'$$), 0);
select pruebas.debe_fallar('...ni recuerda el dispositivo (no carga)', $$insert into gps_preferencias (equipo_id, dispositivo_pegar) values ('00000000-0000-0000-0000-0000000000c1', 'x') on conflict (user_id, equipo_id) do update set equipo_id = excluded.equipo_id, dispositivo_pegar = excluded.dispositivo_pegar$$, 'row-level security');
select pruebas.esperar('En Evaluaciones, con Edición, sigue cargando', pruebas.filas($$insert into evaluaciones (equipo_id, test, persona, fecha, datos) values ('00000000-0000-0000-0000-0000000000c1', 'zona_media', 'Nivel Uno', '2026-10-12', '{"lumbar":190}')$$), 1);
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto le devuelve la Edición', pruebas.filas($$update club_miembros set solo_lectura = '{}' where user_id = '00000000-0000-0000-0000-000000000015' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('...y la invita a otra cuenta con Partido y Lesiones solo para mirar', pruebas.filas($$insert into club_invitaciones (equipo_id, email, rol, partido, flujo, lesiones, solo_lectura) values ('00000000-0000-0000-0000-0000000000c1', 'mira@uno.com', 'staff', true, false, true, array['partido', 'lesiones'])$$), 1);
select pruebas.debe_fallar('...con módulos que existen', $$insert into club_invitaciones (equipo_id, email, solo_lectura) values ('00000000-0000-0000-0000-0000000000c1', 'otra@uno.com', array['notas'])$$, 'club_invitaciones_solo_lectura_valida');
reset role;
select pruebas.ser('pf@uno.com'); set role authenticated;
select pruebas.esperar('Con la Edición de vuelta, la preparadora carga en el GPS', pruebas.filas($$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000c1', '2026-10-10', 'Nueva')$$), 1);
select pruebas.esperar('...y la borra', pruebas.filas($$delete from gps where persona = 'Nueva'$$), 1);
reset role;
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000099', 'mira@uno.com', now());
select pruebas.esperar('La invitada entra a Uno con Partido y Lesiones solo para mirar', (select array_to_string(solo_lectura, ',') from club_miembros where user_id = '00000000-0000-0000-0000-000000000099' and equipo_id = :C1), 'partido,lesiones');
select pruebas.ser('mira@uno.com'); set role authenticated;
select pruebas.esperar('...ve los partidos y las lesiones de Uno', (select (count(*) > 0)::int from registros_partido where equipo_id = :C1) + (select (count(*) > 0)::int from lesiones where equipo_id = :C1), 2);
select pruebas.debe_fallar('...pero no carga un partido', $$insert into registros_partido (fecha, rival, equipo_id) values ('2026-10-12', 'Rival N', '00000000-0000-0000-0000-0000000000c1')$$, 'row-level security');
select pruebas.esperar('...ni cambia uno', pruebas.filas($$update registros_partido set rival = 'X' where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.debe_fallar('...ni carga una lesión', $$insert into lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000c1', 9002, '2026-10-12', '{"parte_cuerpo":"pe","lado":"direito"}')$$, 'row-level security');
select pruebas.esperar('...ni la cambia ni la borra', pruebas.filas($$update lesiones set fecha_alta = '2026-10-12'$$) + pruebas.filas($$delete from lesiones$$), 0);
select pruebas.debe_fallar('...ni cambia los Ajustes de Lesiones', $$insert into lesiones_opciones (equipo_id, campo, codigo, etiqueta_es) values ('00000000-0000-0000-0000-0000000000c1', 'tipo_lesion', 'nueva', 'Nueva')$$, 'row-level security');
select pruebas.esperar('...pero las columnas del jugador siguen siendo de Datos básicos (las cambia quien tiene Datos básicos con Edición)', pruebas.filas($$update lesiones_opciones set etiqueta_es = 'Diestro' where equipo_id = '00000000-0000-0000-0000-0000000000c1' and codigo = 'destro'$$), 1);
select pruebas.esperar('...y con Datos básicos con Edición agrega un jugador', pruebas.filas($$insert into jugadores (equipo_id, nombre) values ('00000000-0000-0000-0000-0000000000c1', 'Nivel Datos')$$), 1);
reset role;
-- Datos básicos en «Solo lectura» (20261030_datos_basicos_nivel.sql): sin
-- «Sin acceso» (todos los módulos usan su lista), ve todo y no cambia nada.
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto le deja Datos básicos solo para mirar', pruebas.filas($$update club_miembros set solo_lectura = array['partido', 'lesiones', 'datos'] where user_id = '00000000-0000-0000-0000-000000000099' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
select pruebas.esperar('...y también se puede invitar así', pruebas.filas($$insert into club_invitaciones (equipo_id, email, rol, partido, solo_lectura) values ('00000000-0000-0000-0000-0000000000c1', 'mira.datos@uno.com', 'staff', true, array['datos'])$$), 1);
reset role;
select pruebas.ser('mira@uno.com'); set role authenticated;
select pruebas.esperar('Con Datos básicos solo para mirar ve a los jugadores de Uno', (select (count(*) > 0)::int from jugadores where equipo_id = :C1), 1);
select pruebas.debe_fallar('...pero no agrega', $$insert into jugadores (equipo_id, nombre) values ('00000000-0000-0000-0000-0000000000c1', 'Otro Nivel')$$, 'row-level security');
select pruebas.esperar('...ni cambia', pruebas.filas($$update jugadores set nombre = 'X' where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
select pruebas.esperar('...ni borra', pruebas.filas($$delete from jugadores where nombre = 'Nivel Datos'$$), 0);
select pruebas.debe_fallar('...ni toca los Ajustes de Datos básicos', $$insert into datos_basicos_columnas (equipo_id, columna, oculto) values ('00000000-0000-0000-0000-0000000000c1', 'edad', true)$$, 'row-level security');
select pruebas.esperar('...ni las listas de las columnas del jugador', pruebas.filas($$update lesiones_opciones set etiqueta_es = 'Zurdo' where equipo_id = '00000000-0000-0000-0000-0000000000c1' and codigo = 'destro'$$), 0);
reset role;
select pruebas.ser('beto@uno.com'); set role authenticated;
select pruebas.esperar('Beto le devuelve la Edición en Datos básicos', pruebas.filas($$update club_miembros set solo_lectura = array['partido', 'lesiones'] where user_id = '00000000-0000-0000-0000-000000000099' and equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 1);
reset role;
select pruebas.ser('mira@uno.com'); set role authenticated;
select pruebas.esperar('...y vuelve a cambiar a sus jugadores', pruebas.filas($$delete from jugadores where nombre = 'Nivel Datos'$$), 1);
reset role;
-- El servidor manda cortes a Catapult solo con Flujo diario con Edición.
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('El principal, con Flujo y Edición en el club del token, manda cortes', (select catapult || ',' || flujo_edita from mi_cuenta()), 'true,true');
reset role;
update club_miembros set solo_lectura = array['flujo']
 where user_id = (select id from auth.users where email = 'duenio@prueba.com') and equipo_id = (select id from equipos where nombre = 'Atlético Mineiro');
select pruebas.ser('duenio@prueba.com'); set role authenticated;
select pruebas.esperar('...con Flujo solo para mirar, lee de Catapult pero no manda cortes', (select catapult || ',' || flujo_edita from mi_cuenta()), 'true,false');
reset role;
update club_miembros set solo_lectura = '{}'
 where user_id = (select id from auth.users where email = 'duenio@prueba.com') and equipo_id = (select id from equipos where nombre = 'Atlético Mineiro');
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.esperar('Eva no cambia el nivel de nadie en Uno', pruebas.filas($$update club_miembros set solo_lectura = array['partido'] where equipo_id = '00000000-0000-0000-0000-0000000000c1'$$), 0);
reset role;

-- ------------------------------------ Consentimiento de los atletas --
-- 20261103. Un club nuevo, sin confirmar: Nora (admin), Pablo (staff con
-- Lesiones, Evaluaciones y GPS) y Quique (staff, solo GPS). Lo que ya estaba
-- se carga sin cuenta (como desde el SQL Editor).
reset role;
select set_config('request.jwt.claims', '', false);
insert into public.equipos (id, nombre) values ('00000000-0000-0000-0000-0000000000e5', 'Club Nueve');
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'nora@nueve.com', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'pablo@nueve.com', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'quique@nueve.com', now()),
  ('00000000-0000-0000-0000-0000000000a4', 'rita@nueve.com', now());
update public.perfiles set estado = 'autorizado' where email in ('nora@nueve.com', 'pablo@nueve.com', 'quique@nueve.com', 'rita@nueve.com');
insert into public.club_miembros (equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones, gps) values
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000a1', '2026-01-01', null, 'admin', false, false, false, false, false),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000a2', '2026-01-01', null, 'staff', false, false, true, true, true),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000a3', '2026-01-01', null, 'staff', false, false, false, false, true),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000a4', '2026-01-01', current_date - 1, 'staff', false, false, true, false, false);
insert into public.lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000e5', 'Ya Estaba', '2026-05-01', '{}');
-- Al correr la migración, las personas que ya estaban quedan confirmadas
-- (sin nombre de quien confirmó); otra vez, no se repiten.
\ir ../migrations/20261103_consentimiento.sql
\ir ../migrations/20261103_consentimiento.sql
select pruebas.esperar('Las personas que ya estaban quedan confirmadas una vez, sin nombre de quien confirmó',
  (select count(*) from consentimientos where equipo_id = '00000000-0000-0000-0000-0000000000e5' and alcance = 'personas' and 'Ya Estaba' = any (personas)
      and confirmado_por is null and confirmado_como is null), 1);

select pruebas.ser('pablo@nueve.com'); set role authenticated;
select pruebas.debe_fallar('Sin la confirmación del club no se agrega un jugador', $$insert into jugadores (equipo_id, nombre) values ('00000000-0000-0000-0000-0000000000e5', 'Nuevo Nueve')$$, 'falta_consentimiento');
select pruebas.debe_fallar('...ni una lesión', $$insert into lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000e5', 'Ya Estaba', '2026-06-01', '{}')$$, 'falta_consentimiento');
select pruebas.debe_fallar('...ni una evaluación', $$insert into evaluaciones (equipo_id, test, persona, fecha) values ('00000000-0000-0000-0000-0000000000e5', 'zona_media', 'Ya Estaba', '2026-06-01')$$, 'falta_consentimiento');
select pruebas.debe_fallar('...ni el GPS', $$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000e5', '2026-06-01', 'Ya Estaba')$$, 'falta_consentimiento');
select pruebas.debe_fallar('...ni una carga de GPS en curso', $q$select gps_dejar_en_curso(null, null, '00000000-0000-0000-0000-0000000000e5', '2026-06-01', 0, '{}', '{}')$q$, 'falta_consentimiento');
select pruebas.esperar('Lo que ya estaba se sigue cambiando', pruebas.filas($$update lesiones set datos = '{"comentarios":"corregido"}' where persona = 'Ya Estaba'$$), 1);
select pruebas.debe_fallar('El staff no confirma por el club', $$insert into consentimientos (equipo_id, alcance, texto) values ('00000000-0000-0000-0000-0000000000e5', 'club', 'Confirmo.')$$, 'row-level security');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.debe_fallar('Alguien de otro club no se entera de si confirmó: lo frenan las reglas', $$insert into jugadores (equipo_id, nombre) values ('00000000-0000-0000-0000-0000000000e5', 'Espía')$$, 'row-level security');
select pruebas.debe_fallar('...ni confirma por él', $$insert into consentimientos (equipo_id, alcance, texto) values ('00000000-0000-0000-0000-0000000000e5', 'club', 'Confirmo.')$$, 'row-level security');
select pruebas.esperar('...ni ve sus confirmaciones', (select count(*) from consentimientos where equipo_id = '00000000-0000-0000-0000-0000000000e5'), 0);
reset role;
select pruebas.ser('nora@nueve.com'); set role authenticated;
select pruebas.esperar('El administrador confirma una vez por el club',
  pruebas.filas($$insert into consentimientos (equipo_id, alcance, texto, confirmado_por, confirmado_en, confirmado_como)
                  values ('00000000-0000-0000-0000-0000000000e5', 'club', 'Confirmo que el club tiene el consentimiento.', '00000000-0000-0000-0000-0000000000a2', '2020-01-01', 'entidad')$$), 1);
select pruebas.esperar('...a su nombre, hoy y como administrador (lo pone la base)',
  (select confirmado_como || ',' || confirmado_email || ',' || (confirmado_en > now() - interval '1 hour')::text || ',' || (confirmado_por = auth.uid())::text
     from consentimientos where equipo_id = '00000000-0000-0000-0000-0000000000e5' and alcance = 'club'), 'administrador,nora@nueve.com,true,true');
select pruebas.debe_fallar('La confirmación no se cambia', $$update consentimientos set texto = 'otro'$$, 'permission denied');
select pruebas.debe_fallar('...ni se borra', $$delete from consentimientos$$, 'permission denied');
reset role;
select pruebas.ser('pablo@nueve.com'); set role authenticated;
select pruebas.esperar('Confirmado el club, se agrega un jugador', pruebas.filas($$insert into jugadores (equipo_id, nombre) values ('00000000-0000-0000-0000-0000000000e5', 'Nuevo Nueve')$$), 1);
select pruebas.esperar('...y se cargan datos de quien ya estaba', pruebas.filas($$insert into lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000e5', 'Ya Estaba', '2026-06-01', '{}')$$), 1);
select pruebas.debe_fallar('Una persona nueva fuera de Datos básicos pide su confirmación', $$insert into lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000e5', 'Persona Nueva', '2026-06-02', '{}')$$, 'falta_consentimiento_persona');
select pruebas.debe_fallar('...también en Evaluaciones', $$insert into evaluaciones (equipo_id, test, persona, fecha) values ('00000000-0000-0000-0000-0000000000e5', 'zona_media', 'Persona Nueva', '2026-06-02')$$, 'falta_consentimiento_persona');
select pruebas.debe_fallar('...y en el GPS', $$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000e5', '2026-06-02', 'Persona Nueva')$$, 'falta_consentimiento_persona');
select pruebas.debe_fallar('...y al pasarle una fila que ya estaba', $$update lesiones set persona = 'Persona Nueva' where persona = 'Ya Estaba' and fecha_lesion = '2026-05-01'$$, 'falta_consentimiento_persona');
select pruebas.esperar('Quien carga el archivo confirma a sus personas',
  pruebas.filas($$insert into consentimientos (equipo_id, alcance, base, personas, texto)
                  values ('00000000-0000-0000-0000-0000000000e5', 'personas', 'lesiones', array['  Persona   Nueva ', 'Persona Nueva', ''], 'Confirmo el consentimiento de estas personas.')$$), 1);
select pruebas.esperar('...una vez cada nombre, como carga',
  (select array_to_string(personas, ',') || ',' || confirmado_como from consentimientos where equipo_id = '00000000-0000-0000-0000-0000000000e5' and base = 'lesiones' and confirmado_por = auth.uid()),
  'Persona Nueva,carga');
select pruebas.esperar('...y ya se carga, escrita como sea', pruebas.filas($$insert into lesiones (equipo_id, persona, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000e5', 'persona  nueva', '2026-06-02', '{}')$$), 1);
select pruebas.esperar('...también en otra base del club', pruebas.filas($$insert into gps (equipo_id, fecha, persona) values ('00000000-0000-0000-0000-0000000000e5', '2026-06-02', 'Persona Nueva')$$), 1);
reset role;
select pruebas.ser('quique@nueve.com'); set role authenticated;
select pruebas.debe_fallar('Sin Lesiones no se confirman personas de Lesiones', $$insert into consentimientos (equipo_id, alcance, base, personas, texto) values ('00000000-0000-0000-0000-0000000000e5', 'personas', 'lesiones', array['Otra'], 'Confirmo.')$$, 'row-level security');
select pruebas.esperar('...ni se ven las que se confirmaron ahí', (select count(*) from consentimientos where equipo_id = '00000000-0000-0000-0000-0000000000e5' and alcance = 'personas' and base = 'lesiones'), 0);
select pruebas.esperar('...pero sí que el club confirmó', (select count(*) from consentimientos where equipo_id = '00000000-0000-0000-0000-0000000000e5' and alcance = 'club'), 1);
reset role;
select pruebas.ser('rita@nueve.com'); set role authenticated;
select pruebas.esperar('Quien se fue del club no ve las personas que se confirmaron', (select count(*) from consentimientos where equipo_id = '00000000-0000-0000-0000-0000000000e5' and alcance = 'personas'), 0);
reset role;

-- ------------------------------------ Exportar los datos de un atleta --
-- 20261104. En el club Nueve (de arriba): un atleta con un nombre anterior,
-- una lesión, una evaluación, una fila de GPS y dos partidos (en uno está, con
-- compañeros; en el otro, no). Se carga sin cuenta.
reset role;
select set_config('request.jwt.claims', '', false);
insert into public.jugadores (id, nombre, equipo_id, fecha_nacimiento) overriding system value values (9101, 'ANTES NOMBRE', '00000000-0000-0000-0000-0000000000e5', '2004-05-06');
update public.jugadores set nombre = 'ATLETA EXPORTA' where id = 9101;
insert into public.lesiones (equipo_id, jugador_id, fecha_lesion, datos) values ('00000000-0000-0000-0000-0000000000e5', 9101, '2026-07-01', '{"parte_cuerpo":"coxa","lado":"direito"}');
update public.lesiones set fecha_alta = '2026-07-20' where jugador_id = 9101;
insert into public.evaluaciones (equipo_id, test, jugador_id, fecha, datos) values ('00000000-0000-0000-0000-0000000000e5', 'zona_media', 9101, '2026-07-02', '{"lumbar":200}');
insert into public.gps (equipo_id, fecha, jugador_id, datos) values ('00000000-0000-0000-0000-0000000000e5', '2026-07-03', 9101, '{"d":5000}');
insert into public.lesiones_opciones (equipo_id, campo, codigo, etiqueta_es, etiqueta_pt) values ('00000000-0000-0000-0000-0000000000e5', 'lado', 'direito', 'Derecho (del club)', 'Direito');
insert into public.registros_partido (fecha, rival, equipo_id, titulares, convocados, cambio_1_sale, cambio_1_entra, cambio_1_tiempo, cambios_extra) values
  ('2026-07-05', 'Rival Exporta', '00000000-0000-0000-0000-0000000000e5', array['ATLETA EXPORTA', 'COMPANERO TITULAR'], array['ATLETA EXPORTA', 'COMPANERO TITULAR', 'COMPANERO SUPLENTE'],
   'ATLETA EXPORTA', 'COMPANERO SUPLENTE', '60:00', '[{"sale":"COMPANERO TITULAR","entra":"ANTES NOMBRE","hora":"80:00"}]'),
  ('2026-07-12', 'Rival Sin El', '00000000-0000-0000-0000-0000000000e5', array['COMPANERO TITULAR'], array['COMPANERO TITULAR'], '', '', '', '[]');

select pruebas.ser('nora@nueve.com'); set role authenticated;
select exportar_atleta(9101) as exportado \gset
select pruebas.esperar('El administrador exporta todo lo del atleta: su ficha, sus nombres de antes, sus lesiones, evaluaciones y GPS',
  (select (:'exportado'::jsonb -> 'jugador' ->> 'nombre') || ',' || (:'exportado'::jsonb -> 'nombres_anteriores' -> 0 ->> 'nombre') || ','
          || jsonb_array_length(:'exportado'::jsonb -> 'lesiones') || ',' || jsonb_array_length(:'exportado'::jsonb -> 'evaluaciones') || ','
          || jsonb_array_length(:'exportado'::jsonb -> 'gps')), 'ATLETA EXPORTA,ANTES NOMBRE,1,1,1');
select pruebas.esperar('...los partidos donde estuvo, con lo suyo: convocado, titular, cuándo salió y cuándo entró (también con su nombre de antes)',
  (select (:'exportado'::jsonb -> 'partidos' = '[{"fecha": "2026-07-05", "rival": "Rival Exporta", "entro": ["80:00"], "salio": ["60:00"], "localia": "local", "titular": true, "convocado": true, "resultado": ""}]'::jsonb)::text),
  'true');
select pruebas.esperar('...sin nada de sus compañeros', (select (position('COMPANERO' in :'exportado') > 0)::text), 'false');
select pruebas.esperar('...y el historial de sus lesiones (quién, cuándo y qué) y de lo demás',
  (select string_agg(h ->> 'base' || ':' || (h ->> 'accion'), ',' order by h ->> 'base', h ->> 'accion') from jsonb_array_elements(:'exportado'::jsonb -> 'historial') h),
  'datos:creada,evaluaciones:creada,gps:creada,lesiones:creada,lesiones:editada');
select pruebas.esperar('...con los nombres de columnas y listas del club', (select string_agg(o ->> 'etiqueta_es', ',') from jsonb_array_elements(:'exportado'::jsonb -> 'ajustes' -> 'lesiones_opciones') o), 'Derecho (del club)');
select pruebas.debe_fallar('Un jugador que no existe contesta igual que uno ajeno', 'select exportar_atleta(123456)', 'solo_admin');
reset role;
-- Los titulares y los convocados de una base de antes (lista JSON en vez de
-- lista de textos, 20261105): lo mismo.
begin;
reset role;
alter table public.registros_partido alter column titulares drop default, alter column convocados drop default;
alter table public.registros_partido alter column titulares type jsonb using to_jsonb(titulares),
                                      alter column convocados type jsonb using to_jsonb(convocados);
set role authenticated;
select pruebas.esperar('...también con los partidos de una base de antes (titulares y convocados como lista JSON)',
  (select (exportar_atleta(9101) -> 'partidos' = '[{"fecha": "2026-07-05", "rival": "Rival Exporta", "entro": ["80:00"], "salio": ["60:00"], "localia": "local", "titular": true, "convocado": true, "resultado": ""}]'::jsonb)::text),
  'true');
rollback;
reset role;
select pruebas.ser('pablo@nueve.com'); set role authenticated;
select pruebas.debe_fallar('El staff no exporta, aunque tenga todas las bases', 'select exportar_atleta(9101)', 'solo_admin');
reset role;
select pruebas.ser('eva@dos.com'); set role authenticated;
select pruebas.debe_fallar('El administrador de otro club tampoco', 'select exportar_atleta(9101)', 'solo_admin');
reset role;

-- ------------------------------------------- Aislamiento entre clubes --
-- 20261102. Cada cuenta, en cada tabla y vista con club (también las que se
-- sumen después, sin tocar esto): no ve, no cambia ni borra filas de un club
-- donde nunca estuvo, ni las lee por otro lado. Donde estuvo y se fue sigue
-- viendo lo de su tiempo (eso lo miran los escenarios de arriba).

select pruebas.esperar('ajustes (la tabla vieja con el club de entonces) ya no se toca con cuenta',
  has_any_column_privilege('authenticated', 'public.ajustes', 'SELECT, INSERT, UPDATE')::text, 'false');
select pruebas.esperar('La base no tiene huecos entre clubes',
  (select coalesce(string_agg(problema || ': ' || objeto, ', ' order by problema, objeto), '') from public.huecos_entre_clubes()), '');
begin;
create table public.prueba_sin_reglas (equipo_id uuid);
create table public.prueba_abierta (equipo_id uuid);
alter table public.prueba_abierta enable row level security;
create policy abierta on public.prueba_abierta for select to authenticated using (true);
create table public.prueba_sin_club (dato text);
alter table public.prueba_sin_club enable row level security;
grant select on public.prueba_sin_club to authenticated;
create view public.prueba_vista as select * from public.lesiones;
grant select on public.prueba_vista to authenticated;
select pruebas.esperar('...y avisa si se suma una tabla sin reglas, una regla que no mira el club, algo sin club o una vista que se las saltea',
  (select string_agg(problema || ': ' || objeto, ', ' order by problema, objeto) from public.huecos_entre_clubes()),
  'regla_sin_club: prueba_abierta.abierta, sin_columna_de_club: prueba_sin_club, tabla_sin_reglas: prueba_sin_reglas, vista_sin_reglas: prueba_vista');
rollback;

-- Una cuenta de Catapult (inventada), para que esa tabla también tenga qué mirar.
insert into public.catapult_cuentas (user_id, usuario, secreto)
values ('00000000-0000-0000-0000-00000000000b', 'beto.catapult', 'cifrado-de-prueba');

-- Los clubes de una cuenta: donde está o estuvo.
create or replace function pruebas.clubes_de(p_user uuid)
returns setof uuid language sql stable as $$
  select m.equipo_id from public.club_miembros m where m.user_id = p_user
$$;

-- Lo que ve cada cuenta: en cada tabla o vista con club, cuántas filas y
-- cuántas de un club donde nunca estuvo; en lo revisado sin columna de club
-- (huecos_entre_clubes), lo mismo con su propia vuelta.
create or replace function pruebas.filas_ajenas()
returns table (cuenta text, tabla text, ve bigint, ajenas bigint)
language plpgsql as $$
declare
  u record;
  t record;
  v_ajenas constant jsonb := jsonb_build_object(
    'equipos', 'q.id not in (select pruebas.clubes_de(%1$L))',
    'v_mis_clubes', 'q.id not in (select pruebas.clubes_de(%1$L))',
    'perfiles', 'q.user_id <> %1$L and not exists (select 1 from public.club_miembros suyo
                   join public.club_miembros mio on mio.equipo_id = suyo.equipo_id
                  where suyo.user_id = q.user_id and mio.user_id = %1$L and mio.rol = ''admin'')',
    'catapult_cuentas', 'q.user_id <> %1$L',
    'gps_en_curso_datos', 'q.en_curso_id not in (select c.id from public.gps_en_curso c where c.equipo_id in (select pruebas.clubes_de(%1$L)))',
    'v_lesiones_excel_v1', 'q.lesao_id not in (select l.id from public.lesiones l where l.equipo_id in (select pruebas.clubes_de(%1$L)))');
begin
  for u in select a.id, a.email as correo from auth.users a order by a.email loop
    for t in select c.relname,
                    exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'equipo_id' and not a.attisdropped) as con_club
               from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
                and has_any_column_privilege('authenticated', c.oid, 'SELECT')
              order by 1 loop
      if not t.con_club and not v_ajenas ? t.relname then
        raise exception 'FALLA: % se lee sin columna de club y no está revisada (huecos_entre_clubes)', t.relname;
      end if;
      perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*), count(*) filter (where %s) from public.%I q',
                     case when t.con_club then format('q.equipo_id is null or q.equipo_id not in (select pruebas.clubes_de(%L))', u.id)
                          else format(v_ajenas ->> t.relname::text, u.id) end,
                     t.relname) into ve, ajenas;
      execute 'reset role';
      cuenta := u.correo;
      tabla := t.relname;
      return next;
    end loop;
  end loop;
end $$;

create temp table aislamiento as select * from pruebas.filas_ajenas();
select pruebas.esperar('Ninguna cuenta ve filas de un club donde nunca estuvo',
  (select coalesce(string_agg(cuenta || ' en ' || tabla || ': ' || ajenas, ', '), '') from aislamiento where ajenas > 0), '');
select pruebas.esperar('...y la prueba mira de verdad: en cada tabla alguna cuenta ve filas (si una nueva no tiene, sumale una en estos escenarios)',
  (select coalesce(string_agg(tabla, ', ' order by tabla), '') from (select tabla from aislamiento group by tabla having max(ve) = 0) x), '');

-- Cambiar o borrar a ciegas (sin leer nada de la fila, así solo cuentan las
-- reglas de cambiar y borrar) filas de un club donde nunca estuvo: primero
-- se apartan las de sus clubes (sin disparadores ni claves, para que no se
-- traben), así lo que toque es ajeno. Cada intento se deshace igual; si tocó
-- alguna fila (o llegó a una y dio error), se anota.
create or replace function pruebas.escrituras_ajenas()
returns table (cuenta text, tabla text, intento text)
language plpgsql as $$
declare
  u record;
  t record;
  v_accion text;
  v_columna text;
  v_filas bigint;
begin
  for u in select a.id, a.email as correo from auth.users a order by a.email loop
    for t in select c.oid, c.relname
               from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind in ('r', 'p')
                and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'equipo_id' and not a.attisdropped)
              order by 2 loop
      v_columna := (select a.attname from pg_attribute a
                     where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
                       and a.attidentity = '' and a.attgenerated = ''
                       and has_column_privilege('authenticated', t.oid, a.attname, 'UPDATE')
                     order by a.attname <> 'equipo_id', a.attnum limit 1);
      foreach v_accion in array array['cambiar', 'borrar'] loop
        continue when v_accion = 'cambiar' and v_columna is null;
        continue when v_accion = 'borrar' and not has_table_privilege('authenticated', t.oid, 'DELETE');
        begin
          set local session_replication_role = replica;
          execute format('delete from public.%I where equipo_id in (select pruebas.clubes_de(%L))', t.relname, u.id);
          perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
          execute 'set local role authenticated';
          if v_accion = 'cambiar' then
            execute format('update public.%I set %I = null', t.relname, v_columna);
          else
            execute format('delete from public.%I', t.relname);
          end if;
          get diagnostics v_filas = row_count;
          raise exception using errcode = 'P0099', message = v_filas::text;
        exception
          when sqlstate 'P0099' then
            intento := case when sqlerrm <> '0' then v_accion || ' ' || sqlerrm || ' filas' end;
          when others then
            intento := v_accion || ': ' || sqlerrm;
        end;
        execute 'reset role';
        if intento is not null then
          cuenta := u.correo;
          tabla := t.relname;
          return next;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

select pruebas.esperar('Ninguna cuenta cambia ni borra filas de un club donde nunca estuvo',
  (select coalesce(string_agg(cuenta || ' en ' || tabla || ' (' || intento || ')', ', '), '') from pruebas.escrituras_ajenas()), '');

-- Las funciones que leen por club, para cada cuenta y cada club donde nunca
-- estuvo: no devuelven nada (o no la dejan, como los pedidos).
create or replace function pruebas.funciones_ajenas()
returns table (cuenta text, funcion text, filas bigint)
language plpgsql as $$
declare
  u record;
  e record;
  v_tabla text;
begin
  for u in select a.id, a.email as correo from auth.users a order by a.email loop
    for e in select q.id from public.equipos q where q.id not in (select pruebas.clubes_de(u.id)) loop
      perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      cuenta := u.correo;
      foreach v_tabla in array array['registros_partido', 'entrenamientos', 'jugadores', 'lesiones', 'evaluaciones',
                                     'evaluaciones_referencias', 'gps'] loop
        funcion := 'datos_al_dia ' || v_tabla;
        filas := (select count(*) from public.datos_al_dia(v_tabla, e.id));
        return next;
      end loop;
      funcion := 'minutos_de_entrenamiento';
      filas := (select count(*) from public.minutos_de_entrenamiento(e.id));
      return next;
      funcion := 'pedidos_del_club';
      filas := case when coalesce(pruebas.error(format('select * from public.pedidos_del_club(%L)', e.id)), '') like '%solo_admin%' then 0 else 1 end;
      return next;
      funcion := 'exportar_atleta';
      filas := (select count(*) from (select j.id from public.jugadores j where j.equipo_id = e.id) j
                 where coalesce(pruebas.error(format('select public.exportar_atleta(%s)', j.id)), '') not like '%solo_admin%');
      return next;
      execute 'reset role';
    end loop;
  end loop;
end $$;

select pruebas.esperar('...ni lo lee con las funciones que leen por club',
  (select coalesce(string_agg(cuenta || ' en ' || funcion || ': ' || filas, ', '), '') from pruebas.funciones_ajenas() where filas > 0), '');

select 'ESCENARIOS: todos bien' as resultado;
