-- 0011 · Claqueta para dos
--  · Frente nuevo "justsend" (banda) y frentes por persona (perfiles.frentes).
--  · Equipos: gente que comparte un frente (Nietzsche Studios). Las tareas con
--    equipo_id las ven y editan todos los del equipo; el dinero sigue siendo
--    de cada quien (esas tablas no cambian).
--  · Invitaciones: soporte prepara frentes, equipo, horario y bienvenida de
--    alguien; al crear su cuenta desde /app/soporte se aplica sola.

-- ─── Frente nuevo en los checks ──────────────────────────────────────────
do $$
declare
  frentes text := $f$array['ek','escuela','topmart','rt','nietzsche','personal','justsend']::text[]$f$;
begin
  alter table public.milestones drop constraint if exists milestones_project_check;
  execute format('alter table public.milestones add constraint milestones_project_check check (project = any (%s))', frentes);
  alter table public.tasks drop constraint if exists tasks_area_check;
  execute format('alter table public.tasks add constraint tasks_area_check check (area = any (%s))', frentes);
  alter table public.routine_blocks drop constraint if exists routine_blocks_areas_check;
  execute format('alter table public.routine_blocks add constraint routine_blocks_areas_check check (areas <@ %s)', frentes);
  alter table public.payments drop constraint if exists payments_area_check;
  execute format('alter table public.payments add constraint payments_area_check check (area is null or area = any (%s))', frentes);
  alter table public.income_rules drop constraint if exists income_rules_area_check;
  execute format('alter table public.income_rules add constraint income_rules_area_check check (area is null or area = any (%s))', frentes);
  alter table public.contracts drop constraint if exists contracts_area_check;
  execute format('alter table public.contracts add constraint contracts_area_check check (area is null or area = any (%s))', frentes);
end $$;

-- ─── Perfil: frentes, régimen y bienvenida ───────────────────────────────
alter table public.perfiles
  add column if not exists frentes text[] not null default array['escuela','nietzsche','personal']::text[]
    check (frentes <@ array['ek','escuela','topmart','rt','nietzsche','personal','justsend']::text[] and cardinality(frentes) between 1 and 7),
  -- Fecha de alta en RESICO (Constancia de Situación Fiscal). Null = sin régimen: no se calculan impuestos.
  add column if not exists resico_desde date,
  add column if not exists bienvenida_vista boolean not null default false;

grant update (bienvenida_vista) on public.perfiles to authenticated;

-- ─── Equipos ─────────────────────────────────────────────────────────────
create table if not exists public.equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  frente text not null check (frente in ('ek','escuela','topmart','rt','nietzsche','personal','justsend')),
  creado_en timestamptz not null default now()
);

create table if not exists public.equipo_miembros (
  equipo_id uuid not null references public.equipos on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (equipo_id, user_id)
);
create index if not exists equipo_miembros_user_idx on public.equipo_miembros (user_id);

-- Permisos (esquema privado: las políticas las usan, la API no las expone).
create or replace function privado.mis_equipos()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.equipo_id from public.equipo_miembros m
  join public.perfiles p on p.id = m.user_id
  where m.user_id = auth.uid() and p.activo;
$$;

create or replace function privado.en_equipo(p_equipo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privado.mis_equipos() e where e = p_equipo);
$$;

-- ¿p_user es del equipo p_equipo? (para asignar tareas solo a compañeros).
create or replace function privado.es_miembro(p_equipo uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.equipo_miembros m join public.perfiles p on p.id = m.user_id
    where m.equipo_id = p_equipo and m.user_id = p_user and p.activo
  );
$$;

revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

alter table public.equipos enable row level security;
alter table public.equipo_miembros enable row level security;
revoke all on public.equipos, public.equipo_miembros from anon;
revoke insert, update, delete on public.equipos, public.equipo_miembros from authenticated;

drop policy if exists equipos_leer on public.equipos;
create policy equipos_leer on public.equipos for select to authenticated
  using (id in (select privado.mis_equipos()));

drop policy if exists equipo_miembros_leer on public.equipo_miembros;
create policy equipo_miembros_leer on public.equipo_miembros for select to authenticated
  using (equipo_id in (select privado.mis_equipos()));

-- Nombres de mis compañeros (sin exponer teléfono, correo ni preferencias).
create or replace function public.companeros()
returns table (id uuid, nombre text, equipo_id uuid)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(p.nombre, 'Compañero'), m.equipo_id
  from public.equipo_miembros m join public.perfiles p on p.id = m.user_id
  where m.equipo_id in (select privado.mis_equipos()) and p.activo;
$$;
revoke execute on function public.companeros() from public, anon;
grant execute on function public.companeros() to authenticated;

