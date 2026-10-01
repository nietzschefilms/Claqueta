-- 0015 · Recordatorios programados
-- Avisos push en una fecha y hora exactas, ligados (o no) a una tarea. El cron
-- de rutina (cada minuto) manda los que ya tocan y marca enviado_at. Si la
-- tarea ya está hecha o quitada, el recordatorio se da por cumplido sin avisar.

create table if not exists public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  tarea_id uuid references public.tasks on delete cascade,
  cuando timestamptz not null,
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  cuerpo text check (cuerpo is null or length(cuerpo) <= 300),
  enviado_at timestamptz,
  entregas smallint,
  creado_en timestamptz not null default now()
);
create index if not exists recordatorios_pendientes_idx on public.recordatorios (cuando) where enviado_at is null;
create index if not exists recordatorios_tarea_idx on public.recordatorios (tarea_id);

alter table public.recordatorios enable row level security;
revoke all on public.recordatorios from anon;
drop policy if exists recordatorios_propio on public.recordatorios;
create policy recordatorios_propio on public.recordatorios for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
