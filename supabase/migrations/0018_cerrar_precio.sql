-- 0018 · Precio, utilidad e imprevistos: solo el productor
-- Se aplica DESPUÉS de publicar el código que lee esas columnas con
-- proyecto_dinero() (0017). Antes de eso, la página del proyecto tronaría.
revoke select on public.proyectos from authenticated;
grant select (id, equipo_id, nombre, tipo, cliente, prospecto_id, estado, logline, duracion_seg, creado_por, creado_en, archivado_at) on public.proyectos to authenticated;
