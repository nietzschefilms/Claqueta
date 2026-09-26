"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { aCentavos, pesos } from "@/lib/claqueta/dinero";
import { desgloseFactura, type ClienteTipo } from "@/lib/claqueta/impuestos";
import { Interruptor } from "@/components/Interruptor";
import { anularMovimiento, confirmarCobro, confirmarFijo, registrarEntrada, registrarGasto, registrarTransferencia, type Resultado } from "./acciones";

export type OpcionCuenta = { id: string; nombre: string; tipo: "debito" | "efectivo" | "credito" | "garantia" };

// Con qué se pagó / dónde entró: un toque por cuenta.
function ElegirCuenta({ cuentas, nombre = "cuenta", etiqueta, inicial }: { cuentas: OpcionCuenta[]; nombre?: string; etiqueta: string; inicial?: string }) {
  const [valor, setValor] = useState(inicial ?? cuentas[0]?.id ?? "");
  return (
    <fieldset>
      <legend className="etiqueta">{etiqueta}</legend>
      <input type="hidden" name={nombre} value={valor} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cuentas.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={valor === c.id}
            onClick={() => setValor(c.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
              valor === c.id ? "bg-tinta text-fondo shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" : "bg-tinta/[0.06] text-muted hover:text-tinta"
            }`}
          >
            {c.nombre}
            {c.tipo === "credito" && <span className="font-mono text-[9px] uppercase opacity-70">crédito</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const CATEGORIAS = ["Comida", "Transporte", "Equipo de video", "Suscripciones", "Escuela", "Casa", "Salidas", "Otros"];

const campoMonto =
  "cifra w-full rounded-2xl border border-borde/80 bg-superficie/70 py-3 pl-9 pr-4 text-2xl font-semibold text-tinta outline-none transition placeholder:text-muted/50 focus:border-tinta/60 focus:bg-superficie focus:ring-4 focus:ring-tinta/5";

function Monto({ id, etiqueta, autoFocus = false, onValor }: { id: string; etiqueta: string; autoFocus?: boolean; onValor?: (v: string) => void }) {
  return (
    <label htmlFor={id} className="block">
      <span className="sr-only">{etiqueta}</span>
      <span className="relative block">
        <span className="cifra pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted">$</span>
        <input id={id} name="monto" required inputMode="decimal" autoComplete="off" placeholder="0" autoFocus={autoFocus} onChange={onValor ? (e) => onValor(e.target.value) : undefined} className={campoMonto} />
      </span>
    </label>
  );
}

function Mensajes({ estado }: { estado: Resultado | null }) {
  if (estado?.error) return <p className="alerta-error" role="alert">{estado.error}</p>;
  if (estado?.ok && estado.mensaje) return <p className="alerta-ok" role="status">{estado.mensaje}</p>;
  return null;
}

// Gasto: monto, categoría con un toque, nota opcional y fecha (hoy por defecto).
export function FormGasto({ hoy, cuentas }: { hoy: string; cuentas: OpcionCuenta[] }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(registrarGasto, null);
  const [categoria, setCategoria] = useState("Comida");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="space-y-4">
      <Monto id="gasto-monto" etiqueta="Monto del gasto" />
      <fieldset>
        <legend className="etiqueta">Categoría</legend>
        <input type="hidden" name="categoria" value={categoria} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={categoria === c}
              onClick={() => setCategoria(c)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
                categoria === c ? "bg-tinta text-fondo shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" : "bg-tinta/[0.06] text-muted hover:text-tinta"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>
      <ElegirCuenta cuentas={cuentas} etiqueta="Con qué pagaste" />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input name="nota" maxLength={200} autoComplete="off" placeholder="Nota (opcional): tacos, gasolina…" aria-label="Nota" className="campo rounded-full py-2.5 text-sm" />
        <input type="date" name="fecha" defaultValue={hoy} max={hoy} aria-label="Fecha del gasto" className="campo rounded-full py-2.5 font-mono text-sm sm:w-44" />
      </div>
      <Mensajes estado={estado} />
      <button type="submit" disabled={enviando} className="btn-primario w-full py-3">
        {enviando ? "Guardando…" : "Guardar gasto"}
      </button>
    </form>
  );
}

// Entrada: comisiones de la clínica o abono de un contrato. Fuente y frente vienen fijos.
const chip = (on: boolean) =>
  `rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
    on ? "bg-tinta text-fondo shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" : "bg-tinta/[0.06] text-muted hover:text-tinta"
  }`;

// Entrada de dinero. Fuente fija (contrato, comisiones) o libre con sugerencias
// (papás, regalo, cliente). Con factura: el monto es el subtotal y se ve el desglose.
export function FormEntrada({
  hoy,
  fuente,
  fuentes,
  area,
  contrato,
  boton,
  idBase,
  cuentas,
  permitirFactura = true,
  elegirGravable = false
}: {
  hoy: string;
  fuente?: string;
  fuentes?: { t: string; gravable: boolean }[];
  area: string;
  contrato?: string;
  boton: string;
  idBase: string;
  cuentas: OpcionCuenta[];
  permitirFactura?: boolean;
  elegirGravable?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(registrarEntrada, null);
  const form = useRef<HTMLFormElement>(null);
  const [nombre, setNombre] = useState(fuente ?? fuentes?.[0]?.t ?? "");
  const [gravable, setGravable] = useState(fuentes?.[0]?.gravable ?? true);
  const [factura, setFactura] = useState(false);
  const [cliente, setCliente] = useState<ClienteTipo>("moral");
  const [monto, setMonto] = useState("");

  useEffect(() => {
    if (estado?.ok) {
      form.current?.reset();
      setMonto("");
      setFactura(false);
    }
  }, [estado]);

  const centavos = aCentavos(monto);
  const d = factura && centavos ? desgloseFactura(centavos, cliente) : null;

  return (
    <form ref={form} action={enviar} className="space-y-3">
      <input type="hidden" name="fuente" value={nombre} />
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="gravable" value={gravable ? "si" : "no"} />
      <input type="hidden" name="factura" value={factura ? "si" : "no"} />
      {factura && <input type="hidden" name="cliente_tipo" value={cliente} />}
      {contrato && <input type="hidden" name="contrato" value={contrato} />}

      {fuentes && (
        <fieldset>
          <legend className="etiqueta">De quién</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fuentes.map((f) => (
              <button
                key={f.t}
                type="button"
                aria-pressed={nombre === f.t}
                onClick={() => {
                  setNombre(f.t);
                  setGravable(f.gravable);
                  if (!f.gravable) setFactura(false);
                }}
                className={chip(nombre === f.t)}
              >
                {f.t}
              </button>
            ))}
          </div>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            required
            aria-label="De dónde vino el dinero"
            placeholder="O escribe quién te pagó"
            className="campo mt-2 rounded-full py-2.5 text-sm"
          />
        </fieldset>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Monto id={`${idBase}-monto`} etiqueta={factura ? "Subtotal antes de IVA" : boton} onValor={setMonto} />
        <input type="date" name="fecha" defaultValue={hoy} max={hoy} aria-label="Fecha" className="campo w-[9.5rem] rounded-2xl font-mono text-sm" />
      </div>

      {elegirGravable && (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-tinta/[0.04] px-4 py-3 text-sm">
          <span>
            <span className="block font-medium">Es de mi trabajo</span>
            <span className="text-xs text-muted">Cuenta para impuestos. Lo de tus papás o un regalo, no.</span>
          </span>
          <Interruptor
            checked={gravable}
            onChange={(e) => {
              setGravable(e.target.checked);
              if (!e.target.checked) setFactura(false);
            }}
            aria-label="Es de mi trabajo"
          />
        </label>
      )}

      {permitirFactura && gravable && (
        <div className="rounded-2xl bg-tinta/[0.04] px-4 py-3">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Con factura e IVA</span>
              <span className="text-xs text-muted">Escribe el subtotal; calculo IVA y retenciones.</span>
            </span>
            <Interruptor checked={factura} onChange={(e) => setFactura(e.target.checked)} aria-label="Con factura e IVA" />
          </label>
          {factura && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-1 rounded-full bg-tinta/[0.06] p-1">
                <button type="button" aria-pressed={cliente === "moral"} onClick={() => setCliente("moral")} className={chip(cliente === "moral")}>Empresa</button>
                <button type="button" aria-pressed={cliente === "fisica"} onClick={() => setCliente("fisica")} className={chip(cliente === "fisica")}>Persona</button>
              </div>
              {d ? (
                <dl className="cifra space-y-1 text-xs">
                  <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{pesos(d.subtotal)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">+ IVA 16%</dt><dd>{pesos(d.iva)}</dd></div>
                  {d.retIsr > 0 && <div className="flex justify-between"><dt className="text-muted">− Retención ISR 1.25%</dt><dd>{pesos(d.retIsr)}</dd></div>}
                  {d.retIva > 0 && <div className="flex justify-between"><dt className="text-muted">− Retención IVA (2/3)</dt><dd>{pesos(d.retIva)}</dd></div>}
                  <div className="flex justify-between border-t border-borde/60 pt-1 text-sm font-semibold"><dt>Te depositan</dt><dd>{pesos(d.deposito)}</dd></div>
                </dl>
              ) : (
                <p className="text-xs text-muted">Escribe el subtotal para ver el desglose.</p>
              )}
            </div>
          )}
        </div>
      )}

      <ElegirCuenta cuentas={cuentas} etiqueta="Dónde entró" />
      <input name="nota" maxLength={200} autoComplete="off" placeholder="Nota (opcional)" aria-label="Nota" className="campo rounded-full py-2.5 text-sm" />
      <Mensajes estado={estado} />
      <button type="submit" disabled={enviando} className="btn-secundario w-full">
        {enviando ? "Guardando…" : boton}
      </button>
    </form>
  );
}

// "Llegó": confirma el cobro esperado con su monto; "Otro monto" por si llegó distinto.
export function BotonCobro({ reglaId, fecha, monto, cuentas }: { reglaId: string; fecha: string; monto: string; cuentas: OpcionCuenta[] }) {
  const [p, iniciar] = useTransition();
  const [editar, setEditar] = useState(false);
  const [valor, setValor] = useState(monto);
  const [cuenta, setCuenta] = useState(cuentas[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const confirmar = (texto?: string) =>
    iniciar(async () => {
      setError(null);
      const r = await confirmarCobro(reglaId, fecha, cuenta, texto);
      if (!r.ok) setError(r.error ?? "No se pudo.");
    });

  return (
    <div className="flex flex-col items-end gap-1">
      {editar ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Dónde entró" className="campo w-auto rounded-full px-3 py-1.5 text-xs">
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" aria-label="Monto que llegó" className="campo cifra w-24 rounded-full px-3 py-1.5 text-sm" />
          <button type="button" disabled={p} onClick={() => confirmar(valor)} className="rounded-full bg-ok px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {p ? "…" : "Guardar"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setEditar(true)} className="enlace-mono px-2 text-[10px]">Cambiar</button>
          <button type="button" disabled={p} onClick={() => confirmar()} className="rounded-full bg-ok px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_-8px_rgb(var(--c-ok)/0.8)] transition active:scale-95 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
            {p ? "…" : "Llegó ✓"}
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-acento" role="alert">{error}</p>}
    </div>
  );
}

// Anular pide un segundo toque. No borra: marca anulado.
export function BotonAnular({ tipo, id }: { tipo: "entrada" | "gasto" | "movimiento"; id: string }) {
  const [p, iniciar] = useTransition();
  const [seguro, setSeguro] = useState(false);
  return (
    <button
      type="button"
      disabled={p}
      onBlur={() => setSeguro(false)}
      onClick={() => (seguro ? iniciar(async () => void (await anularMovimiento(tipo, id))) : setSeguro(true))}
      aria-label={seguro ? "Toca otra vez para anular" : "Anular movimiento"}
      className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
        seguro ? "bg-rojo text-white" : "text-muted/70 hover:bg-tinta/5 hover:text-tinta"
      }`}
    >
      {p ? "…" : seguro ? "¿Anular?" : "Anular"}
    </button>
  );
}

