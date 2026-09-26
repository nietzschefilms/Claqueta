-- 0010 · Diagnóstico de push: el dispositivo reporta cada aviso que le llega
-- y si lo pudo mostrar. Así se distingue "Apple no lo entregó" de "llegó pero no se vio".
create table if not exists public.avisos_recibidos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  titulo text check (titulo is null or length(titulo) <= 200),
  tag text check (tag is null or length(tag) <= 80),
  error text check (error is null or length(error) <= 300),
  agente text check (agente is null or length(agente) <= 200),
  recibido_en timestamptz not null default now()
);
create index if not exists avisos_recibidos_user_idx on public.avisos_recibidos (user_id, recibido_en desc);
alter table public.avisos_recibidos enable row level security;
revoke all on public.avisos_recibidos from anon;
drop policy if exists avisos_recibidos_propio on public.avisos_recibidos;
create policy avisos_recibidos_propio on public.avisos_recibidos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
