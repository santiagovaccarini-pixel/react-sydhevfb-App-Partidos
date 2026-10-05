-- Vuelta atrás de 20260930_partido_solo_autorizados.sql: deja las tablas de
-- Partido como estaban antes (abiertas para anon y authenticated). Solo si
-- algo de Partido dejó de funcionar y hay que salir del paso; después se
-- vuelve a correr la migración.

begin;

-- Freno (05/10): con las cuentas v2 (clubes, 20261004) esto abriría o
-- mezclaría los partidos de todos los clubes. Ya no se corre: el Excel entra
-- con la cuenta de la app (excel/SupabaseSesion.bas).
do $$
begin
  if to_regprocedure('public.puede_usar_en(uuid, text)') is not null then
    raise exception 'Ya están las cuentas por club (20261004): este SQL abriría los partidos de todos los clubes. No hace falta: el Excel entra con la cuenta de la app (excel/SupabaseSesion.bas).';
  end if;
end $$;

grant select, insert, update, delete
  on table public.equipos, public.registros_partido, public.jugadores, public.ajustes
  to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

do $$
declare
  politica record;
begin
  for politica in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('equipos', 'registros_partido', 'jugadores', 'ajustes')
  loop
    execute format('drop policy if exists %I on %I.%I', politica.policyname, politica.schemaname, politica.tablename);
  end loop;
end $$;

create policy equipos_acceso_app on public.equipos
  for all to anon, authenticated using (true) with check (true);
create policy registros_acceso_app on public.registros_partido
  for all to anon, authenticated using (true) with check (true);
create policy jugadores_acceso_app on public.jugadores
  for all to anon, authenticated using (true) with check (true);
create policy ajustes_acceso_app on public.ajustes
  for all to anon, authenticated using (true) with check (true);

commit;
