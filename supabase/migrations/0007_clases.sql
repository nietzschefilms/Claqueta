-- 0007 · Datos de clase en la rutina
-- Un bloque fijo puede ser una clase: materia (label), salón, piso, maestro y clave.
alter table public.routine_blocks
  add column if not exists salon text check (salon is null or length(trim(salon)) between 1 and 60),
  add column if not exists piso text check (piso is null or length(trim(piso)) between 1 and 20),
  add column if not exists profesor text check (profesor is null or length(trim(profesor)) between 1 and 80),
  add column if not exists clave text check (clave is null or length(trim(clave)) between 1 and 20);