// Mover dinero: pagar tarjeta, apartar en garantía, sacar efectivo.
export function FormMover({ hoy, cuentas }: { hoy: string; cuentas: OpcionCuenta[] }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(registrarTransferencia, null);
  const form = useRef<HTMLFormElement>(null);
  const deb = cuentas.find((c) => c.tipo === "debito") ?? cuentas[0];
  const tarjeta = cuentas.find((c) => c.tipo === "credito") ?? cuentas[1];

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="space-y-3">
      <ElegirCuenta cuentas={cuentas} nombre="desde" etiqueta="Sale de" inicial={deb?.id} />
      <ElegirCuenta cuentas={cuentas} nombre="hacia" etiqueta="Llega a" inicial={tarjeta?.id} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Monto id="mover-monto" etiqueta="Monto a mover" />
        <input type="date" name="fecha" defaultValue={hoy} max={hoy} aria-label="Fecha" className="campo w-[9.5rem] rounded-2xl font-mono text-sm" />
      </div>
      <input name="nota" maxLength={200} autoComplete="off" placeholder="Nota (opcional): pago de tarjeta…" aria-label="Nota" className="campo rounded-full py-2.5 text-sm" />
      <Mensajes estado={estado} />
      <button type="submit" disabled={enviando} className="btn-secundario w-full">
        {enviando ? "Guardando…" : "Mover dinero"}
      </button>
    </form>
  );
}

