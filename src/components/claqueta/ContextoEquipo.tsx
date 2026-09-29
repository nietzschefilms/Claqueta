"use client";

import { createContext, useContext, useMemo } from "react";
import { FRENTE_IDS, frentesDe, type Frente, type FrenteId } from "@/lib/claqueta/frentes";

export type DatosEquipo = {
  yo: string;
  frentes: FrenteId[];
  equipos: { id: string; nombre: string; frente: FrenteId }[];
  companeros: { id: string; nombre: string; equipo_id: string }[];
};

const Contexto = createContext<DatosEquipo>({ yo: "", frentes: [...FRENTE_IDS], equipos: [], companeros: [] });

// Frentes de la persona, su equipo (Nietzsche) y sus compañeros, para los
// formularios del cliente (captura, editar tarea, rutina).
export function ProveedorEquipo({ valor, children }: { valor: DatosEquipo; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useEquipo = () => useContext(Contexto);

// Mis frentes; si se pasa `incluir`, también ese (una tarea vieja de otro frente).
export function useFrentes(incluir?: FrenteId): Frente[] {
  const { frentes } = useContext(Contexto);
  return useMemo(() => frentesDe(incluir && !frentes.includes(incluir) ? [...frentes, incluir] : frentes), [frentes, incluir]);
}

// El equipo que comparte ese frente, con mis compañeros en él.
export function useEquipoDe(area: FrenteId) {
  const { equipos, companeros, yo } = useContext(Contexto);
  const equipo = equipos.find((e) => e.frente === area) ?? null;
  return { equipo, yo, companeros: equipo ? companeros.filter((c) => c.equipo_id === equipo.id) : [] };
}

export type Para = "yo" | "dos" | "privada" | string;

// Selector "¿para quién?" de una tarea de equipo. `valor`: yo, dos, privada o el id del compañero.
export function ParaQuien({ area, valor, onCambio }: { area: FrenteId; valor: Para; onCambio: (v: Para) => void }) {
  const { equipo, companeros } = useEquipoDe(area);
  if (!equipo) return null;
  const opciones = [
    { v: "yo", t: "Mía" },
    ...companeros.map((c) => ({ v: c.id, t: `De ${c.nombre.split(" ")[0]}` })),
    { v: "dos", t: companeros.length ? "De los dos" : "Del equipo" },
    { v: "privada", t: "Privada" }
  ];
  return (
    <fieldset>
      <legend className="etiqueta">Para quién · {equipo.nombre}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={valor === o.v}
            onClick={() => onCambio(o.v)}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
              valor === o.v ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {valor === "privada" ? "Solo tú la ves." : valor === "dos" ? "Les sale a los dos en su día." : "La ven los dos en el tablero."}
      </p>
    </fieldset>
  );
}

// Valor inicial del selector a partir de una tarea guardada.
export function paraDe(t: { equipo_id?: string | null; asignada_a?: string | null }, yo: string): Para {
  if (!t.equipo_id) return "privada";
  if (!t.asignada_a) return "dos";
  return t.asignada_a === yo ? "yo" : t.asignada_a;
}
