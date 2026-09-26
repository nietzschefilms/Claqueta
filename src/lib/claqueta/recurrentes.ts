import { sumarDias } from "./fechas";
import type { Tarea } from "./tipos";

// Al completar una tarea que se repite nace la siguiente:
//  · Semanal: a +7 días contando desde su fecha (así "revisar errores de RT"
//    sigue cayendo en miércoles). Sin fecha, desde el día en que se completó.
//  · Diaria: al día siguiente de su fecha, pero nunca antes de hoy. Si se
//    completa tarde la de ayer, la siguiente es la de hoy (no se acumulan).
export function siguienteRepeticion(t: Tarea, hoy: string) {
  if (t.repeat !== "weekly" && t.repeat !== "daily") return null;
  const base = t.due_date ?? hoy;
  let due = sumarDias(base, t.repeat === "weekly" ? 7 : 1);
  if (t.repeat === "daily" && due < hoy) due = hoy;
  return {
    title: t.title,
    area: t.area,
    due_date: due,
    est_minutes: t.est_minutes,
    impact: t.impact,
    status: "pendiente" as const,
    repeat: t.repeat,
    notes: t.notes,
    milestone_id: null
  };
}

export const ETIQUETA_REPETICION = { none: "", daily: "diaria", weekly: "semanal" } as const;
