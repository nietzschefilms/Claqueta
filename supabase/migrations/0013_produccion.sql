-- 0013 · Producción tipo Movie Magic (por proyecto del Estudio)
--  · presupuesto_lineas: cuentas del presupuesto (cantidad × unidad × veces × tarifa)
--    con lo real gastado para comparar. Montos en pesos con 2 decimales.
--  · proyectos: % de imprevistos, % de utilidad, IVA y precio al cliente (topsheet).
--  · planos: lista de planos por escena con minutos estimados y si ya se filmó.
--  · personas_proyecto: reparto (con número de ID y personaje) y crew, con llamado.
--  · locaciones: dirección, contacto, permisos, estacionamiento y hospital cercano.
-- Nada se borra en duro: todo se archiva.

alter table public.proyectos
  add column if not exists imprevistos_pct numeric(5,2) not null default 10 check (imprevistos_pct between 0 and 100),
  add column if not exists utilidad_pct numeric(5,2) not null default 20 check (utilidad_pct between 0 and 300),
  add column if not exists con_iva boolean not null default true,
  add column if not exists precio_cliente numeric(12,2) check (precio_cliente is null or precio_cliente >= 0);

create table if not exists public.presupuesto_lineas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  cuenta text not null check (cuenta ~ '^[0-9]{3,4}$'),
  descripcion text not null check (length(trim(descripcion)) between 1 and 120),
  cantidad numeric(10,2) not null default 1 check (cantidad >= 0),
  unidad text not null default 'día' check (unidad in ('día','semana','hora','pieza','fijo','km','persona')),
  veces numeric(10,2) not null default 1 check (veces >= 0),
  tarifa numeric(12,2) not null default 0 check (tarifa >= 0),
  real numeric(12,2) check (real is null or real >= 0),
  nota text check (nota is null or length(nota) <= 300),
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists presupuesto_lineas_proyecto_idx on public.presupuesto_lineas (proyecto_id, cuenta, orden);

create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  escena_id uuid not null references public.guion_lineas on delete cascade,
  numero smallint not null default 1,
  tamano text check (tamano is null or tamano in ('GPG','PG','PC','PA','PM','PMC','PP','PPP','PD','INSERT','OTRO')),
  angulo text check (angulo is null or length(angulo) <= 40),
  movimiento text check (movimiento is null or length(movimiento) <= 40),
  lente text check (lente is null or length(lente) <= 20),
  descripcion text not null default '' check (length(descripcion) <= 400),
  minutos smallint not null default 20 check (minutos between 1 and 600),
  filmado boolean not null default false,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists planos_proyecto_idx on public.planos (proyecto_id, escena_id, orden);

create table if not exists public.personas_proyecto (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  tipo text not null check (tipo in ('reparto','crew')),
  nombre text not null check (length(trim(nombre)) between 1 and 80),
  -- Reparto: el personaje tal como sale en el guion. Crew: el puesto.
  rol text not null check (length(trim(rol)) between 1 and 80),
  telefono text check (telefono is null or length(telefono) <= 40),
  correo text check (correo is null or length(correo) <= 120),
  llamado time,
  nota text check (nota is null or length(nota) <= 300),
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists personas_proyecto_idx on public.personas_proyecto (proyecto_id, tipo);

create table if not exists public.locaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  -- Igual que el lugar del encabezado de escena (TAQUERÍA EL GÜERO).
  lugar text not null check (length(trim(lugar)) between 1 and 120),
  direccion text check (direccion is null or length(direccion) <= 200),
  contacto text check (contacto is null or length(contacto) <= 80),
  telefono text check (telefono is null or length(telefono) <= 40),
  permiso text not null default 'pendiente' check (permiso in ('pendiente','solicitado','aprobado','no_necesita')),
  estacionamiento text check (estacionamiento is null or length(estacionamiento) <= 200),
  hospital text check (hospital is null or length(hospital) <= 200),
  notas text check (notas is null or length(notas) <= 600),
  creado_en timestamptz not null default now(),
  archivado_at timestamptz,
  unique (proyecto_id, lugar)
);

do $$
declare
  t text;
begin
  foreach t in array array['presupuesto_lineas','planos','personas_proyecto','locaciones']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke delete on public.%I from authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_leer', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select privado.puedo_proyecto(proyecto_id)))', t || '_leer', t);
    execute format('drop policy if exists %I on public.%I', t || '_crear', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select privado.puedo_proyecto(proyecto_id)))', t || '_crear', t);
    execute format('drop policy if exists %I on public.%I', t || '_editar', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select privado.puedo_proyecto(proyecto_id))) with check ((select privado.puedo_proyecto(proyecto_id)))', t || '_editar', t);
  end loop;
end $$;

-- Una fila no se puede mover a otro proyecto.
create or replace function public.fijar_proyecto()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.proyecto_id := old.proyecto_id;
  return new;
end;
$$;
do $$
declare
  t text;
begin
  foreach t in array array['presupuesto_lineas','planos','personas_proyecto','locaciones','rodaje_escenas','desglose']
  loop
    execute format('drop trigger if exists fijar_proyecto on public.%I', t);
    execute format('create trigger fijar_proyecto before update on public.%I for each row execute function public.fijar_proyecto()', t);
  end loop;
end $$;
