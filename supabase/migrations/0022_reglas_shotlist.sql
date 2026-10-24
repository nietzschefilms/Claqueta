-- 0022 · Reglas del shotlist por proyecto (ejercicios de la escuela)
--  · max_planos: tope de planos/tomas (El Robo: 14). Null = sin tope.
--  · movimientos_permitidos: los únicos movimientos de cámara válidos
--    (El Robo: Fijo, Paneo, Tilt). Null = cualquiera.
alter table public.proyectos
  add column if not exists max_planos smallint check (max_planos is null or max_planos between 1 and 999),
  add column if not exists movimientos_permitidos text[] check (movimientos_permitidos is null or cardinality(movimientos_permitidos) between 1 and 20);
grant select (max_planos, movimientos_permitidos) on public.proyectos to authenticated;

update public.proyectos
set max_planos = 14, movimientos_permitidos = array['Fijo','Paneo','Tilt']
where id = '7ee1318f-175b-4538-9c7b-b7fb854196ed' and nombre = 'El Robo';
