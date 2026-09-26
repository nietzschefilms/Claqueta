// Los seis frentes de Claqueta. El peso multiplica el puntaje de prioridad:
// EK Bars manda porque es el único con riesgo real de quedar mal.
// Los ids coinciden con los checks de la migración 0002.

export const FRENTE_IDS = ["ek", "escuela", "topmart", "rt", "nietzsche", "personal"] as const;
export type FrenteId = (typeof FRENTE_IDS)[number];

export type Frente = {
  id: FrenteId;
  nombre: string;
  corto: string;
  peso: number;
  // Palabras que delatan el frente cuando se captura texto suelto.
  claves: string[];
};

export const FRENTES: Record<FrenteId, Frente> = {
  ek: { id: "ek", nombre: "EK Bars", corto: "EK", peso: 1.3, claves: ["ek", "ek bars", "kickoff", "coaches", "membresía", "reservas"] },
  escuela: { id: "escuela", nombre: "Escuela", corto: "Escuela", peso: 1.2, claves: ["escuela", "clase", "tarea", "temario", "examen", "profe", "cine"] },
  topmart: { id: "topmart", nombre: "Top Mart", corto: "Top Mart", peso: 1.15, claves: ["top mart", "topmart", "reel", "reels"] },
  rt: { id: "rt", nombre: "Rompiendo Tabúes", corto: "RT", peso: 1.0, claves: ["rt", "rompiendo", "tabúes", "tabues", "instagram"] },
  nietzsche: { id: "nietzsche", nombre: "Nietzsche Studios", corto: "Nietzsche", peso: 0.8, claves: ["nietzsche", "erik", "spot", "grabar", "rodaje"] },
  personal: { id: "personal", nombre: "Personal", corto: "Personal", peso: 0.9, claves: ["trámite", "tramite", "banco", "doctor", "casa", "gastos"] }
};

export const LISTA_FRENTES: Frente[] = FRENTE_IDS.map((id) => FRENTES[id]);

export function esFrente(v: unknown): v is FrenteId {
  return typeof v === "string" && (FRENTE_IDS as readonly string[]).includes(v);
}

// Variable CSS con el color del frente (definido en globals.css).
export function colorFrente(id: FrenteId): string {
  return `var(--c-f-${id})`;
}