// "Ya se cobró" de una suscripción: monto real en pesos y con qué se pagó.
export function BotonFijo({ fijoId, mes, montoMxn, cuentas, cuentaInicial }: { fijoId: string; mes: string; montoMxn: string; cuentas: OpcionCuenta[]; cuentaInicial?: string | null }) {
  const [p, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(montoMxn);
  const [cuenta, setCuenta] = useState(cuentaInicial ?? cuentas[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="rounded-full bg-tinta/[0.07] px-3.5 py-1.5 text-xs font-semibold text-tinta transition active:scale-95 hover:bg-tinta/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
        Ya se cobró
      </button>
    );

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Con qué se pagó" className="campo w-auto rounded-full px-3 py-1.5 text-xs">
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <span className="relative">
          <span className="cifra pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" aria-label="Cuánto te cobraron en pesos" className="campo cifra w-24 rounded-full py-1.5 pl-5 pr-2 text-sm" />
        </span>
        <button
          type="button"
          disabled={p}
          onClick={() =>
            iniciar(async () => {
              setError(null);
              const r = await confirmarFijo(fijoId, mes, valor, cuenta);
              if (!r.ok) setError(r.error ?? "No se pudo.");
            })
          }
          className="rounded-full bg-tinta px-3.5 py-1.5 text-xs font-semibold text-fondo disabled:opacity-50"
        >
          {p ? "…" : "Guardar"}
        </button>
      </div>
      {error && <p className="text-[11px] text-acento" role="alert">{error}</p>}
    </div>
  );
}
