"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearTarea, type Resultado } from "@/app/app/tareas/acciones";
import { LISTA_FRENTES, type FrenteId } from "@/lib/claqueta/frentes";
import { fechaCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { estiloFrente } from "./frente-ui";

const MINUTOS = [15, 30, 45, 60, 90, 120, 180];

// El punto rojo del logo convertido en botón: captura una tarea desde cualquier pantalla.
export function Captura() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearTarea, null);
  const [area, setArea] = useState<FrenteId>("ek");
  const [fecha, setFecha] = useState("");
  const [guardadas, setGuardadas] = useState(0);

  const hoy = fechaCDMX();
  const manana = sumarDias(hoy, 1);

  function abrir() {
    setFecha(hoy);
    dialogo.current?.showModal();
  }
  function cerrar() {
    dialogo.current?.close();
  }

  // Al guardar: limpia y deja la hoja abierta para capturar otra de corrido.
  useEffect(() => {
    if (estado?.ok) {
      formulario.current?.reset();
      setGuardadas((n) => n + 1);
      formulario.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    }
  }, [estado]);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Capturar tarea"
        className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-rojo text-white shadow-[0_8px_30px_-6px_rgb(255_0_0/0.55)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta md:bottom-8 md:right-8"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <dialog
        ref={dialogo}
        onClick={(e) => e.target === dialogo.current && cerrar()}
        onClose={() => setGuardadas(0)}
        className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm md:m-auto md:max-w-lg"
      >
        <form
          ref={formulario}
          action={enviar}
          className="space-y-5 rounded-t-2xl border border-borde bg-superficie p-5 text-tinta md:rounded-lg"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="titulo text-2xl">Nueva toma</h2>
            <button type="button" onClick={cerrar} className="rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
              Cerrar
            </button>
          </div>

          <label className="block">
            <span className="etiqueta">Qué hay que hacer</span>
            <input name="title" required maxLength={200} autoComplete="off" placeholder="Ej. Mandar avance a EK" className="campo mt-1.5 text-base" />
          </label>

          <fieldset>
            <legend className="etiqueta">Frente</legend>
            <input type="hidden" name="area" value={area} />
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {LISTA_FRENTES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={area === f.id}
                  onClick={() => setArea(f.id)}
                  style={estiloFrente(f.id)}
                  className={`flex items-center gap-1.5 rounded-sm border px-2 py-2 text-left text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
                    area === f.id ? "border-[rgb(var(--fc))] bg-[rgb(var(--fc)/0.14)]" : "border-borde text-muted"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--fc))]" aria-hidden="true" />
                  {f.corto}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="etiqueta">Para cuándo</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[
                { t: "Hoy", v: hoy },
                { t: "Mañana", v: manana },
                { t: "Sin fecha", v: "" }
              ].map((o) => (
                <button
                  key={o.t}
                  type="button"
                  aria-pressed={fecha === o.v}
                  onClick={() => setFecha(o.v)}
                  className={`rounded-sm border px-3 py-2 font-mono text-xs uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
                    fecha === o.v ? "border-tinta bg-tinta text-fondo" : "border-borde text-muted"
                  }`}
                >
                  {o.t}
                </button>
              ))}
              <input
                type="date"
                name="due_date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                aria-label="Otra fecha"
                className="campo w-auto flex-1 py-2 font-mono text-sm"
              />
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="etiqueta">Tiempo</span>
              <select name="est_minutes" defaultValue={30} className="campo mt-1.5 py-2 font-mono text-sm">
                {MINUTOS.map((m) => (
                  <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`.replace(".5 h", " h 30")}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="etiqueta">Impacto</span>
              <select name="impact" defaultValue={2} className="campo mt-1.5 py-2 font-mono text-sm">
                <option value={1}>1 · Bajo</option>
                <option value={2}>2 · Medio</option>
                <option value={3}>3 · Alto</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="repeat" value="weekly" className="h-4 w-4 accent-[rgb(var(--c-rojo))]" />
            Se repite cada semana
          </label>

          {estado?.error && <p className="alerta-error" role="alert">{estado.error}</p>}
          {guardadas > 0 && !estado?.error && (
            <p className="alerta-ok" role="status">
              {guardadas === 1 ? "Guardada. Puedes capturar otra." : `${guardadas} guardadas. Puedes seguir.`}
            </p>
          )}

          <button type="submit" disabled={enviando} className="btn-primario w-full py-3 uppercase tracking-wider">
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </dialog>
    </>
  );
}
