-- 0012 · Estudio (lo que comparte el equipo Nietzsche)
--  · eventos: agenda compartida (juntas, rodajes, scouting). Salen en Hoy y
--    Semana de cada participante (vacío = todo el equipo).
--  · ocupado_equipo(): horas ocupadas de cada compañero (clases, bloques,
--    fijos) para encontrar huecos en común. No expone nombres de materias.
--  · prospectos: el Radar de spots, con estado y responsable compartidos.
--  · proyectos + guion_lineas: guion en vivo (una fila por elemento: escena,
--    acción, personaje, diálogo…). Orden fraccionario para insertar en medio.
--  · rodaje_escenas: qué escena se filma qué día. desglose: elementos por escena.
-- Nada se borra en duro: eventos se cancelan, líneas y proyectos se archivan.

-- ─── Permiso por proyecto ────────────────────────────────────────────────
-- (se crea después de la tabla proyectos)

-- ─── Agenda compartida ───────────────────────────────────────────────────
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos on delete cascade,
  creado_por uuid default auth.uid() references auth.users on delete set null,
  titulo text not null check (length(trim(titulo)) between 1 and 100),
  tipo text not null default 'junta' check (tipo in ('junta','rodaje','scouting','llamada','entrega','ensayo','otro')),
  fecha date not null,
  inicio time not null,
  fin time not null,
  lugar text check (lugar is null or length(lugar) <= 120),
  notas text check (notas is null or length(notas) <= 1000),
  -- Vacío = todo el equipo.
  participantes uuid[] not null default '{}',
  proyecto_id uuid,
  cancelado_at timestamptz,
  creado_en timestamptz not null default now(),
  check (fin > inicio)
);
create index if not exists eventos_equipo_fecha_idx on public.eventos (equipo_id, fecha);

-- ─── Radar ───────────────────────────────────────────────────────────────
create table if not exists public.prospectos (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos on delete cascade,
  clave text not null check (clave ~ '^[a-z0-9-]{1,60}$'),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  zona text check (zona is null or length(zona) <= 120),
  giro text check (giro is null or length(giro) <= 160),
  apertura text check (apertura is null or length(apertura) <= 30),
  senal text check (senal is null or length(senal) <= 2000),
  video text check (video is null or length(video) <= 2000),
  angulo text check (angulo is null or length(angulo) <= 2000),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,40}$'),
  email text check (email is null or length(email) <= 120),
  telefono text check (telefono is null or length(telefono) <= 40),
  whatsapp text check (whatsapp is null or length(whatsapp) <= 40),
  direccion text check (direccion is null or length(direccion) <= 200),
  contacto text check (contacto is null or length(contacto) <= 600),
  fuentes jsonb not null default '[]'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','contactado','respondio','reunion','cotizado','cerrado','descartado')),
  responsable uuid references auth.users on delete set null,
  siguiente_paso text check (siguiente_paso is null or length(siguiente_paso) <= 200),
  siguiente_fecha date,
  notas text check (notas is null or length(notas) <= 2000),
  ticket numeric(12,2) check (ticket is null or ticket >= 0),
  actualizado_por uuid references auth.users on delete set null,
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  unique (equipo_id, clave)
);

-- ─── Proyectos y guion ───────────────────────────────────────────────────
create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 100),
  tipo text not null default 'spot' check (tipo in ('spot','corto','videoclip','documental','serie','otro')),
  cliente text check (cliente is null or length(cliente) <= 100),
  prospecto_id uuid references public.prospectos on delete set null,
  estado text not null default 'preproduccion' check (estado in ('idea','preproduccion','rodaje','post','entregado')),
  logline text check (logline is null or length(logline) <= 400),
  duracion_seg integer check (duracion_seg is null or duracion_seg between 1 and 36000),
  creado_por uuid default auth.uid() references auth.users on delete set null,
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists proyectos_equipo_idx on public.proyectos (equipo_id);

alter table public.eventos drop constraint if exists eventos_proyecto_fk;
alter table public.eventos add constraint eventos_proyecto_fk foreign key (proyecto_id) references public.proyectos on delete set null;

create table if not exists public.guion_lineas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  orden double precision not null,
  tipo text not null default 'accion' check (tipo in ('escena','accion','personaje','parentesis','dialogo','transicion','nota')),
  texto text not null default '' check (length(texto) <= 4000),
  editado_por uuid default auth.uid() references auth.users on delete set null,
  actualizado_en timestamptz not null default now(),
  borrado_at timestamptz
);
create index if not exists guion_lineas_proyecto_idx on public.guion_lineas (proyecto_id, orden);

create table if not exists public.rodaje_escenas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  escena_id uuid not null references public.guion_lineas on delete cascade,
  dia date,
  orden smallint not null default 0,
  llamado time,
  unique (escena_id)
);
create index if not exists rodaje_escenas_proyecto_idx on public.rodaje_escenas (proyecto_id);

