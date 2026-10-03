-- =====================================================================
-- Una recaída durante la recuperación se puede cargar (pedido de Santiago
-- del 03/10, para importar el Excel: los casos 16 y 17 son del mismo
-- jugador, parte y lado, y el 17 empieza antes del alta del 16; el Excel lo
-- cuenta como recurrencia y recidiva).
--
--   · Sale la regla lesiones_sin_solapar (la misma parte del cuerpo y lado
--     del mismo jugador no podía estar lesionada dos veces a la vez).
--   · Entra lesiones_sin_repetir: lo que no se puede es cargar dos veces la
--     misma lesión (mismo jugador, parte del cuerpo, lado y fecha de inicio).
--
-- Se corre en Supabase > SQL Editor, entero y de una vez. Se puede volver a
-- correr.
-- =====================================================================

begin;

-- Si ya hubiera dos lesiones iguales (una con alta el mismo día que empezó
-- no chocaba con la regla vieja), se avisa cuáles antes de tocar nada.
do $$
declare
  repetidas integer;
begin
  select count(*) into repetidas
    from (select 1
            from public.lesiones
           -- Las de personas fuera de Datos básicos y las sin fecha (20261010)
           -- no cuentan acá: tienen su propia regla.
           where jugador_id is not null and fecha_lesion is not null
           group by jugador_id, datos->>'parte_cuerpo', datos->>'lado', fecha_lesion
          having count(*) > 1) as dobles;
  if repetidas > 0 then
    raise exception 'Hay % lesiones cargadas dos veces (mismo jugador, parte, lado y fecha de inicio). Borrá las repetidas y volvé a correr esto.', repetidas;
  end if;
end;
$$;

alter table public.lesiones drop constraint if exists lesiones_sin_solapar;

create unique index if not exists lesiones_sin_repetir
  on public.lesiones (jugador_id, (datos->>'parte_cuerpo'), (datos->>'lado'), fecha_lesion);

comment on index public.lesiones_sin_repetir is
  'La misma lesión no se carga dos veces: mismo jugador, parte del cuerpo, lado y fecha de inicio. Una recaída durante la recuperación sí se puede cargar.';

commit;
