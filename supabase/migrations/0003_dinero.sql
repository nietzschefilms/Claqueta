-- 0003 · Dinero
-- Complementa las tablas de 0002 para el módulo de Dinero:
--  · payments.contract_id: liga cada pago del cliente con su contrato (EK Bars, 100 mil).
--  · payments.area: de qué frente vino el dinero (para el color y el resumen).
--  · income_rules.desde: los ingresos esperados cuentan a partir de esta fecha,
--    así no aparecen cobros "atrasados" de antes de empezar a llevar la cuenta.
--  · anulado_at: nada se borra en duro. Un pago o gasto mal capturado se anula.
-- RLS ya cubre estas tablas (política *_propio de 0002).

alter table public.payments
  add column if not exists contract_id uuid references public.contracts on delete set null,
  add column if not exists area text
    check (area is null or area in ('ek','escuela','topmart','rt','nietzsche','personal')),
  add column if not exists anulado_at timestamptz;

alter table public.expenses
  add column if not exists anulado_at timestamptz;

alter table public.income_rules
  add column if not exists area text
    check (area is null or area in ('ek','escuela','topmart','rt','nietzsche','personal')),
  add column if not exists desde date not null default ((now() at time zone 'America/Mexico_City')::date),
  add column if not exists activo boolean not null default true;

alter table public.contracts
  add column if not exists area text
    check (area is null or area in ('ek','escuela','topmart','rt','nietzsche','personal'));

create index if not exists payments_contrato_idx on public.payments (contract_id) where contract_id is not null;

-- Un esperado solo se confirma una vez, pero si se anula se puede volver a confirmar.
drop index if exists public.payments_expected_unico;
create unique index if not exists payments_expected_unico on public.payments (user_id, expected_key)
  where expected_key is not null and anulado_at is null;
