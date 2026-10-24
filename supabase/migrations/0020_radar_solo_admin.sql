-- 0020 · El Radar (prospectos) es del dueño: el equipo ya no lo ve ni lo toca.
drop policy if exists prospectos_equipo on public.prospectos;
create policy prospectos_equipo on public.prospectos for select to authenticated
  using ((select privado.soy_admin()) and (select privado.en_equipo(equipo_id)));
drop policy if exists prospectos_crear on public.prospectos;
create policy prospectos_crear on public.prospectos for insert to authenticated
  with check ((select privado.soy_admin()) and (select privado.en_equipo(equipo_id)));
drop policy if exists prospectos_editar on public.prospectos;
create policy prospectos_editar on public.prospectos for update to authenticated
  using ((select privado.soy_admin()) and (select privado.en_equipo(equipo_id)))
  with check ((select privado.soy_admin()) and (select privado.en_equipo(equipo_id)));
