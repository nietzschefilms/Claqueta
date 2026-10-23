-- 0017 · Equipo por proyecto (estilo StudioBinder)
--  · proyecto_miembros: puesto de cada persona EN CADA proyecto (alguien dirige
--    uno y fotografía otro). Puede tener varios puestos en el mismo proyecto.
--  · Permisos por puesto:
--      guion completo y editar guion/desglose/plan: productor, director, asistente de dirección
--      planos (shotlist): lo anterior + fotografía
--      gente, locaciones, plan minuto a minuto, reporte: productor, director, asistente de dirección
--      presupuesto y precio: solo productor
--    El admin (Jamez) siempre puede todo. El resto del equipo ve encabezados de
--    escena, planos, storyboard, llamados, avance, documentos y el plan del día.
--  · proyecto_avance: lo que falta y lo que ya está (guion listo, locación lista,
--    faltan actrices), con responsable y fecha (la línea del tiempo).
--  · plan_dia: plan minuto a minuto del día de rodaje, con hora real de inicio y fin.
--  · proyecto_documentos: links (Drive, PDF, referencias). Pueden ser solo para dirección.
--  · personas_proyecto: fecha de llamado, cuenta ligada y confirmación (crew y casting).
--  · solicitudes_acceso: "olvidé mi contraseña" avisa a soporte en vez de mandar correo.
-- Nada se borra en duro: todo se archiva.

-- ─── Puestos ─────────────────────────────────────────────────────────────
create table if not exists public.proyecto_miembros (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  puesto text not null check (puesto in ('productor','director','asistente_direccion','fotografia','asistente_camara','sonido','arte','vestuario','maquillaje','edicion','produccion','otro')),
  creado_por uuid default auth.uid() references auth.users on delete set null,
  creado_en timestamptz not null default now(),
  archivado_at timestamptz,
  unique (proyecto_id, user_id, puesto)
);
create index if not exists proyecto_miembros_user_idx on public.proyecto_miembros (user_id) where archivado_at is null;

create or replace function privado.tengo_puesto(p_proyecto uuid, p_puestos text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.puedo_proyecto(p_proyecto) and (
    privado.soy_admin()
    or exists (
      select 1 from public.proyecto_miembros m
      where m.proyecto_id = p_proyecto and m.user_id = auth.uid()
        and m.archivado_at is null and m.puesto = any (p_puestos)
    )
  );
$$;

create or replace function privado.puedo_guion(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.tengo_puesto(p_proyecto, array['productor','director','asistente_direccion']);
$$;

create or replace function privado.puedo_dinero(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.tengo_puesto(p_proyecto, array['productor']);
$$;

revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

alter table public.proyecto_miembros enable row level security;
revoke all on public.proyecto_miembros from anon;
revoke delete on public.proyecto_miembros from authenticated;
drop policy if exists proyecto_miembros_leer on public.proyecto_miembros;
create policy proyecto_miembros_leer on public.proyecto_miembros for select to authenticated
  using ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists proyecto_miembros_crear on public.proyecto_miembros;
create policy proyecto_miembros_crear on public.proyecto_miembros for insert to authenticated
  with check (
    ((select privado.puedo_dinero(proyecto_id))
     -- Quien crea el proyecto se pone de productor.
     or (puesto = 'productor' and user_id = (select auth.uid())
         and exists (select 1 from public.proyectos p where p.id = proyecto_id and p.creado_por = (select auth.uid()))))
    and (select privado.puedo_proyecto(proyecto_id))
  );
drop policy if exists proyecto_miembros_editar on public.proyecto_miembros;
create policy proyecto_miembros_editar on public.proyecto_miembros for update to authenticated
  using ((select privado.puedo_dinero(proyecto_id))) with check ((select privado.puedo_dinero(proyecto_id)));

-- ─── Permisos más finos en lo que ya existía ─────────────────────────────
-- Guion: el resto del equipo solo ve los encabezados de escena (para planos y llamados).
drop policy if exists guion_lineas_leer on public.guion_lineas;
create policy guion_lineas_leer on public.guion_lineas for select to authenticated
  using ((select privado.puedo_guion(proyecto_id)) or (tipo = 'escena' and (select privado.puedo_proyecto(proyecto_id))));
drop policy if exists guion_lineas_crear on public.guion_lineas;
create policy guion_lineas_crear on public.guion_lineas for insert to authenticated
  with check ((select privado.puedo_guion(proyecto_id)));
drop policy if exists guion_lineas_editar on public.guion_lineas;
create policy guion_lineas_editar on public.guion_lineas for update to authenticated
  using ((select privado.puedo_guion(proyecto_id))) with check ((select privado.puedo_guion(proyecto_id)));

-- Todos leen; editan dirección y producción.
do $$
declare
  t text;
begin
  foreach t in array array['desglose','rodaje_escenas','personas_proyecto','locaciones','reportes_rodaje']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select privado.puedo_guion(proyecto_id)))', t || '_crear', t);
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select privado.puedo_guion(proyecto_id))) with check ((select privado.puedo_guion(proyecto_id)))', t || '_editar', t);
  end loop;
