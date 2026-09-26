"use client";

import { useState, useTransition } from "react";
import { cambiarEstado, moverAManana, quitarTarea } from "@/app/app/tareas/acciones";
import type { Estado } from "@/lib/claqueta/tipos";

const pequeno =
  "rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo disabled:opacity-50";

export function BotonMoverManana({ id }: { id: string }) {
  const [p, iniciar] = useTransition();
  return (
    <button type="button" disabled={p} onClick={() => iniciar(async () => void (await moverAManana(id)))} className={`${pequeno} whitespace-nowrap bg-tinta text-fondo hover:opacity-90`}>
      {p ? "Moviendo…" : "A mañana →"}
    </button>
  );
}

// Quitar pide un segundo toque para confirmar. No borra: archiva.
export function BotonQuitar({ id }: { id: string }) {
  const [p, iniciar] = useTransition();
  const [seguro, setSeguro] = useState(false);
  return (
    <button
      type="button"
      disabled={p}
      onBlur={() => setSeguro(false)}
      onClick={() => (seguro ? iniciar(async () => void (await quitarTarea(id))) : setSeguro(true))}
      className={`${pequeno} ${seguro ? "bg-rojo text-white" : "text-muted hover:bg-tinta/5 hover:text-tinta"}`}
      aria-label={seguro ? "Toca otra vez para quitar la tarea" : "Quitar tarea sin hacerla"}
    >
      {p ? "…" : seguro ? "¿Quitar?" : "Quitar"}
    </button>
  );
}

const ESTADOS: { v: Estado; t: string }[] = [
  { v: "pendiente", t: "Pendiente" },
  { v: "haciendo", t: "Haciendo" },
  { v: "hecho", t: "Hecho" }
];

export function SelectorEstado({ id, estado }: { id: string; estado: Estado }) {
  const [p, iniciar] = useTransition();
  const [valor, setValor] = useState(estado);
  return (
    <select
      aria-label="Estado"
      value={valor}
      disabled={p}
      onChange={(e) => {
        const nuevo = e.target.value as Estado;
        setValor(nuevo);
        iniciar(async () => void (await cambiarEstado(id, nuevo)));
      }}
      className="rounded-full border border-borde/80 bg-superficie/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-tinta outline-none focus-visible:border-tinta"
    >
      {ESTADOS.map((e) => (
        <option key={e.v} value={e.v}>{e.t}</option>
      ))}
    </select>
  );
}
