"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearTarea, type Resultado } from "@/app/app/tareas/acciones";
import { LISTA_FRENTES, type FrenteId } from "@/lib/claqueta/frentes";
import { fechaCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { estiloFrente } from "./frente-ui";

const MINUTOS = [15, 30, 45, 60, 90, 120, 180];
const EVENTO = "claqueta:capturar";

// Cualquier botón de la app abre la hoja con esto (el punto rojo, la barra lateral).
export function abrirCaptura() {
  window.dispatchEvent(new Event(EVENTO));
}

const etiquetaMin = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h 30` : `${m / 60} h`);

// Hoja de captura: una tarea desde cualquier pantalla. En escritorio también con la tecla N.
export function Captura() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearTarea, null);
  const [area, setArea] = useState<FrenteId>("ek");
  const [fecha, setFecha] = useState("");
  const [minutos, setMinutos] = useState(30);
  const [impacto, setImpacto] = useState(2);
  const [repeticion, setRepeticion] = useState("none");
  const [guardadas, setGuardadas] = useState(0);

  const hoy = fechaCDMX();
  const manana = sumarDias(hoy, 1);

  useEffect(() => {
    const abrir = () => {
      if (dialogo.current?.open) return;
      setFecha(fechaCDMX());
      dialogo.current?.showModal();
    };
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const escribiendo = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!escribiendo && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener(EVENTO, abrir);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener(EVENTO, abrir);
      window.removeEventListener("keydown", tecla);
    };
  }, []);

  const cerrar = () => dialogo.current?.close();

  // Al guardar: limpia y deja la hoja abierta para capturar otra de corrido.
  useEffect(() => {
    if (estado?.ok) {
      formulario.current?.reset();
      setRepeticion("none");
      setGuardadas((n) => n + 1);
      formulario.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    }
  }, [estado]);

  const segmento = (on: boolean) =>
    `rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
      on ? "bg-tinta text-fondo shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" : "text-muted hover:text-tinta"
    }`;

  return (
    <dialog
      ref={dialogo}
      onClick={(e) => e.target === dialogo.current && cerrar()}
      onClose={() => setGuardadas(0)}
      aria-labelledby="captura-titulo"
      className="hoja m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-visible bg-transparent p-0 md:m-auto md:max-w-xl"
    >
      <form
        ref={formulario}
        action={enviar}
        className="vidrio-fuerte max-h-[92dvh] bg-superficie/95 space-y-5 overflow-y-auto rounded-t-[2rem] p-5 text-tinta md:rounded-[2rem] md:p-7"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-tinta/15 md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 id="captura-titulo" className="titulo text-3xl">
            Nueva toma<span className="text-rojo">.</span>
          </h2>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-tinta/5 text-muted transition hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <label className="block">
          <span className="sr-only">Qué hay que hacer</span>
          <input
            name="title"
            required
            maxLength={200}
            autoComplete="off"
            placeholder="¿Qué hay que hacer?"
            className="w-full border-0 border-b border-borde bg-transparent px-0 pb-3 pt-1 text-xl font-semibold text-tinta outline-none placeholder:font-normal placeholder:text-muted/70 focus:border-tinta"
          />
        </label>

        <fieldset>
          <legend className="etiqueta">Frente</legend>
          <input type="hidden" name="area" value={area} />
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-3">
            {LISTA_FRENTES.map((f) => {
              const on = area === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setArea(f.id)}
                  style={estiloFrente(f.id)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
                    on ? "border-[rgb(var(--fc)/0.6)] bg-[rgb(var(--fc)/0.16)] text-tinta" : "border-borde/70 bg-superficie/40 text-muted"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-[rgb(var(--fc))] ${on ? "ring-4 ring-[rgb(var(--fc)/0.2)]" : ""}`} aria-hidden="true" />
                  <span className="truncate">{f.corto}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="etiqueta">Para cuándo</legend>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-tinta/[0.06] p-1">
              {[
                { t: "Hoy", v: hoy },
                { t: "Mañana", v: manana },
                { t: "Sin fecha", v: "" }
              ].map((o) => (
                <button key={o.t} type="button" aria-pressed={fecha === o.v} onClick={() => setFecha(o.v)} className={segmento(fecha === o.v)}>
                  {o.t}
                </button>
              ))}
            </div>
            <input
              type="date"
              name="due_date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Otra fecha"
              className="campo w-auto min-w-[10.5rem] flex-1 rounded-full py-2 font-mono text-sm"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="etiqueta">Tiempo</legend>
          <input type="hidden" name="est_minutes" value={minutos} />
          <div className="sin-barra -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
            {MINUTOS.map((m) => (
              <button key={m} type="button" aria-pressed={minutos === m} onClick={() => setMinutos(m)} className={`cifra shrink-0 ${segmento(minutos === m)} ${minutos === m ? "" : "bg-tinta/[0.05]"}`}>
                {etiquetaMin(m)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="etiqueta">Impacto</legend>
          <input type="hidden" name="impact" value={impacto} />
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-tinta/[0.06] p-1">
            {[
              { v: 1, t: "Bajo" },
              { v: 2, t: "Medio" },
              { v: 3, t: "Alto" }
            ].map((o) => (
              <button key={o.v} type="button" aria-pressed={impacto === o.v} onClick={() => setImpacto(o.v)} className={segmento(impacto === o.v)}>
                {o.t}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="etiqueta">Se repite</legend>
          <input type="hidden" name="repeat" value={repeticion} />
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-tinta/[0.06] p-1">
            {[
              { v: "none", t: "No" },
              { v: "daily", t: "Diario" },
              { v: "weekly", t: "Semanal" }
            ].map((o) => (
              <button key={o.v} type="button" aria-pressed={repeticion === o.v} onClick={() => setRepeticion(o.v)} className={segmento(repeticion === o.v)}>
                {o.t}
              </button>
            ))}
          </div>
        </fieldset>

        {estado?.error && <p className="alerta-error" role="alert">{estado.error}</p>}
        {guardadas > 0 && !estado?.error && (
          <p className="alerta-ok" role="status">
            {guardadas === 1 ? "Guardada. Puedes capturar otra." : `${guardadas} guardadas. Puedes seguir.`}
          </p>
        )}

        <button type="submit" disabled={enviando} className="btn-rojo w-full py-3.5 text-base">
          {enviando ? "Guardando…" : "Guardar toma"}
        </button>
      </form>
    </dialog>
  );
}
