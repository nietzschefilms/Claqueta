-- ═══════════════════════════════════════════════════════════════════════════
-- NIETZSCHE BASE · Migración 0001
-- Cuentas, roles, perfiles, notificaciones y push. Lo que TODA app del
-- estudio necesita. Lo específico de cada cliente va en 0002 en adelante.
--
-- Diferencia clave con Rompiendo Tabúes:
--   · Los roles viven en una TABLA (no en listas de correos en el código).
--   · Hay políticas RLS reales: aunque el front lea con la llave anon, cada
--     quien solo ve lo suyo. El service role (servidor) sigue saltando RLS.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── ROLES ────────────────────────────────────────────────────────────────
-- Catálogo de roles del proyecto. Cada cliente agrega los suyos en su propia
-- migración (ej. insert into roles values ('coach','Coach',false)).
create table if not exists public.roles (
  clave text primary key,
  nombre text not null,
  es_admin boolean not null default false
);

insert into public.roles (clave, nombre, es_admin) values
  ('admin', 'Administrador', true),
  ('miembro', 'Miembro', false)
on conflict (clave) do nothing;

-- ─── PERFILES ─────────────────────────────────────────────────────────────
-- Una fila por cuenta de auth. Se crea sola con el trigger de abajo.
create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  rol text not null default 'miembro' references public.roles (clave) on update cascade,
  nombre text,
  correo text,
  telefono text,
  avatar_url text,
  -- Soporte / IT: puede crear cuentas y resetear accesos (página /app/soporte).
  es_soporte boolean not null default false,
  -- Baja lógica. Nunca se borra en duro a una persona con historial.
  activo boolean not null default true,
  -- Preferencias de notificaciones por categoría: {"novedades": false}
  notif_prefs jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists perfiles_rol_idx on public.perfiles (rol);

-- Mantiene actualizado_en al día.
create or replace function public.tocar_actualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists perfiles_tocar on public.perfiles;
create trigger perfiles_tocar before update on public.perfiles
  for each row execute function public.tocar_actualizado();

-- Crea el perfil al nacer la cuenta. El rol llega en user_metadata.rol (lo
-- pone el servidor al crear la cuenta); si no llega o no existe, "miembro".
create or replace function public.crear_perfil_nuevo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol text := coalesce(new.raw_user_meta_data ->> 'rol', 'miembro');
begin
  if not exists (select 1 from public.roles where clave = v_rol) then
    v_rol := 'miembro';
  end if;
  insert into public.perfiles (id, rol, nombre, correo)
  values (new.id, v_rol, new.raw_user_meta_data ->> 'nombre', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Solo la usa el trigger; nadie debe poder llamarla por la API.
revoke execute on function public.crear_perfil_nuevo() from public, anon, authenticated;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil_nuevo();

-- ─── FUNCIONES DE PERMISO (para usar en las políticas RLS) ──────────────────
-- Viven en el esquema "privado", que la API de Supabase NO expone: las
-- políticas las usan, pero nadie las puede llamar por /rest/v1/rpc.
-- security definer + search_path fijo: leen perfiles sin chocar con RLS.
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

-- ─── RLS: roles y perfiles ────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.perfiles enable row level security;

drop policy if exists roles_leer on public.roles;
create policy roles_leer on public.roles for select to authenticated using (true);

-- Cada quien lee su perfil; los admins leen todos.
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select privado.soy_admin()));

-- Cada quien edita SOLO datos básicos de su perfil. Rol, soporte y activo no
-- se pueden tocar desde el navegador (lo hace el servidor con service role).
drop policy if exists perfiles_editar_propio on public.perfiles;
create policy perfiles_editar_propio on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.perfiles from authenticated;
grant update (nombre, telefono, avatar_url, notif_prefs) on public.perfiles to authenticated;

-- ─── NOTIFICACIONES (bandeja dentro de la app) ────────────────────────────
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users on delete cascade,
  titulo text not null,
  cuerpo text,
  href text,
  categoria text not null default 'operativo',
  leido boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists notificaciones_usuario_idx
  on public.notificaciones (usuario_id, leido, creado_en desc);

alter table public.notificaciones enable row level security;

drop policy if exists notif_leer on public.notificaciones;
create policy notif_leer on public.notificaciones for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists notif_marcar on public.notificaciones;
create policy notif_marcar on public.notificaciones for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

revoke update on public.notificaciones from authenticated;
grant update (leido) on public.notificaciones to authenticated;
-- Insertar solo lo hace el servidor (service role).

-- ─── PUSH (una suscripción por dispositivo) ───────────────────────────────
create table if not exists public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  agente text,
  creado_en timestamptz not null default now()
);

create index if not exists push_suscripciones_user_idx on public.push_suscripciones (user_id);

alter table public.push_suscripciones enable row level security;

drop policy if exists push_propias on public.push_suscripciones;
create policy push_propias on public.push_suscripciones for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─── CRONS ────────────────────────────────────────────────────────────────
-- Valida el token de un cron contra el secreto guardado en el Vault de
-- Supabase (nombre: cron_secret). Así los crons pueden vivir en pg_cron sin
-- depender de Vercel Pro. Guarda el secreto con:
--   select vault.create_secret('<mismo valor que CRON_SECRET>', 'cron_secret');
create or replace function public.cron_token_valido(p_token text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_token
  );
$$;
revoke execute on function public.cron_token_valido(text) from public, anon, authenticated;
grant execute on function public.cron_token_valido(text) to service_role;

-- Supabase crea public.rls_auto_enable() cuando el proyecto nace con "RLS
-- automático". Es un event trigger: sigue funcionando, pero nadie debe poder
-- llamarlo por la API.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