create table if not exists public.desglose (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  escena_id uuid references public.guion_lineas on delete cascade,
  categoria text not null check (categoria in ('reparto','extras','utileria','vestuario','maquillaje','arte','vehiculos','efectos','sonido','camara','locacion','otro')),
  elemento text not null check (length(trim(elemento)) between 1 and 120),
  nota text check (nota is null or length(nota) <= 300),
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists desglose_proyecto_idx on public.desglose (proyecto_id);

-- ─── Permisos ────────────────────────────────────────────────────────────
create or replace function privado.puedo_proyecto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.proyectos p
    where p.id = p_proyecto and p.equipo_id in (select privado.mis_equipos())
  );
$$;
revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array['eventos','prospectos','proyectos','guion_lineas','rodaje_escenas','desglose']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete on public.%I from authenticated', t);
  end loop;
end $$;

-- Tablas del equipo (tienen equipo_id).
drop policy if exists eventos_equipo on public.eventos;
create policy eventos_equipo on public.eventos for select to authenticated
  using ((select privado.en_equipo(equipo_id)));
drop policy if exists eventos_crear on public.eventos;
create policy eventos_crear on public.eventos for insert to authenticated
  with check ((select privado.en_equipo(equipo_id)) and creado_por = (select auth.uid()));
drop policy if exists eventos_editar on public.eventos;
create policy eventos_editar on public.eventos for update to authenticated
  using ((select privado.en_equipo(equipo_id))) with check ((select privado.en_equipo(equipo_id)));

drop policy if exists prospectos_equipo on public.prospectos;
create policy prospectos_equipo on public.prospectos for select to authenticated
  using ((select privado.en_equipo(equipo_id)));
drop policy if exists prospectos_crear on public.prospectos;
create policy prospectos_crear on public.prospectos for insert to authenticated
  with check ((select privado.en_equipo(equipo_id)));
drop policy if exists prospectos_editar on public.prospectos;
create policy prospectos_editar on public.prospectos for update to authenticated
  using ((select privado.en_equipo(equipo_id))) with check ((select privado.en_equipo(equipo_id)));

drop policy if exists proyectos_equipo on public.proyectos;
create policy proyectos_equipo on public.proyectos for select to authenticated
  using ((select privado.en_equipo(equipo_id)));
drop policy if exists proyectos_crear on public.proyectos;
create policy proyectos_crear on public.proyectos for insert to authenticated
  with check ((select privado.en_equipo(equipo_id)) and creado_por = (select auth.uid()));
drop policy if exists proyectos_editar on public.proyectos;
create policy proyectos_editar on public.proyectos for update to authenticated
  using ((select privado.en_equipo(equipo_id))) with check ((select privado.en_equipo(equipo_id)));

-- Tablas de un proyecto (tienen proyecto_id).
do $$
declare
  t text;
begin
  foreach t in array array['guion_lineas','rodaje_escenas','desglose']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_leer', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select privado.puedo_proyecto(proyecto_id)))', t || '_leer', t);
    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select privado.puedo_proyecto(proyecto_id)))', t || '_crear', t);
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select privado.puedo_proyecto(proyecto_id))) with check ((select privado.puedo_proyecto(proyecto_id)))', t || '_editar', t);
  end loop;
end $$;

-- Una línea no se puede mover a otro proyecto, y queda firmada por quien la tocó.
create or replace function public.guion_lineas_tocar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.proyecto_id := old.proyecto_id;
  new.editado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;
drop trigger if exists guion_lineas_tocar on public.guion_lineas;
create trigger guion_lineas_tocar before update on public.guion_lineas
  for each row execute function public.guion_lineas_tocar();

create or replace function public.prospectos_tocar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.equipo_id := old.equipo_id;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;
drop trigger if exists prospectos_tocar on public.prospectos;
create trigger prospectos_tocar before update on public.prospectos
  for each row execute function public.prospectos_tocar();

-- ─── Horas ocupadas del equipo (para encontrar huecos) ───────────────────
-- Máximo 14 días. Solo dice el tipo (clase, fijo, bloque), no la materia.
create or replace function public.ocupado_equipo(p_equipo uuid, p_desde date, p_hasta date)
returns table (user_id uuid, fecha date, inicio time, fin time, tipo text)
language sql stable security definer set search_path = '' as $$
  with dias as (
    select d::date as fecha
    from generate_series(p_desde, least(p_hasta, p_desde + 13), interval '1 day') d
  )
  select rb.user_id, dias.fecha, rb.start_time, rb.end_time,
         case when rb.salon is not null then 'clase' when rb.kind = 'fixed' then 'fijo' else 'bloque' end
  from public.routine_blocks rb
  join public.equipo_miembros m on m.user_id = rb.user_id and m.equipo_id = p_equipo
  join dias on extract(dow from dias.fecha)::int = rb.weekday
  where (select privado.en_equipo(p_equipo));
$$;
revoke execute on function public.ocupado_equipo(uuid, date, date) from public, anon;
grant execute on function public.ocupado_equipo(uuid, date, date) to authenticated;

-- ─── Tiempo real ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['guion_lineas','prospectos','eventos','tasks']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
