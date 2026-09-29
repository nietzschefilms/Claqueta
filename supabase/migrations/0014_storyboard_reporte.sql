-- 0014 · Storyboard y reporte diario de rodaje
--  · planos.imagen: ruta del cuadro en el bucket privado "storyboard"
--    ({proyecto_id}/{plano_id}-{marca}.jpg). Solo el equipo del proyecto la ve.
--  · planos.tomas / toma_buena / filmado_en: lo que pasó en set.
--  · reportes_rodaje: horas reales del día (llamado, primera toma, comida,
--    fin), clima, incidentes y notas. Uno por proyecto y fecha.

alter table public.planos
  add column if not exists imagen text check (imagen is null or imagen ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-[0-9]{1,16}\.jpg$'),
  add column if not exists tomas smallint not null default 0 check (tomas between 0 and 999),
  add column if not exists toma_buena smallint check (toma_buena is null or toma_buena between 1 and 999),
  add column if not exists filmado_en date;

create table if not exists public.reportes_rodaje (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  fecha date not null,
  llamado time,
  primera_toma time,
  comida_inicio time,
  comida_fin time,
  fin time,
  clima text check (clima is null or length(clima) <= 80),
  incidentes text check (incidentes is null or length(incidentes) <= 2000),
  notas text check (notas is null or length(notas) <= 2000),
  actualizado_por uuid default auth.uid() references auth.users on delete set null,
  actualizado_en timestamptz not null default now(),
  unique (proyecto_id, fecha)
);

alter table public.reportes_rodaje enable row level security;
revoke all on public.reportes_rodaje from anon;
revoke delete on public.reportes_rodaje from authenticated;
drop policy if exists reportes_rodaje_leer on public.reportes_rodaje;
create policy reportes_rodaje_leer on public.reportes_rodaje for select to authenticated using ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists reportes_rodaje_crear on public.reportes_rodaje;
create policy reportes_rodaje_crear on public.reportes_rodaje for insert to authenticated with check ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists reportes_rodaje_editar on public.reportes_rodaje;
create policy reportes_rodaje_editar on public.reportes_rodaje for update to authenticated using ((select privado.puedo_proyecto(proyecto_id))) with check ((select privado.puedo_proyecto(proyecto_id)));
drop trigger if exists fijar_proyecto on public.reportes_rodaje;
create trigger fijar_proyecto before update on public.reportes_rodaje for each row execute function public.fijar_proyecto();

-- ─── Storage: bucket privado del storyboard ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('storyboard', 'storyboard', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

-- La primera carpeta de la ruta es el proyecto: solo su equipo entra.
create or replace function privado.puedo_carpeta(p_nombre text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_carpeta text := split_part(p_nombre, '/', 1);
begin
  if v_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return privado.puedo_proyecto(v_carpeta::uuid);
end;
$$;
revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

drop policy if exists storyboard_leer on storage.objects;
create policy storyboard_leer on storage.objects for select to authenticated
  using (bucket_id = 'storyboard' and (select privado.puedo_carpeta(name)));
drop policy if exists storyboard_subir on storage.objects;
create policy storyboard_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'storyboard' and (select privado.puedo_carpeta(name)));
drop policy if exists storyboard_cambiar on storage.objects;
create policy storyboard_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'storyboard' and (select privado.puedo_carpeta(name)))
  with check (bucket_id = 'storyboard' and (select privado.puedo_carpeta(name)));
