import type { CSSProperties } from "react";
import { FRENTES, colorFrente, type FrenteId } from "@/lib/claqueta/frentes";
import { etiqueta as etiquetaDe } from "@/lib/claqueta/prioridad";

// Pone --fc con el color del frente; los hijos lo usan con rgb(var(--fc)).
export function estiloFrente(id: FrenteId): CSSProperties {
  return { ["--fc" as string]: colorFrente(id) } as CSSProperties;
}

export function ChipFrente({ id, corto = false }: { id: FrenteId; corto?: boolean }) {
  return (
    <span style={estiloFrente(id)} className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--fc)/0.12)] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--fc))]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--fc))]" aria-hidden="true" />
      {corto ? FRENTES[id].corto : FRENTES[id].nombre}
    </span>
  );
}

const ESTILO_ETIQUETA = {
  Crítico: "bg-rojo text-white shadow-[0_4px_12px_-4px_rgb(255_0_0/0.6)]",
  Alta: "bg-tinta text-fondo",
  Media: "bg-tinta/[0.07] text-tinta",
  Baja: "bg-tinta/[0.04] text-muted"
} as const;

export function EtiquetaPrioridad({ puntaje }: { puntaje: number }) {
  const e = etiquetaDe(puntaje);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${ESTILO_ETIQUETA[e]}`}>
      {e}
      <span className="font-normal opacity-70">{Math.round(puntaje)}</span>
    </span>
  );
}

// Anillo de progreso (hechas vs. total). Sirve en servidor, sin JS.
export function Anillo({ valor, total, tamano = 56, grosor = 5, children }: { valor: number; total: number; tamano?: number; grosor?: number; children?: React.ReactNode }) {
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const p = total > 0 ? Math.min(1, valor / total) : 0;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: tamano, height: tamano }}>
      <svg viewBox={`0 0 ${tamano} ${tamano}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={grosor} />
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke={p >= 1 ? "rgb(var(--c-ok))" : "currentColor"}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
