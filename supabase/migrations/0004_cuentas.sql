-- 0004 · Cuentas y movimientos entre cuentas
-- Cada entrada y cada gasto dice con qué se pagó: débito, efectivo o una
-- tarjeta de crédito. Pagar una tarjeta o apartar dinero en una garantía no es
-- un gasto: es una transferencia entre cuentas (no se cuenta doble).
--  · tipo: debito | efectivo | credito | garantia
--  · saldo_inicial: con cuánto arrancó al empezar a llevar la cuenta.
--    En crédito es lo que se debía (positivo = deuda).
--  · dia_corte / dia_pago: solo tarjetas de crédito.

create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 40),
  tipo text not null check (tipo in ('debito','efectivo','credito','garantia')),
  saldo_inicial numeric(12,2) not null default 0,
  dia_corte smallint check (dia_corte between 1 and 31),
  dia_pago smallint check (dia_pago between 1 and 31),
  orden smallint not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  check (tipo = 'credito' or (dia_corte is null and dia_pago is null))
);
create index if not exists cuentas_user_idx on public.cuentas (user_id, orden);

create table if not exists public.transferencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  desde_id uuid not null references public.cuentas on delete restrict,
  hacia_id uuid not null references public.cuentas on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  date date not null default ((now() at time zone 'America/Mexico_City')::date),
  note text check (note is null or length(note) <= 200),
  anulado_at timestamptz,
  check (desde_id <> hacia_id)
);
create index if not exists transferencias_user_idx on public.transferencias (user_id, date);

alter table public.payments add column if not exists cuenta_id uuid references public.cuentas on delete restrict;
alter table public.expenses add column if not exists cuenta_id uuid references public.cuentas on delete restrict;

-- RLS: cada quien solo lo suyo, igual que 0002.
do $$
declare
  t text;
begin
  foreach t in array array['cuentas','transferencias']
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

-- Índices para las llaves foráneas (advisor de rendimiento).
create index if not exists transferencias_desde_idx on public.transferencias (desde_id);
create index if not exists transferencias_hacia_idx on public.transferencias (hacia_id);
create index if not exists payments_cuenta_idx on public.payments (cuenta_id);
create index if not exists expenses_cuenta_idx on public.expenses (cuenta_id);
