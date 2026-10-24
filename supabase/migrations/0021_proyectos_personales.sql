-- 0021 · Proyectos personales
--  · proyectos.visibilidad: 'equipo' (del estudio: lo ve todo el equipo) o
--    'privado' (personal: solo quien lo creó y a quien le dé puesto; ni el admin).
--  · Cualquiera del equipo crea proyectos personales con todas las herramientas
--    (queda de productor). Los del estudio solo los crea el admin.
--  · Las citas de un proyecto personal solo las ven sus miembros.

alter table public.proyectos
  add column if not exists visibilidad text not null default 'equipo' check (visibilidad in ('equipo','privado'));
grant select (visibilidad) on public.proyectos to authenticated;

create or replace function privado.puedo_proyecto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.proyectos p
    where p.id = p_proyecto
      and p.equipo_id in (select privado.mis_equipos())
      and (
        p.visibilidad = 'equipo'
        or p.creado_por = auth.uid()
        or exists (
          select 1 from public.proyecto_miembros m
          where m.proyecto_id = p.id and m.user_id = auth.uid() and m.archivado_at is null
        )
      )
  );
$$;
revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

drop policy if exists proyectos_equipo on public.proyectos;
create policy proyectos_equipo on public.proyectos for select to authenticated
  using ((select privado.puedo_proyecto(id)));
drop policy if exists proyectos_crear on public.proyectos;
create policy proyectos_crear on public.proyectos for insert to authenticated
  with check (
    (select privado.en_equipo(equipo_id))
    and creado_por = (select auth.uid())
    and (visibilidad = 'privado' or (select privado.soy_admin()))
  );
drop policy if exists proyectos_editar on public.proyectos;
create policy proyectos_editar on public.proyectos for update to authenticated
  using ((select privado.puedo_proyecto(id)))
  with check ((select privado.en_equipo(equipo_id)));

-- Solo el admin cambia un proyecto de personal a del estudio (o al revés).
create or replace function public.proyectos_cuidar_visibilidad()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.visibilidad is distinct from old.visibilidad and auth.uid() is not null and not privado.soy_admin() then
    raise exception 'Solo el admin cambia si un proyecto es del estudio o personal.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists proyectos_cuidar_visibilidad on public.proyectos;
create trigger proyectos_cuidar_visibilidad before update on public.proyectos
  for each row execute function public.proyectos_cuidar_visibilidad();

drop policy if exists eventos_equipo on public.eventos;
create policy eventos_equipo on public.eventos for select to authenticated
  using ((select privado.en_equipo(equipo_id)) and (proyecto_id is null or (select privado.puedo_proyecto(proyecto_id))));

-- La lectura revisa la fila directo (así el INSERT ... RETURNING de un
-- proyecto recién creado también pasa).
create or replace function privado.soy_miembro_proyecto(p_proyecto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.proyecto_miembros m
    where m.proyecto_id = p_proyecto and m.user_id = auth.uid() and m.archivado_at is null
  );
$$;
revoke execute on all functions in schema privado from public, anon;
grant execute on all functions in schema privado to authenticated, service_role;

drop policy if exists proyectos_equipo on public.proyectos;
create policy proyectos_equipo on public.proyectos for select to authenticated
  using (
    (select privado.en_equipo(equipo_id))
    and (visibilidad = 'equipo' or creado_por = (select auth.uid()) or (select privado.soy_miembro_proyecto(id)))
  );
