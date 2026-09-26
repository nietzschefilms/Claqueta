import { sumarDias } from "./fechas";
import type { Tarea } from "./tipos";

// Al completar una tarea semanal nace la siguiente a +7 días, contando desde
// su fecha (así "revisar errores de RT" sigue cayendo en miércoles).
// Sin fecha, se cuenta desde el día en que se completó.
export function siguienteRepeticion(t: Tarea, hoy: string) {
  if (t.repeat !== "weekly") return null;
  return {
    title: t.title,
    area: t.area,
    due_date: sumarDias(t.due_date ?? hoy, 7),
    est_minutes: t.est_minutes,
    impact: t.impact,
    status: "pendiente" as const,
    repeat: "weekly" as const,
    notes: t.notes,
    milestone_id: null
  };
}
