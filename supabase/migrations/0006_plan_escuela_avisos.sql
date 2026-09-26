-- 0006 · Gastos fijos, límite de crédito, tareas de escuela y avisos de rutina

-- ─── Gastos fijos (suscripciones) ─────────────────────────────────────────
-- Lo que se cobra solo cada mes (Claude, Meli+). En dólares se guarda el monto
-- en USD y un aproximado en pesos para planear; al confirmar el cargo se anota
-- el monto real en pesos.
create table if not exists public.gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  categoria text not null default 'Suscripciones' check (length(trim(categoria)) between 1 and 60),
  moneda text not null default 'MXN' check (moneda in ('MXN','USD')),
  monto numeric(12,2) not null check (monto > 0),
  monto_mxn numeric(12,2) not null check (monto_mxn > 0),
  dia smallint check (dia between 1 and 31),
  cuenta_id uuid references public.cuentas on delete set null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index if not exists gastos_fijos_user_idx on public.gastos_fijos (user_id);
create index if not exists gastos_fijos_cuenta_idx on public.gastos_fijos (cuenta_id);

-- Liga el gasto con el cargo fijo del mes que confirma ("<id>:2026-10").
alter table public.expenses add column if not exists fijo_key text;
create unique index if not exists expenses_fijo_unico on public.expenses (user_id, fijo_key)
  where fijo_key is not null and anulado_at is null;

-- ─── Límite de crédito ────────────────────────────────────────────────────
-- Fijo (limite) o ligado a una garantía: saldo de la garantía + limite_extra.
alter table public.cuentas
  add column if not exists limite numeric(12,2) check (limite is null or limite >= 0),
  add column if not exists garantia_id uuid references public.cuentas on delete set null,
  add column if not exists limite_extra numeric(12,2) not null default 0 check (limite_extra >= 0);
create index if not exists cuentas_garantia_idx on public.cuentas (garantia_id);

-- ─── Tareas de escuela ────────────────────────────────────────────────────
-- dificultad: 1 fácil, 2 media, 3 difícil. Define el tiempo estimado y
-- adelanta la urgencia (lo difícil se empieza antes).
alter table public.tasks
  add column if not exists materia text check (materia is null or length(trim(materia)) between 1 and 60),
  add column if not exists dificultad smallint check (dificultad is null or dificultad between 1 and 3);

-- ─── Avisos de rutina ─────────────────────────────────────────────────────
-- Registro para no mandar dos veces el mismo aviso (el cron corre cada minuto).
create table if not exists public.avisos_enviados (
  user_id uuid not null references auth.users on delete cascade,
  clave text not null,
  creado_en timestamptz not null default now(),
  primary key (user_id, clave)
);

-- RLS en las tablas nuevas: cada quien solo lo suyo.
do $$
declare
  t text;
begin
  foreach t in array array['gastos_fijos','avisos_enviados']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_propio', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_propio', t
    );
  end loop;
end $$;

-- ─── Cron cada minuto: avisos de rutina ───────────────────────────────────
-- Llama a /api/cron/rutina con el secreto del Vault (cron_secret).
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule('claqueta-rutina') where exists (select 1 from cron.job where jobname = 'claqueta-rutina');
select cron.schedule('claqueta-rutina', '* * * * *', $$
  select net.http_post(
    url := 'https://app.nietzschefilms.com/api/cron/rutina',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- Limpieza diaria del registro de avisos (se quedan 3 días).
select cron.unschedule('claqueta-limpiar-avisos') where exists (select 1 from cron.job where jobname = 'claqueta-limpiar-avisos');
select cron.schedule('claqueta-limpiar-avisos', '15 9 * * *', $$
  delete from public.avisos_enviados where creado_en < now() - interval '3 days';
$$);
