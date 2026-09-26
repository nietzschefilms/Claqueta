import { diasEntre } from "./fechas";
import { FRENTES } from "./frentes";
import type { Tarea } from "./tipos";

export type Etiqueta = "Crítico" | "Alta" | "Media" | "Baja";

// Urgencia por fecha: vencida 100, hoy 80, mañana 60, 2 a 3 días 45,
// 4 a 7 días 30, más lejos 15, sin fecha 10. "haciendo" suma 10.
export function urgencia(t: Pick<Tarea, "due_date" | "status">, hoy: string): number {
  let u: number;
  if (!t.due_date) u = 10;
  else {
    const d = diasEntre(hoy, t.due_date);
    if (d < 0) u = 100;
    else if (d === 0) u = 80;
    else if (d === 1) u = 60;
    else if (d <= 3) u = 45;
    else if (d <= 7) u = 30;
    else u = 15;
  }
  return t.status === "haciendo" ? u + 10 : u;
}

// puntaje = (urgencia + impacto × 8) × peso del frente
export function puntaje(t: Pick<Tarea, "due_date" | "status" | "impact" | "area">, hoy: string): number {
  const bruto = (urgencia(t, hoy) + t.impact * 8) * FRENTES[t.area].peso;
  return Math.round(bruto * 100) / 100;
}

export function etiqueta(p: number): Etiqueta {
  if (p >= 90) return "Crítico";
  if (p >= 60) return "Alta";
  if (p >= 35) return "Media";
  return "Baja";
}

// Ordena de mayor a menor puntaje. Empate: vence antes, luego más corta.
export function ordenarPorPuntaje<T extends Tarea>(tareas: T[], hoy: string): T[] {
  return [...tareas].sort((a, b) => {
    const dp = puntaje(b, hoy) - puntaje(a, hoy);
    if (dp !== 0) return dp;
    const fa = a.due_date ?? "9999-12-31";
    const fb = b.due_date ?? "9999-12-31";
    if (fa !== fb) return fa < fb ? -1 : 1;
    return a.est_minutes - b.est_minutes;
  });
}
