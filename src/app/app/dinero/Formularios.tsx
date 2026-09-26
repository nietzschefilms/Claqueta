"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { anularMovimiento, confirmarCobro, registrarEntrada, registrarGasto, type Resultado } from "./acciones";

export const CATEGORIAS = ["Comida", "Transporte", "Casa", "Escuela", "Equipo", "Salidas", "Suscripciones", "Otros"];

const campoMonto =
  "cifra w-full rounded-2xl border border-borde/80 bg-superficie/70 py-3 pl-9 pr-4 text-2xl font-semibold text-tinta outline-none transition placeholder:text-muted/50 focus:border-tinta/60 focus:bg-superficie focus:ring-4 focus:ring-tinta/5";

function Monto({ id, etiqueta, autoFocus = false }: { id: string; etiqueta: string; autoFocus?: boolean }) {
  return (
    <label htmlFor={id} className="block">
      <span className="sr-only">{etiqueta}</span>
      <span className="relative block">
        <span className="cifra pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted">$</span>
        <input id={id} name="monto" required inputMode="decimal" autoComplete="off" placeholder="0" autoFocus={autoFocus} className={campoMonto} />
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
export function FormGasto({ hoy }: { hoy: string }) {
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
export function FormEntrada({ hoy, fuente, area, contrato, boton, idBase }: { hoy: string; fuente: string; area: string; contrato?: string; boton: string; idBase: string }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(registrarEntrada, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="space-y-3">
      <input type="hidden" name="fuente" value={fuente} />
      <input type="hidden" name="area" value={area} />
      {contrato && <input type="hidden" name="contrato" value={contrato} />}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Monto id={`${idBase}-monto`} etiqueta={boton} />
        <input type="date" name="fecha" defaultValue={hoy} max={hoy} aria-label="Fecha" className="campo w-[9.5rem] rounded-2xl font-mono text-sm" />
      </div>
      <input name="nota" maxLength={200} autoComplete="off" placeholder="Nota (opcional)" aria-label="Nota" className="campo rounded-full py-2.5 text-sm" />
      <Mensajes estado={estado} />
      <button type="submit" disabled={enviando} className="btn-secundario w-full">
        {enviando ? "Guardando…" : boton}
      </button>
    </form>
  );
}

// "Llegó": confirma el cobro esperado con su monto; "Otro monto" por si llegó distinto.
export function BotonCobro({ reglaId, fecha, monto }: { reglaId: string; fecha: string; monto: string }) {
  const [p, iniciar] = useTransition();
  const [editar, setEditar] = useState(false);
  const [valor, setValor] = useState(monto);
  const [error, setError] = useState<string | null>(null);

  const confirmar = (texto?: string) =>
    iniciar(async () => {
      setError(null);
      const r = await confirmarCobro(reglaId, fecha, texto);
      if (!r.ok) setError(r.error ?? "No se pudo.");
    });

  return (
    <div className="flex flex-col items-end gap-1">
      {editar ? (
        <div className="flex items-center gap-1.5">
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" aria-label="Monto que llegó" className="campo cifra w-24 rounded-full px-3 py-1.5 text-sm" />
          <button type="button" disabled={p} onClick={() => confirmar(valor)} className="rounded-full bg-ok px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {p ? "…" : "Guardar"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setEditar(true)} className="enlace-mono px-2 text-[10px]">Otro monto</button>
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
export function BotonAnular({ tipo, id }: { tipo: "entrada" | "gasto"; id: string }) {
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