end $$;

-- Planos: también fotografía.
drop policy if exists planos_crear on public.planos;
create policy planos_crear on public.planos for insert to authenticated
  with check ((select privado.tengo_puesto(proyecto_id, array['productor','director','asistente_direccion','fotografia'])));
drop policy if exists planos_editar on public.planos;
create policy planos_editar on public.planos for update to authenticated
  using ((select privado.tengo_puesto(proyecto_id, array['productor','director','asistente_direccion','fotografia'])))
  with check ((select privado.tengo_puesto(proyecto_id, array['productor','director','asistente_direccion','fotografia'])));

-- Presupuesto: solo productor.
drop policy if exists presupuesto_lineas_leer on public.presupuesto_lineas;
create policy presupuesto_lineas_leer on public.presupuesto_lineas for select to authenticated
  using ((select privado.puedo_dinero(proyecto_id)));
drop policy if exists presupuesto_lineas_crear on public.presupuesto_lineas;
create policy presupuesto_lineas_crear on public.presupuesto_lineas for insert to authenticated
  with check ((select privado.puedo_dinero(proyecto_id)));
drop policy if exists presupuesto_lineas_editar on public.presupuesto_lineas;
create policy presupuesto_lineas_editar on public.presupuesto_lineas for update to authenticated
  using ((select privado.puedo_dinero(proyecto_id))) with check ((select privado.puedo_dinero(proyecto_id)));

-- Precio, utilidad e imprevistos del proyecto: se leen con proyecto_dinero().
-- (El candado de columnas va en 0018, que se aplica al publicar el código nuevo.)
create or replace function public.proyecto_dinero(p_proyecto uuid)
returns table (imprevistos_pct numeric, utilidad_pct numeric, con_iva boolean, precio_cliente numeric)
language sql stable security definer set search_path = '' as $$
  select p.imprevistos_pct, p.utilidad_pct, p.con_iva, p.precio_cliente
  from public.proyectos p
  where p.id = p_proyecto and privado.puedo_dinero(p_proyecto);
$$;
revoke execute on function public.proyecto_dinero(uuid) from public, anon;
grant execute on function public.proyecto_dinero(uuid) to authenticated;

create or replace function public.proyectos_cuidar_dinero()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.imprevistos_pct, new.utilidad_pct, new.con_iva, new.precio_cliente)
     is distinct from (old.imprevistos_pct, old.utilidad_pct, old.con_iva, old.precio_cliente)
     and auth.uid() is not null and not privado.puedo_dinero(old.id) then
    raise exception 'Solo el productor cambia el presupuesto.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists proyectos_cuidar_dinero on public.proyectos;
create trigger proyectos_cuidar_dinero before update on public.proyectos
  for each row execute function public.proyectos_cuidar_dinero();

-- ─── Llamados de crew y casting ──────────────────────────────────────────
alter table public.personas_proyecto
  add column if not exists user_id uuid references auth.users on delete set null,
  add column if not exists fecha date,
  -- falta = aún no hay quien (casting abierto); pendiente = se le llamó y no contesta.
  add column if not exists confirmacion text not null default 'pendiente' check (confirmacion in ('falta','pendiente','confirmado','no_puede')),
  add column if not exists confirmado_en timestamptz;

