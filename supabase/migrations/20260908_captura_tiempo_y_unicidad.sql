-- Ejecutar una sola vez en Supabase > SQL Editor antes de publicar esta versión.
-- Conserva el modo de captura y evita duplicar un partido por doble guardado.

alter table public.registros_partido
  add column if not exists modo_tiempo text not null default 'enVivo',
  add column if not exists captura_tiempo jsonb not null default '{}'::jsonb;

comment on column public.registros_partido.modo_tiempo is
  'Modo original de carga: enVivo o transmision.';
comment on column public.registros_partido.captura_tiempo is
  'Borrador completo de referencias, períodos y eventos para poder continuar la carga.';

-- La app evita duplicados de forma lógica. El índice sólo se crea cuando los datos
-- existentes están limpios; nunca borra registros de manera automática.
do $$
begin
  if not exists (
    select 1
    from public.registros_partido
    group by fecha, lower(trim(rival))
    having count(*) > 1
  ) then
    create unique index if not exists registros_partido_fecha_rival_unicos
      on public.registros_partido (fecha, lower(trim(rival)));
  else
    raise notice 'No se creó el índice único: hay partidos duplicados para revisar.';
  end if;
end $$;
