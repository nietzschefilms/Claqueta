-- ═══════════════════════════════════════════════════════════════════════════
-- 0001b · Ya aplicada en Supabase (claqueta). Se copia aquí para que el repo
-- coincida con la base. Mueve las funciones de permiso al esquema "privado".
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.tocar_actualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

revoke execute on function public.crear_perfil_nuevo() from public, anon, authenticated;

create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated, service_role;

create or replace function privado.mi_rol()
returns text language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = auth.uid() and activo;
$$;

create or replace function privado.soy_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.es_admin from public.perfiles p join public.roles r on r.clave = p.rol
    where p.id = auth.uid() and p.activo
  ), false);
$$;

create or replace function privado.tengo_rol(p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select rol = any (p_roles) from public.perfiles where id = auth.uid() and activo), false);
$$;

revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select privado.soy_admin()));

drop function if exists public.mi_rol();
drop function if exists public.soy_admin();
drop function if exists public.tengo_rol(text[]);
