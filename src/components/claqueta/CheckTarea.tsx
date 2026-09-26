"use client";

import { useOptimistic, useTransition } from "react";
import { alternarHecha } from "@/app/app/tareas/acciones";

// Círculo para marcar hecha. Cambia al instante y guarda en segundo plano.
export function CheckTarea({ id, hecha, titulo }: { id: string; hecha: boolean; titulo: string }) {
  const [pendiente, iniciar] = useTransition();
  const [marcada, setMarcada] = useOptimistic(hecha);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={marcada ? `Desmarcar: ${titulo}` : `Marcar como hecha: ${titulo}`}
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          setMarcada(!marcada);
          await alternarHecha(id, !marcada);
        })
      }
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo ${
        marcada ? "border-tinta bg-tinta text-fondo" : "border-muted/60 hover:border-tinta"
      }`}
    >
      {marcada && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
    </button>
  );
}