-- ─── Tareas compartidas ──────────────────────────────────────────────────
alter table public.tasks
  add column if not exists equipo_id uuid references public.equipos on delete set null,
  add column if not exists asignada_a uuid references auth.users on delete set null;
create index if not exists tasks_equipo_idx on public.tasks (equipo_id) where equipo_id is not null;

drop policy if exists tasks_propio on public.tasks;
drop policy if exists tasks_leer on public.tasks;
drop policy if exists tasks_crear on public.tasks;
drop policy if exists tasks_editar on public.tasks;
drop policy if exists tasks_borrar on public.tasks;

create policy tasks_leer on public.tasks for select to authenticated
  using (user_id = (select auth.uid()) or (equipo_id is not null and (select privado.en_equipo(equipo_id))));

create policy tasks_crear on public.tasks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (equipo_id is null or (select privado.en_equipo(equipo_id)))
    and (asignada_a is null or asignada_a = (select auth.uid())
         or (equipo_id is not null and (select privado.es_miembro(equipo_id, asignada_a))))
  );

create policy tasks_editar on public.tasks for update to authenticated
  using (user_id = (select auth.uid()) or (equipo_id is not null and (select privado.en_equipo(equipo_id))))
  with check (
    (user_id = (select auth.uid()) or (equipo_id is not null and (select privado.en_equipo(equipo_id))))
    and (asignada_a is null or asignada_a = (select auth.uid())
         or (equipo_id is not null and (select privado.es_miembro(equipo_id, asignada_a))))
  );

create policy tasks_borrar on public.tasks for delete to authenticated
  using (user_id = (select auth.uid()));

-- Quien creó la tarea sigue siendo su dueño aunque la edite un compañero.
create or replace function public.tasks_fijar_dueno()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;
drop trigger if exists tasks_fijar_dueno on public.tasks;
create trigger tasks_fijar_dueno before update on public.tasks
  for each row execute function public.tasks_fijar_dueno();

-- ─── Invitaciones ────────────────────────────────────────────────────────
create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique check (correo = lower(trim(correo)) and correo like '%@%'),
  nombre text,
  frentes text[] check (frentes <@ array['ek','escuela','topmart','rt','nietzsche','personal','justsend']::text[]),
  equipo_id uuid references public.equipos on delete set null,
  -- [{weekday, start_time, end_time, label, salon, piso, profesor, clave}]
  clases jsonb not null default '[]'::jsonb,
  -- [{weekday, start_time, end_time, label, kind, areas}]
  rutina jsonb not null default '[]'::jsonb,
  mensaje text,
  aplicada_en timestamptz,
  creado_en timestamptz not null default now()
);

alter table public.invitaciones enable row level security;
revoke all on public.invitaciones from anon;
drop policy if exists invitaciones_admin on public.invitaciones;
create policy invitaciones_admin on public.invitaciones for all to authenticated
  using ((select privado.soy_admin())) with check ((select privado.soy_admin()));

create or replace function public.aplicar_invitacion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v public.invitaciones;
begin
  select * into v from public.invitaciones
  where correo = lower(trim(new.correo)) and aplicada_en is null;
  if not found then
    return new;
  end if;

  if v.frentes is not null then
    update public.perfiles set frentes = v.frentes where id = new.id;
  end if;
  if v.equipo_id is not null then
    insert into public.equipo_miembros (equipo_id, user_id) values (v.equipo_id, new.id) on conflict do nothing;
  end if;

  insert into public.routine_blocks (user_id, weekday, start_time, end_time, label, kind, areas, salon, piso, profesor, clave)
  select new.id, c.weekday, c.start_time, c.end_time, c.label, 'fixed', '{}', c.salon, c.piso, c.profesor, c.clave
  from jsonb_to_recordset(v.clases) as c (weekday smallint, start_time time, end_time time, label text, salon text, piso text, profesor text, clave text);

  insert into public.routine_blocks (user_id, weekday, start_time, end_time, label, kind, areas)
  select new.id, r.weekday, r.start_time, r.end_time, r.label, coalesce(r.kind, 'focus'), coalesce(r.areas, '{}')
  from jsonb_to_recordset(v.rutina) as r (weekday smallint, start_time time, end_time time, label text, kind text, areas text[]);

  if v.mensaje is not null then
    insert into public.notificaciones (usuario_id, titulo, cuerpo, href, categoria)
    values (new.id, 'Bienvenido al set', v.mensaje, '/app', 'novedades');
  end if;

  update public.invitaciones set aplicada_en = now() where id = v.id;
  return new;
end;
$$;
revoke execute on function public.aplicar_invitacion() from public, anon, authenticated;

drop trigger if exists al_crear_perfil_invitacion on public.perfiles;
create trigger al_crear_perfil_invitacion after insert on public.perfiles
  for each row execute function public.aplicar_invitacion();
