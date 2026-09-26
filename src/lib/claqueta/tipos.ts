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
  repeat: "none" | "weekly";
  notes: string | null;
  milestone_id: string | null;
  created_at?: string;
  materia?: string | null;
  dificultad?: 1 | 2 | 3 | null;
};

export type Bloque = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  label: string;
  kind: "fixed" | "focus";
  areas: FrenteId[];
};

export type Hito = {
  id: string;
  project: string;
  week: number;
  title: string;
  done: boolean;
  done_at: string | null;
};
