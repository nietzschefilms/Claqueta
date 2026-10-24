-- 0027 · Floor plan por escena
--  · floor_plans: el plano de planta (vista desde arriba) de cada escena:
--    personajes, cámaras con su toma, luces, muebles, paredes, puertas y
--    flechas de movimiento. Uno por escena, guardado como JSON (elementos).
--  · Lo ve todo el equipo del proyecto; lo arman dirección y fotografía
--    (los mismos puestos que editan planos, 0017).
--  · La app valida la forma de cada elemento (src/lib/claqueta/floorplan.ts);
--    aquí se cuida que sea una lista, de máximo 200 elementos y de tamaño sano.
-- Nada se borra en duro: no hay delete para authenticated.

create table if not exists public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  escena_id uuid not null references public.guion_lineas on delete cascade,
  elementos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(elementos) = 'array' and jsonb_array_length(elementos) <= 200 and pg_column_size(elementos) <= 262144),
  actualizado_por uuid default auth.uid() references auth.users on delete set null,
  actualizado_en timestamptz not null default now(),
  unique (proyecto_id, escena_id)
);
create index if not exists floor_plans_proyecto_idx on public.floor_plans (proyecto_id);

alter table public.floor_plans enable row level security;
revoke all on public.floor_plans from anon;
revoke delete on public.floor_plans from authenticated;

-- La escena tiene que ser un encabezado de escena de ese mismo proyecto.
create or replace function privado.escena_del_proyecto(p_escena uuid, p_proyecto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guion_lineas g
    where g.id = p_escena and g.proyecto_id = p_proyecto and g.tipo = 'escena'
  );
$$;
revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

drop policy if exists floor_plans_leer on public.floor_plans;
create policy floor_plans_leer on public.floor_plans for select to authenticated
  using ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists floor_plans_crear on public.floor_plans;
create policy floor_plans_crear on public.floor_plans for insert to authenticated
  with check (
    (select privado.tengo_puesto(proyecto_id, array['productor','director','asistente_direccion','fotografia']))
    and (select privado.escena_del_proyecto(escena_id, proyecto_id))
  );
drop policy if exists floor_plans_editar on public.floor_plans;
create policy floor_plans_editar on public.floor_plans for update to authenticated
  using ((select privado.tengo_puesto(proyecto_id, array['productor','director','asistente_direccion','fotografia'])))
  with check (
    (select privado.tengo_puesto(proyecto_id, array['productor','director','asistente_direccion','fotografia']))
    and (select privado.escena_del_proyecto(escena_id, proyecto_id))
  );

-- Una fila no se puede mover a otro proyecto (misma regla que planos, 0013).
drop trigger if exists fijar_proyecto on public.floor_plans;
create trigger fijar_proyecto before update on public.floor_plans
  for each row execute function public.fijar_proyecto();
