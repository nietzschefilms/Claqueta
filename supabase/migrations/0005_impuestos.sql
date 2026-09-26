-- 0005 · Impuestos (RESICO persona física)
--  · gravable: la entrada es de tu actividad (trabajo, clientes) y cuenta para
--    el ISR. Lo que te dan tus papás o un regalo no es gravable.
--  · factura: se emitió CFDI. Con factura se guarda el desglose:
--    subtotal (antes de IVA), IVA trasladado y lo que retuvo el cliente
--    (solo empresas: 1.25% ISR y 2/3 del IVA). amount = lo que se depositó.

alter table public.payments
  add column if not exists gravable boolean not null default true,
  add column if not exists factura boolean not null default false,
  add column if not exists cliente_tipo text check (cliente_tipo is null or cliente_tipo in ('moral','fisica')),
  add column if not exists subtotal numeric(12,2) check (subtotal is null or subtotal > 0),
  add column if not exists iva numeric(12,2) not null default 0 check (iva >= 0),
  add column if not exists ret_isr numeric(12,2) not null default 0 check (ret_isr >= 0),
  add column if not exists ret_iva numeric(12,2) not null default 0 check (ret_iva >= 0),
  add constraint payments_factura_desglose check (not factura or (subtotal is not null and cliente_tipo is not null));

alter table public.income_rules
  add column if not exists gravable boolean not null default true;
