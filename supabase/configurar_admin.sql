-- 1. Entrá una vez a la app con tu correo para que Supabase cree la cuenta.
-- 2. Reemplazá el valor siguiente y ejecutá este archivo en Supabase > SQL Editor.
-- Este correo se usa sólo durante la ejecución: no lo guardes en GitHub.

do $$
declare
  correo_admin constant text := 'REEMPLAZAR_CON_TU_CORREO';
  id_admin uuid;
begin
  if correo_admin = 'REEMPLAZAR_CON_TU_CORREO' then
    raise exception 'Reemplazá REEMPLAZAR_CON_TU_CORREO antes de ejecutar.';
  end if;

  select id
  into id_admin
  from auth.users
  where lower(email) = lower(correo_admin)
  limit 1;

  if id_admin is null then
    raise exception 'No existe una cuenta para %. Iniciá sesión una vez y reintentá.', correo_admin;
  end if;

  insert into public.app_admins (user_id)
  values (id_admin)
  on conflict (user_id) do nothing;

  -- Los registros históricos no tienen propietario. Se asignan a la cuenta
  -- administradora sólo cuando no hay duplicados que violen el índice por cuenta.
  if exists (
    select 1
    from public.registros_partido
    where owner_id is null
    group by fecha, lower(trim(rival))
    having count(*) > 1
  ) then
    raise notice 'Administrador configurado. No se asignaron registros históricos porque hay fecha/rival duplicados.';
  else
    update public.registros_partido
    set owner_id = id_admin
    where owner_id is null;
  end if;
end $$;

select
  users.email as administrador,
  count(registros.id) as registros_propios
from public.app_admins as admins
join auth.users as users on users.id = admins.user_id
left join public.registros_partido as registros on registros.owner_id = admins.user_id
group by users.email;
