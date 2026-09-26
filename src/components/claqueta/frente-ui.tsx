import type { CSSProperties } from "react";
import { FRENTES, colorFrente, type FrenteId } from "@/lib/claqueta/frentes";
import { etiqueta as etiquetaDe } from "@/lib/claqueta/prioridad";

// Pone --fc con el color del frente; los hijos lo usan con rgb(var(--fc)).
export function estiloFrente(id: FrenteId): CSSProperties {
  return { ["--fc" as string]: colorFrente(id) } as CSSProperties;
}

export function ChipFrente({ id, corto = false }: { id: FrenteId; corto?: boolean }) {
  return (
    <span style={estiloFrente(id)} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
      <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--fc))]" aria-hidden="true" />
      {corto ? FRENTES[id].corto : FRENTES[id].nombre}
    </span>
  );
}

const ESTILO_ETIQUETA = {
  Crítico: "bg-rojo text-white",
  Alta: "border border-tinta text-tinta",
  Media: "border border-borde text-muted",
  Baja: "text-muted/80"
} as const;

export function EtiquetaPrioridad({ puntaje }: { puntaje: number }) {
  const e = etiquetaDe(puntaje);
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${ESTILO_ETIQUETA[e]}`}>
      {e}
      <span className="font-normal opacity-70">{Math.round(puntaje)}</span>
    </span>
  );
}