-- La persona ligada confirma su propio llamado (sin poder tocar lo demás).
create or replace function public.confirmar_llamado(p_id uuid, p_valor text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_valor not in ('confirmado','no_puede') then
    raise exception 'Respuesta no válida.' using errcode = '22023';
  end if;
  update public.personas_proyecto
     set confirmacion = p_valor, confirmado_en = now()
   where id = p_id and user_id = auth.uid() and archivado_at is null;
  if not found then
    raise exception 'Ese llamado no es tuyo.' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.confirmar_llamado(uuid, text) from public, anon;
grant execute on function public.confirmar_llamado(uuid, text) to authenticated;

-- ─── Avance (lo que falta y lo que está listo) ───────────────────────────
create table if not exists public.proyecto_avance (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  titulo text not null check (length(trim(titulo)) between 1 and 100),
  estado text not null default 'falta' check (estado in ('falta','en_proceso','listo')),
  responsable uuid references auth.users on delete set null,
  fecha_limite date,
  nota text check (nota is null or length(nota) <= 300),
  orden integer not null default 0,
  actualizado_por uuid default auth.uid() references auth.users on delete set null,
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists proyecto_avance_idx on public.proyecto_avance (proyecto_id, orden);

-- ─── Plan minuto a minuto ────────────────────────────────────────────────
create table if not exists public.plan_dia (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  fecha date not null,
  inicio time not null,
  minutos smallint not null default 15 check (minutos between 1 and 720),
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  tipo text not null default 'toma' check (tipo in ('llamado','montaje','ensayo','toma','comida','traslado','cierre','otro')),
  plano_id uuid references public.planos on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_curso','hecho')),
  empezo_en timestamptz,
  termino_en timestamptz,
  actualizado_por uuid default auth.uid() references auth.users on delete set null,
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists plan_dia_idx on public.plan_dia (proyecto_id, fecha, inicio);

-- ─── Documentos ──────────────────────────────────────────────────────────
create table if not exists public.proyecto_documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  titulo text not null check (length(trim(titulo)) between 1 and 100),
  url text not null check (url ~ '^https://' and length(url) <= 600),
  solo_direccion boolean not null default false,
  creado_por uuid default auth.uid() references auth.users on delete set null,
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists proyecto_documentos_idx on public.proyecto_documentos (proyecto_id);

do $$
declare
  t text;
begin
  foreach t in array array['proyecto_avance','plan_dia','proyecto_documentos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete on public.%I from authenticated', t);
    execute format('drop trigger if exists fijar_proyecto on public.%I', t);
    execute format('create trigger fijar_proyecto before update on public.%I for each row execute function public.fijar_proyecto()', t);
  end loop;
end $$;

-- Avance: todo el equipo lo ve y lo mueve (quien toma algo, lo marca).
drop policy if exists proyecto_avance_leer on public.proyecto_avance;
create policy proyecto_avance_leer on public.proyecto_avance for select to authenticated using ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists proyecto_avance_crear on public.proyecto_avance;
create policy proyecto_avance_crear on public.proyecto_avance for insert to authenticated with check ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists proyecto_avance_editar on public.proyecto_avance;
create policy proyecto_avance_editar on public.proyecto_avance for update to authenticated
  using ((select privado.puedo_proyecto(proyecto_id))) with check ((select privado.puedo_proyecto(proyecto_id)));

-- Plan del día: todos lo ven; lo arma y lo avanza dirección y producción.
drop policy if exists plan_dia_leer on public.plan_dia;
create policy plan_dia_leer on public.plan_dia for select to authenticated using ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists plan_dia_crear on public.plan_dia;
create policy plan_dia_crear on public.plan_dia for insert to authenticated with check ((select privado.puedo_guion(proyecto_id)));
drop policy if exists plan_dia_editar on public.plan_dia;
create policy plan_dia_editar on public.plan_dia for update to authenticated
  using ((select privado.puedo_guion(proyecto_id))) with check ((select privado.puedo_guion(proyecto_id)));

-- Documentos: los de dirección solo los ve dirección.
drop policy if exists proyecto_documentos_leer on public.proyecto_documentos;
create policy proyecto_documentos_leer on public.proyecto_documentos for select to authenticated
  using ((select privado.puedo_proyecto(proyecto_id)) and (not solo_direccion or (select privado.puedo_guion(proyecto_id))));
drop policy if exists proyecto_documentos_crear on public.proyecto_documentos;
create policy proyecto_documentos_crear on public.proyecto_documentos for insert to authenticated
  with check ((select privado.puedo_proyecto(proyecto_id)) and (not solo_direccion or (select privado.puedo_guion(proyecto_id))));
drop policy if exists proyecto_documentos_editar on public.proyecto_documentos;
create policy proyecto_documentos_editar on public.proyecto_documentos for update to authenticated
  using ((select privado.puedo_proyecto(proyecto_id)) and (creado_por = (select auth.uid()) or (select privado.puedo_guion(proyecto_id))))
  with check ((select privado.puedo_proyecto(proyecto_id)) and (not solo_direccion or (select privado.puedo_guion(proyecto_id))));

-- ─── Solicitudes de acceso ───────────────────────────────────────────────
-- Las escribe el servidor (service role) desde /recuperar; las ve soporte.
create table if not exists public.solicitudes_acceso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  creado_en timestamptz not null default now(),
  atendida_en timestamptz
);
create index if not exists solicitudes_acceso_abiertas_idx on public.solicitudes_acceso (creado_en) where atendida_en is null;
alter table public.solicitudes_acceso enable row level security;
revoke all on public.solicitudes_acceso from anon, authenticated;
