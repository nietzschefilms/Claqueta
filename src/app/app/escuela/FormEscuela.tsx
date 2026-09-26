"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearTarea, type Resultado } from "@/app/app/tareas/acciones";
import { fechaCDMX, sumarDias } from "@/lib/claqueta/fechas";

const DIFICULTAD = [
  { v: 1, t: "Fácil", min: 30, d: "30 min" },
  { v: 2, t: "Media", min: 90, d: "1 h 30" },
  { v: 3, t: "Difícil", min: 180, d: "3 h" }
];

const chip = (on: boolean) =>
  `rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
    on ? "bg-tinta text-fondo shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" : "bg-tinta/[0.06] text-muted hover:text-tinta"
  }`;

// Tarea de la escuela: qué, de qué materia, qué tan difícil y para cuándo. Claqueta prioriza sola.
export function FormEscuela({ materias }: { materias: string[] }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearTarea, null);
  const form = useRef<HTMLFormElement>(null);
  const hoy = fechaCDMX();
  const [materia, setMateria] = useState(materias[0] ?? "");
  const [dificultad, setDificultad] = useState(2);
  const [fecha, setFecha] = useState(sumarDias(hoy, 3));
  const [guardadas, setGuardadas] = useState(0);

  useEffect(() => {
    if (estado?.ok) {
      form.current?.reset();
      setGuardadas((n) => n + 1);
      form.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    }
  }, [estado]);

  const minutos = DIFICULTAD.find((x) => x.v === dificultad)!.min;
  const rapidas = [
    { t: "Mañana", v: sumarDias(hoy, 1) },
    { t: "En 3 días", v: sumarDias(hoy, 3) },
    { t: "En una semana", v: sumarDias(hoy, 7) }
  ];

  return (
    <form ref={form} action={enviar} className="space-y-5">
      <input type="hidden" name="area" value="escuela" />
      <input type="hidden" name="materia" value={materia} />
      <input type="hidden" name="dificultad" value={dificultad} />
      <input type="hidden" name="est_minutes" value={minutos} />
      <input type="hidden" name="impact" value={2} />

      <label className="block">
        <span className="sr-only">Qué hay que hacer</span>
        <input
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="¿Qué te dejaron?"
          className="w-full border-0 border-b border-borde bg-transparent px-0 pb-3 pt-1 text-xl font-semibold text-tinta outline-none placeholder:font-normal placeholder:text-muted/70 focus:border-tinta"
        />
      </label>

      <fieldset>
        <legend className="etiqueta">Materia</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {materias.map((m) => (
            <button key={m} type="button" aria-pressed={materia === m} onClick={() => setMateria(m)} className={chip(materia === m)}>
              {m}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="etiqueta">Dificultad</legend>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-tinta/[0.06] p-1">
          {DIFICULTAD.map((d) => (
            <button key={d.v} type="button" aria-pressed={dificultad === d.v} onClick={() => setDificultad(d.v)} className={`${chip(dificultad === d.v)} flex flex-col items-center leading-tight`}>
              {d.t}
              <span className="cifra text-[10px] font-normal opacity-70">{d.d}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="etiqueta">Para cuándo</legend>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {rapidas.map((r) => (
            <button key={r.t} type="button" aria-pressed={fecha === r.v} onClick={() => setFecha(r.v)} className={chip(fecha === r.v)}>
              {r.t}
            </button>
          ))}
          <input
            type="date"
            name="due_date"
            required
            min={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-label="Fecha de entrega"
            className="campo w-auto min-w-[10.5rem] flex-1 rounded-full py-2 font-mono text-sm"
          />
        </div>
      </fieldset>

      {estado?.error && <p className="alerta-error" role="alert">{estado.error}</p>}
      {guardadas > 0 && !estado?.error && (
        <p className="alerta-ok" role="status">{guardadas === 1 ? "Guardada. Ya está en tu plan." : `${guardadas} guardadas.`}</p>
      )}
      <button type="submit" disabled={enviando} className="btn-primario w-full py-3">
        {enviando ? "Guardando…" : "Agregar tarea"}
      </button>
    </form>
  );
}
