-- 0019 · Publicar al equipo, puestos desde la invitación y documentos subidos
--  · invitaciones.puestos: [{proyecto_id, puesto}]. Al crear la cuenta, la
--    persona queda con su puesto en esos proyectos (además de equipo y horario).
--  · proyecto_publicaciones: dirección trabaja en borrador y con un botón
--    publica una versión para todo el equipo (guion, shotlist, llamados).
--    Cada publicación es una foto fija; nunca se edita ni se borra.
--  · proyecto_documentos: ahora también archivos subidos (PDF del guion, etc.)
--    en el bucket privado "proyecto-docs" ({proyecto_id}/{archivo}).

-- ─── Puestos desde la invitación ─────────────────────────────────────────
alter table public.invitaciones
  add column if not exists puestos jsonb not null default '[]'::jsonb;

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

  -- Puesto en cada proyecto (solo proyectos del equipo de la invitación).
  insert into public.proyecto_miembros (proyecto_id, user_id, puesto)
  select p.proyecto_id, new.id, p.puesto
  from jsonb_to_recordset(v.puestos) as p (proyecto_id uuid, puesto text)
  join public.proyectos pr on pr.id = p.proyecto_id and pr.equipo_id = v.equipo_id
  on conflict (proyecto_id, user_id, puesto) do nothing;

  if v.mensaje is not null then
    insert into public.notificaciones (usuario_id, titulo, cuerpo, href, categoria)
    values (new.id, 'Bienvenido al set', v.mensaje, '/app', 'novedades');
  end if;

  update public.invitaciones set aplicada_en = now() where id = v.id;
  return new;
end;
$$;
revoke execute on function public.aplicar_invitacion() from public, anon, authenticated;

-- ─── Publicaciones al equipo ─────────────────────────────────────────────
create table if not exists public.proyecto_publicaciones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos on delete cascade,
  tipo text not null check (tipo in ('guion','shotlist','llamados')),
  version integer not null check (version >= 1),
  contenido jsonb not null,
  nota text check (nota is null or length(nota) <= 300),
  publicado_por uuid default auth.uid() references auth.users on delete set null,
  creado_en timestamptz not null default now(),
  unique (proyecto_id, tipo, version)
);
create index if not exists proyecto_publicaciones_idx on public.proyecto_publicaciones (proyecto_id, tipo, version desc);

alter table public.proyecto_publicaciones enable row level security;
revoke all on public.proyecto_publicaciones from anon;
revoke update, delete on public.proyecto_publicaciones from authenticated;

drop policy if exists proyecto_publicaciones_leer on public.proyecto_publicaciones;
create policy proyecto_publicaciones_leer on public.proyecto_publicaciones for select to authenticated
  using ((select privado.puedo_proyecto(proyecto_id)));
drop policy if exists proyecto_publicaciones_crear on public.proyecto_publicaciones;
create policy proyecto_publicaciones_crear on public.proyecto_publicaciones for insert to authenticated
  with check (
    publicado_por = (select auth.uid())
    and case tipo
      when 'shotlist' then (select privado.tengo_puesto(proyecto_id, array['productor','director','asistente_direccion','fotografia']))
      else (select privado.puedo_guion(proyecto_id))
    end
  );

-- ─── Documentos subidos ──────────────────────────────────────────────────
alter table public.proyecto_documentos
  add column if not exists ruta text check (ruta is null or ruta ~ '^[0-9a-f-]{36}/[0-9]{1,16}-[A-Za-z0-9._-]{1,120}$'),
  add column if not exists tipo_archivo text check (tipo_archivo is null or length(tipo_archivo) <= 80);
alter table public.proyecto_documentos alter column url drop not null;
alter table public.proyecto_documentos drop constraint if exists proyecto_documentos_url_check;
alter table public.proyecto_documentos add constraint proyecto_documentos_url_check
  check ((url is null or (url ~ '^https://' and length(url) <= 600)) and (url is not null or ruta is not null));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proyecto-docs', 'proyecto-docs', false, 26214400,
        array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = 26214400,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

drop policy if exists proyecto_docs_leer on storage.objects;
create policy proyecto_docs_leer on storage.objects for select to authenticated
  using (bucket_id = 'proyecto-docs' and (select privado.puedo_carpeta(name)));
drop policy if exists proyecto_docs_subir on storage.objects;
create policy proyecto_docs_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'proyecto-docs' and (select privado.puedo_carpeta(name)));
