-- 0023 · Tipo de proyecto y lineamientos de tarea
--  · proyectos.categoria: estudiantil, comercial, distribucion o personal.
--  · proyecto_lineamientos: los lineamientos de una tarea, uno por renglón.
--    regla dice cómo se revisa solo contra el shotlist (o 'manual').
alter table public.proyectos
  add column if not exists categoria text check (categoria is null or categoria in ('estudiantil','comercial','distribucion','personal'));
grant select (categoria) on public.proyectos to authenticated;

update public.proyectos set categoria = 'estudiantil' where id = '7ee1318f-175b-4538-9c7b-b7fb854196ed' and nombre = 'El Robo';

create table if not exists public.proyecto_lineamientos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  texto text not null check (length(trim(texto)) between 1 and 400),
  regla text not null default 'manual' check (regla in ('manual','max_planos','movimientos','incluye_pov','incluye_insert','incluye_over')),
  valor jsonb,
  cumplido boolean not null default false,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  archivado_at timestamptz
);
create index if not exists proyecto_lineamientos_idx on public.proyecto_lineamientos (proyecto_id, orden);

alter table public.proyecto_lineamientos enable row level security;
revoke all on public.proyecto_lineamientos from anon;
revoke delete on public.proyecto_lineamientos from authenticated;
drop trigger if exists fijar_proyecto on public.proyecto_lineamientos;
create trigger fijar_proyecto before update on public.proyecto_lineamientos for each row execute function public.fijar_proyecto();

drop policy if exists proyecto_lineamientos_leer on public.proyecto_lineamientos;
create policy proyecto_lineamientos_leer on public.proyecto_lineamientos for select to authenticated
  using ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists proyecto_lineamientos_crear on public.proyecto_lineamientos;
create policy proyecto_lineamientos_crear on public.proyecto_lineamientos for insert to authenticated
  with check ((select privado.puedo_guion(proyecto_id)));
drop policy if exists proyecto_lineamientos_editar on public.proyecto_lineamientos;
create policy proyecto_lineamientos_editar on public.proyecto_lineamientos for update to authenticated
  using ((select privado.puedo_guion(proyecto_id))) with check ((select privado.puedo_guion(proyecto_id)));
