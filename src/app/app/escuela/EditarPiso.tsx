"use client";

import { useState, useTransition } from "react";
import { guardarPiso } from "./acciones";

// Piso del salón: se toca, se escribe y queda para todas sus clases.
export function EditarPiso({ salon, piso }: { salon: string; piso: string | null }) {
  const [editar, setEditar] = useState(false);
  const [valor, setValor] = useState(piso ?? "");
  const [p, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editar)
    return (
      <button
        type="button"
        onClick={() => setEditar(true)}
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
          piso ? "bg-tinta/[0.06] text-tinta hover:bg-tinta/10" : "border border-dashed border-f-escuela/60 text-f-escuela hover:bg-f-escuela/10"
        }`}
        aria-label={piso ? `Cambiar piso de ${salon}` : `Agregar piso de ${salon}`}
      >
        {piso ? `Piso ${piso}` : "+ Piso"}
      </button>
    );

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        maxLength={20}
        autoFocus
        placeholder="Ej. 2 o PB"
        aria-label={`Piso de ${salon}`}
        className="campo w-24 rounded-full px-3 py-1 text-xs"
      />
      <button
        type="button"
        disabled={p}
        onClick={() =>
          iniciar(async () => {
            setError(null);
            const r = await guardarPiso(salon, valor);
            if (r.ok) setEditar(false);
            else setError(r.error ?? "No se pudo.");
          })
        }
        className="rounded-full bg-tinta px-3 py-1 text-xs font-semibold text-fondo disabled:opacity-50"
      >
        {p ? "…" : "Listo"}
      </button>
      {error && <span className="text-[11px] text-acento" role="alert">{error}</span>}
    </span>
  );
}
