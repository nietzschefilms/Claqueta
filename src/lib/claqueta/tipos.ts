import type { FrenteId } from "./frentes";

export type Estado = "pendiente" | "haciendo" | "hecho";

export type Tarea = {
  id: string;
  title: string;
  area: FrenteId;
  due_date: string | null;
  est_minutes: number;
  impact: 1 | 2 | 3;
  status: Estado;
  done_at: string | null;
  repeat: "none" | "daily" | "weekly";
  notes: string | null;
  milestone_id: string | null;
  created_at?: string;
  materia?: string | null;
  dificultad?: 1 | 2 | 3 | null;
  // Tareas de equipo (Nietzsche): quién la creó, de qué equipo y a quién le toca.
  user_id?: string;
  equipo_id?: string | null;
  asignada_a?: string | null;
};

export type Bloque = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  label: string;
  kind: "fixed" | "focus";
  areas: FrenteId[];
  // Solo clases.
  salon?: string | null;
  piso?: string | null;
  profesor?: string | null;
  clave?: string | null;
};

export const esClase = (b: Pick<Bloque, "salon">) => !!b.salon;

// "Sala de cine, piso 2" (sin piso si no se ha puesto).
export function lugarClase(b: Pick<Bloque, "salon" | "piso">): string {
  return [b.salon, b.piso ? `piso ${b.piso}` : null].filter(Boolean).join(", ");
}

export type Hito = {
  id: string;
  project: string;
  week: number;
  title: string;
  done: boolean;
  done_at: string | null;
};
