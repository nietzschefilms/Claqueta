"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hacerMiVersion } from "./acciones-equipo";

// "Hacer mi versión": copia el guion a un proyecto personal para armar tu
// propio shooting (la escuela pide uno por persona).
export function BotonMiVersion({ proyectoId, compacto = false }: { proyectoId: string; compacto?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const hacer = () =>
    iniciar(async () => {
      setError(null);
      const r = await hacerMiVersion(proyectoId);
      if (!r.ok || !r.id) return setError(r.error ?? "No se pudo.");
      router.push(`/app/estudio/proyectos/${r.id}?v=planos`);
    });

  if (compacto)
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button type="button" disabled={pendiente} onClick={hacer} className="btn-secundario">
          {pendiente ? "Creando…" : "Hacer mi versión"}
        </button>
        {error && <span className="text-xs text-rojo">{error}</span>}
      </span>
    );
  return (
    <section className="tarjeta flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">¿Te toca entregar tu propio shooting?</p>
        <p className="text-sm text-muted">Haz tu versión: se copia el guion a un proyecto personal, solo tú lo ves y ahí armas tu shotlist, plantillas y storyboard.</p>
        {error && <p className="mt-1 text-sm text-rojo">{error}</p>}
      </div>
      <button type="button" disabled={pendiente} onClick={hacer} className="btn-rojo shrink-0">
        {pendiente ? "Creando tu versión…" : "Hacer mi versión"}
      </button>
    </section>
  );
}
