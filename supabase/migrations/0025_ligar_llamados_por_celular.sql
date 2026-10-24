-- 0025 · Al nacer una cuenta por celular, sus llamados (crew call) que ya
-- existían con ese teléfono se ligan solos a la persona: así le llega todo y
-- puede confirmar desde su app.
create or replace function public.ligar_llamados_por_celular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_cel text := regexp_replace(split_part(coalesce(new.correo, ''), '@', 1), '^52(?=\d{10}$)', '');
begin
  if coalesce(new.correo, '') like '%@cel.nietzschefilms.com' and v_cel ~ '^\d{10}$' then
    update public.personas_proyecto
       set user_id = new.id
     where user_id is null
       and archivado_at is null
       and regexp_replace(coalesce(telefono, ''), '\D', '', 'g') in (v_cel, '52' || v_cel);
  end if;
  return new;
end;
$$;
revoke execute on function public.ligar_llamados_por_celular() from public, anon, authenticated;

drop trigger if exists al_crear_perfil_ligar_llamados on public.perfiles;
create trigger al_crear_perfil_ligar_llamados after insert on public.perfiles
  for each row execute function public.ligar_llamados_por_celular();
