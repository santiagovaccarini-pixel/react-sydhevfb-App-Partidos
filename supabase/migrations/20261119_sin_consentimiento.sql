-- =====================================================================
-- Sin el consentimiento de los atletas (Santiago, 23/10: «saques lo del
-- consentimiento de los jugadores, no lo vamos a usar»; en un
-- cuestionario: «Todo», lo ya guardado «Se borran» y «Ahora»). Deshace
-- 20261103_consentimiento.sql:
--
--   · Salen los disparadores que frenaban las cargas sin la confirmación
--     del club o de una persona fuera de Datos básicos (exigir_consentimiento
--     en jugadores, lesiones, evaluaciones, gps y gps_en_curso): se carga
--     como antes de 20261103.
--   · Se borra la tabla de las confirmaciones (consentimientos), con todo lo
--     que tenía, y sus funciones. No se puede deshacer.
--
-- Lo demás no cambia (permisos, Anon nada). 20261104_exportar_atleta.sql
-- pedía esa tabla para correr: ya está corrida y no hace falta volver a
-- correrla. Se corre en Supabase > SQL Editor, entera y de una vez. Se puede
-- volver a correr.
-- =====================================================================

begin;

drop trigger if exists exigir_consentimiento on public.jugadores;
drop trigger if exists exigir_consentimiento on public.lesiones;
drop trigger if exists exigir_consentimiento on public.evaluaciones;
drop trigger if exists exigir_consentimiento on public.gps;
drop trigger if exists exigir_consentimiento on public.gps_en_curso;

drop function if exists public.exigir_consentimiento();
drop function if exists public.persona_con_consentimiento(uuid, text);
drop function if exists public.club_con_consentimiento(uuid);

drop table if exists public.consentimientos;
drop function if exists public.consentimientos_preparar();
drop function if exists public.persona_normalizada(text);

-- Antes de guardar, que haya quedado bien.
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'exigir_consentimiento' and not tgisinternal) then
    raise exception 'Quedó algún disparador del consentimiento.';
  end if;
  if to_regclass('public.consentimientos') is not null then
    raise exception 'Quedó la tabla consentimientos.';
  end if;
  if exists (select 1 from public.huecos_entre_clubes()) then
    raise exception 'Quedaron huecos entre clubes: select * from public.huecos_entre_clubes();';
  end if;
end $$;

commit;

-- Que la app deje de ver la tabla sin esperar.
notify pgrst, 'reload schema';

-- Para ver que quedó bien: ningún disparador ni la tabla.
select count(*) as disparadores_del_consentimiento
  from pg_trigger
 where tgname = 'exigir_consentimiento' and not tgisinternal;
select to_regclass('public.consentimientos') as tabla_consentimientos;
