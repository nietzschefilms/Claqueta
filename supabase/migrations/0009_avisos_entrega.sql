-- 0009 · Registro de entrega de avisos: a cuántos dispositivos llegó y, si falló, por qué.
alter table public.avisos_enviados
  add column if not exists entregas smallint,
  add column if not exists error text;
