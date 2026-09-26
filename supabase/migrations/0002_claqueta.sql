-- ═══════════════════════════════════════════════════════════════════════════
-- CLAQUETA · Migración 0002
-- Tareas, rutina, hitos de EK Bars y dinero. App de un solo usuario: cada
-- fila es de quien la creó y RLS solo deja tocar lo propio (user_id = auth.uid()).
-- Nada se borra en duro desde la app: las tareas se quitan con archived_at.
-- ═══════════════════════════════════════════════════════════════════════════

-- Frentes válidos (mismos ids que src/lib/frentes.ts).
-- ek · escuela · topmart · rt · nietzsche · personal

-- ─── HITOS (van antes porque tasks los referencia) ────────────────────────
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project text not null default 'ek' check (project in ('ek','escuela','topmart','rt','nietzsche','personal')),
  week smallint not null check (week between 1 and 52),
  title text not null check (length(trim(title)) between 1 and 200),
  done boolean not null default false,
  done_at timestamptz
);
create index if not exists milestones_user_idx on public.milestones (user_id, project, week);

-- ─── TAREAS ───────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  area text not null check (area in ('ek','escuela','topmart','rt','nietzsche','personal')),
  due_date date,
  est_minutes integer not null default 30 check (est_minutes between 5 and 720),
  impact smallint not null default 2 check (impact between 1 and 3),
  status text not null default 'pendiente' check (status in ('pendiente','haciendo','hecho')),
  done_at timestamptz,
  repeat text not null default 'none' check (repeat in ('none','weekly')),
  notes text check (notes is null or length(notes) <= 2000),
  milestone_id uuid references public.milestones on delete set null,
  -- Quitada sin hacerse. No se borra: se esconde.
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks (user_id, status, due_date);
create index if not exists tasks_milestone_idx on public.tasks (milestone_id);

-- ─── RUTINA ───────────────────────────────────────────────────────────────
create table if not exists public.routine_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  label text not null check (length(trim(label)) between 1 and 80),
  kind text not null default 'fixed' check (kind in ('fixed','focus')),
  -- Frentes que llenan el bloque. Vacío en un focus = bloque libre (flex).
  areas text[] not null default '{}'
    check (areas <@ array['ek','escuela','topmart','rt','nietzsche','personal']::text[]),
  check (end_time > start_time)
);
create index if not exists routine_blocks_user_idx on public.routine_blocks (user_id, weekday, start_time);

-- ─── DINERO ───────────────────────────────────────────────────────────────
create table if not exists public.income_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null check (length(trim(source)) between 1 and 80),
  amount numeric(12,2) not null check (amount > 0),
  rule text not null check (rule in ('biweekly_15_30','weekly_friday','one_off')),
  -- Solo para one_off: el día que se espera.
  date date,
  label text,
  check (rule <> 'one_off' or date is not null)
);
create index if not exists income_rules_user_idx on public.income_rules (user_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null check (length(trim(source)) between 1 and 80),
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  -- Liga el pago con el ingreso esperado que confirma (ej. "topmart:2026-10-15").
  expected_key text,
  note text
);
create index if not exists payments_user_idx on public.payments (user_id, date);
-- Un esperado solo se puede confirmar una vez: evita cobrar doble por doble toque.
create unique index if not exists payments_expected_unico on public.payments (user_id, expected_key)
  where expected_key is not null;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  category text not null check (length(trim(category)) between 1 and 60),
  date date not null default ((now() at time zone 'America/Mexico_City')::date),
  note text
);
create index if not exists expenses_user_idx on public.expenses (user_id, date);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category text not null check (length(trim(category)) between 1 and 60),
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  unique (user_id, category)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  client text not null check (length(trim(client)) between 1 and 80),
  total numeric(12,2) not null check (total > 0),
  start_date date not null,
  dev_deadline date,
  pay_deadline date
);
create index if not exists contracts_user_idx on public.contracts (user_id);

-- ─── RLS: cada quien solo lo suyo, en las 4 operaciones ───────────────────
do $$
declare
  t text;
begin
  foreach t in array array['milestones','tasks','routine_blocks','income_rules','payments','expenses','budgets','contracts']
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
