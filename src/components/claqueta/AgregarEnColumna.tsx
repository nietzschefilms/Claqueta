"use client";

import { useActionState, useEffect, useRef } from "react";
import { crearTarea, type Resultado } from "@/app/app/tareas/acciones";
import type { FrenteId } from "@/lib/claqueta/frentes";

// Alta directa en una columna del tablero: título y, si quieres, fecha.
export function AgregarEnColumna({ area, nombre }: { area: FrenteId; nombre: string }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearTarea, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="space-y-1.5">
      <input type="hidden" name="area" value={area} />
      <div className="flex gap-1.5">
        <input
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="+ Agregar"
          aria-label={`Nueva tarea de ${nombre}`}
          className="min-w-0 flex-1 rounded-full border border-dashed border-tinta/20 bg-superficie/40 px-4 py-2.5 text-sm outline-none transition placeholder:text-muted focus:border-solid focus:border-tinta/50 focus:bg-superficie"
        />
        <input type="date" name="due_date" aria-label="Fecha (opcional)" className="w-[7.25rem] rounded-full border border-borde/80 bg-superficie/40 px-2.5 font-mono text-[11px] outline-none focus:border-tinta/50" />
        <button type="submit" disabled={enviando} className="grid w-10 shrink-0 place-items-center rounded-full bg-tinta font-mono text-sm text-fondo transition active:scale-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo" aria-label="Agregar">
          {enviando ? "…" : "+"}
        </button>
      </div>
      {estado?.error && <p className="text-xs text-acento" role="alert">{estado.error}</p>}
    </form>
  );
}
