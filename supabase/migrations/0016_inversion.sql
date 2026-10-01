-- 0016 · Inversión Nietzsche
-- Lista de equipo para la productora (precio, prioridad, retorno, si se puede
-- rentar, link) y el fondo que la paga: los abonos de un contrato (EK) menos
-- lo ya gastado, los impuestos estimados y una reserva. Cada quien lo suyo.
-- Nada se borra: un artículo se descarta.

create table if not exists public.inversion_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  categoria text not null check (categoria in ('computadora','lentes','iluminacion','sonido','energia','almacenamiento','grip','filtros','monitoreo','mochilas','accesorios','software','otro')),
  precio numeric(12,2) not null check (precio >= 0),
  cantidad smallint not null default 1 check (cantidad between 1 and 99),
  prioridad smallint not null default 2 check (prioridad between 1 and 4),
  retorno smallint not null default 2 check (retorno between 1 and 3),
  rentable boolean not null default false,
  link text check (link is null or (link ~ '^https?://' and length(link) <= 500)),
  tienda text check (tienda is null or length(tienda) <= 60),
  nota text check (nota is null or length(nota) <= 400),
  estado text not null default 'quiero' check (estado in ('quiero','comprado','descartado')),
  precio_real numeric(12,2) check (precio_real is null or precio_real >= 0),
  comprado_en date,
  gasto_id uuid references public.expenses on delete set null,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);
create index if not exists inversion_items_user_idx on public.inversion_items (user_id, estado, prioridad);

-- De dónde sale el dinero: un contrato, lo que ya se gastó de él, % de reserva
-- y si el cliente paga el IVA aparte (si no, se toma incluido en lo cobrado).
create table if not exists public.inversion_ajustes (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  contrato_id uuid references public.contracts on delete set null,
  ya_gastado numeric(12,2) not null default 0 check (ya_gastado >= 0),
  reserva_pct numeric(5,2) not null default 10 check (reserva_pct between 0 and 100),
  iva_aparte boolean not null default false,
  actualizado_en timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['inversion_items','inversion_ajustes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_propio', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_propio', t);
  end loop;
end $$;
revoke delete on public.inversion_items from authenticated;
