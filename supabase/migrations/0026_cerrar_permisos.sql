-- 0026 · Cerrar permisos que la auditoría encontró abiertos
--  · CRM de HQ (clientes, notas, cotizaciones, oportunidades y ventas): solo
--    admin. Antes cualquier miembro del equipo podía leerlas y editarlas por
--    la API. Claqueta no las usa; HQ entra como admin o con service role.
--    Si HQ vuelve a correr sql/crm.sql, revisar que no reabra estas políticas.
--  · proyectos: editar o archivar un proyecto es de dirección (productor,
--    director, asistente) o de quien lo creó; antes cualquiera del equipo.
--  · tasks y eventos: cada quien edita lo suyo (o lo que le asignaron); admin
--    y dirección del proyecto pueden todo.
--  · proyecto-docs: los archivos "solo dirección" solo los baja dirección.
--  · anon sin permisos en tablas privadas (RLS ya lo bloqueaba).

do $$
declare
  t text;
begin
  foreach t in array array['clientes','cotizaciones','oportunidades','ventas_actividades','ventas_ajustes','ventas_metas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_equipo', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select privado.soy_admin()) and (select privado.en_equipo(equipo_id)))
         with check ((select privado.soy_admin()) and (select privado.en_equipo(equipo_id)))',
      t || '_equipo', t);
  end loop;
end $$;

drop policy if exists cliente_notas_equipo on public.cliente_notas;
create policy cliente_notas_equipo on public.cliente_notas for all to authenticated
  using ((select privado.soy_admin()) and cliente_id in (select c.id from public.clientes c where (select privado.en_equipo(c.equipo_id))))
  with check ((select privado.soy_admin()) and cliente_id in (select c.id from public.clientes c where (select privado.en_equipo(c.equipo_id))));

drop policy if exists proyectos_editar on public.proyectos;
create policy proyectos_editar on public.proyectos for update to authenticated
  using ((select privado.puedo_guion(id)) or creado_por = (select auth.uid()))
  with check ((select privado.en_equipo(equipo_id)) and ((select privado.puedo_guion(id)) or creado_por = (select auth.uid())));

drop policy if exists tasks_editar on public.tasks;
create policy tasks_editar on public.tasks for update to authenticated
  using (
    user_id = (select auth.uid()) or asignada_a = (select auth.uid())
    or ((select privado.soy_admin()) and equipo_id is not null and (select privado.en_equipo(equipo_id)))
  )
  with check (
    ((user_id = (select auth.uid())) or asignada_a = (select auth.uid())
      or ((equipo_id is not null) and (select privado.en_equipo(equipo_id)) and (select privado.soy_admin())))
    and ((asignada_a is null) or (asignada_a = (select auth.uid()))
      or ((equipo_id is not null) and (select privado.es_miembro(equipo_id, asignada_a))))
  );

drop policy if exists eventos_editar on public.eventos;
create policy eventos_editar on public.eventos for update to authenticated
  using (
    (select privado.en_equipo(equipo_id)) and (
      creado_por = (select auth.uid()) or (select privado.soy_admin())
      or (proyecto_id is not null and (select privado.puedo_guion(proyecto_id)))
    )
  )
  with check (
    (select privado.en_equipo(equipo_id)) and (
      creado_por = (select auth.uid()) or (select privado.soy_admin())
      or (proyecto_id is not null and (select privado.puedo_guion(proyecto_id)))
    )
  );

drop policy if exists proyecto_docs_leer on storage.objects;
create policy proyecto_docs_leer on storage.objects for select to authenticated
  using (
    bucket_id = 'proyecto-docs' and (select privado.puedo_carpeta(name))
    and not exists (
      select 1 from public.proyecto_documentos d
      where d.ruta = objects.name and d.solo_direccion and not privado.puedo_guion(d.proyecto_id)
    )
  );

-- La política de calendario_eventos reevaluaba auth.uid() por fila.
drop policy if exists "calendario: lo mío" on public.calendario_eventos;
create policy "calendario: lo mío" on public.calendario_eventos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.clientes, public.cliente_notas, public.cotizaciones, public.oportunidades,
  public.ventas_actividades, public.ventas_ajustes, public.ventas_metas, public.notificaciones,
  public.perfiles, public.push_suscripciones, public.calendario_eventos, public.facturas from anon;
