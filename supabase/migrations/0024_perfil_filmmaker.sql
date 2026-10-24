-- 0024 · Perfil filmmaker
--  · perfiles: color, foto (bucket público "avatares", ruta aleatoria), frase,
--    Instagram, sitio, reel/portafolio, Spotify y Letterboxd.
--  · El equipo ve el perfil de sus compañeros con perfil_publico() y
--    directorio_equipo() (sin teléfono, correo ni nada de dinero).
alter table public.perfiles
  add column if not exists color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists avatar text check (avatar is null or avatar ~ '^[0-9a-f-]{36}/[0-9]{1,16}\.(jpg|png|webp)$'),
  add column if not exists bio text check (bio is null or length(bio) <= 160),
  add column if not exists instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column if not exists sitio text check (sitio is null or (sitio ~ '^https://' and length(sitio) <= 200)),
  add column if not exists reel text check (reel is null or (reel ~ '^https://' and length(reel) <= 200)),
  add column if not exists spotify text check (spotify is null or spotify ~ '^https://open\.spotify\.com/'),
  add column if not exists letterboxd text check (letterboxd is null or letterboxd ~ '^[A-Za-z0-9_]{1,30}$');
grant update (color, avatar, bio, instagram, sitio, reel, spotify, letterboxd) on public.perfiles to authenticated;

create or replace function public.directorio_equipo()
returns table (id uuid, nombre text, color text, avatar text, bio text, puestos text[])
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(p.nombre, 'Sin nombre'), p.color, p.avatar, p.bio,
    array(select distinct m.puesto from public.proyecto_miembros m join public.proyectos pr on pr.id = m.proyecto_id
          where m.user_id = p.id and m.archivado_at is null and pr.visibilidad = 'equipo' and pr.archivado_at is null)
  from public.perfiles p
  where p.activo and (p.id = auth.uid() or p.id in (
    select m.user_id from public.equipo_miembros m where m.equipo_id in (select privado.mis_equipos())
  ))
  order by p.nombre;
$$;
revoke execute on function public.directorio_equipo() from public, anon;
grant execute on function public.directorio_equipo() to authenticated;

create or replace function public.perfil_publico(p_id uuid)
returns table (id uuid, nombre text, color text, avatar text, bio text, instagram text, sitio text, reel text, spotify text, letterboxd text)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(p.nombre, 'Sin nombre'), p.color, p.avatar, p.bio, p.instagram, p.sitio, p.reel, p.spotify, p.letterboxd
  from public.perfiles p
  where p.id = p_id and p.activo and (p.id = auth.uid() or p.id in (
    select m.user_id from public.equipo_miembros m where m.equipo_id in (select privado.mis_equipos())
  ));
$$;
revoke execute on function public.perfil_publico(uuid) from public, anon;
grant execute on function public.perfil_publico(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Cada quien sube solo a su carpeta ({user_id}/...).
drop policy if exists avatares_subir on storage.objects;
create policy avatares_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and split_part(name, '/', 1) = (select auth.uid())::text);
