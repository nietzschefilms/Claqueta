"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { editarTarea, quitarTarea, type Resultado } from "@/app/app/tareas/acciones";
import { LISTA_FRENTES, type FrenteId } from "@/lib/claqueta/frentes";
import type { Tarea } from "@/lib/claqueta/tipos";
import { estiloFrente } from "./frente-ui";

const MINUTOS = [10, 15, 30, 45, 60, 90, 120, 180, 240];
const etiquetaMin = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h 30` : `${m / 60} h`);

type Editable = Pick<Tarea, "id" | "title" | "area" | "due_date" | "est_minutes" | "impact" | "repeat">;

// El nombre de la tarea es un botón: abre la hoja para editarla o quitarla.
export function TituloEditable({ t, className = "" }: { t: Editable; className?: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(editarTarea, null);
  const [area, setArea] = useState<FrenteId>(t.area);
  const [minutos, setMinutos] = useState(t.est_minutes);
  const [impacto, setImpacto] = useState<number>(t.impact);
  const [repeticion, setRepeticion] = useState<string>(t.repeat);
  const [seguro, setSeguro] = useState(false);
  const [quitando, iniciar] = useTransition();

  useEffect(() => {
    if (estado?.ok) dialogo.current?.close();
  }, [estado]);

  const abrir = () => {
    setArea(t.area);
    setMinutos(t.est_minutes);
    setImpacto(t.impact);
    setRepeticion(t.repeat);
    setSeguro(false);
    dialogo.current?.showModal();
  };

  const segmento = (on: boolean) =>
    `rounded-full px-3 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
      on ? "bg-tinta text-fondo" : "text-muted hover:text-tinta"
    }`;

  const opcionesMin = MINUTOS.includes(minutos) ? MINUTOS : [...MINUTOS, minutos].sort((a, b) => a - b);

  return (
    <>
      <button type="button" onClick={abrir} className={`text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${className}`} aria-label={`Editar: ${t.title}`}>
        {t.title}
      </button>
      <dialog
        ref={dialogo}
        onClick={(e) => e.target === dialogo.current && dialogo.current?.close()}
        aria-label="Editar tarea"
        className="hoja m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-visible bg-transparent p-0 md:m-auto md:max-w-lg"
      >
        <form
          action={enviar}
          className="vidrio-fuerte max-h-[92dvh] space-y-5 overflow-y-auto rounded-t-[2rem] bg-superficie/95 p-5 text-tinta md:rounded-[2rem] md:p-7"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="est_minutes" value={minutos} />
          <input type="hidden" name="impact" value={impacto} />
          <input type="hidden" name="repeat" value={repeticion} />

          <div className="flex items-center justify-between">
            <h2 className="titulo text-3xl">Editar</h2>
            <button type="button" onClick={() => dialogo.current?.close()} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-tinta/5 text-muted hover:text-tinta">
              ✕
            </button>
          </div>

          <input
            name="title"
            required
            maxLength={200}
            defaultValue={t.title}
            aria-label="Nombre de la tarea"
            className="w-full border-0 border-b border-borde bg-transparent px-0 pb-3 pt-1 text-xl font-semibold outline-none focus:border-tinta"
          />

          <fieldset>
            <legend className="etiqueta">Frente</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LISTA_FRENTES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={area === f.id}
                  onClick={() => setArea(f.id)}
                  style={estiloFrente(f.id)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold ${
                    area === f.id ? "border-[rgb(var(--fc)/0.6)] bg-[rgb(var(--fc)/0.16)]" : "border-borde/70 text-muted"
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[rgb(var(--fc))]" aria-hidden="true" />
                  <span className="truncate">{f.corto}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="etiqueta">Para cuándo</span>
            <input type="date" name="due_date" defaultValue={t.due_date ?? ""} className="campo mt-2 rounded-full py-2 font-mono text-sm" />
            <span className="mt-1 block text-xs text-muted">Déjalo vacío si no tiene fecha.</span>
          </label>

          <fieldset>
            <legend className="etiqueta">Tiempo</legend>
            <div className="sin-barra -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
              {opcionesMin.map((m) => (
                <button key={m} type="button" aria-pressed={minutos === m} onClick={() => setMinutos(m)} className={`cifra shrink-0 ${segmento(minutos === m)} ${minutos === m ? "" : "bg-tinta/[0.05]"}`}>
                  {etiquetaMin(m)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="etiqueta">Impacto</legend>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-tinta/[0.06] p-1">
                {[1, 2, 3].map((v) => (
                  <button key={v} type="button" aria-pressed={impacto === v} onClick={() => setImpacto(v)} className={segmento(impacto === v)}>
                    {["Bajo", "Medio", "Alto"][v - 1]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="etiqueta">Se repite</legend>
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
          </div>

          {estado?.error && <p className="alerta-error" role="alert">{estado.error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              disabled={quitando}
              onClick={() =>
                seguro
                  ? iniciar(async () => {
                      await quitarTarea(t.id);
                      dialogo.current?.close();
                    })
                  : setSeguro(true)
              }
              className={`btn flex-1 ${seguro ? "bg-rojo text-white" : "bg-tinta/[0.06] text-tinta"}`}
            >
              {quitando ? "Quitando…" : seguro ? "Toca otra vez para quitarla" : "Quitar sin hacer"}
            </button>
            <button type="submit" disabled={enviando} className="btn-primario flex-1">
              {enviando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
          <p className="text-center text-xs text-muted">Quitar no la borra: la archiva y deja de aparecer.</p>
        </form>
      </dialog>
    </>
  );
}
