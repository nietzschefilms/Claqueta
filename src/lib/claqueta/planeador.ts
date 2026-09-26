import { fechaCDMX, horaAMinutos } from "./fechas";
import { ordenarPorPuntaje } from "./prioridad";
import type { Bloque, Tarea } from "./tipos";

export type BloquePlaneado = {
  bloque: Bloque;
  inicio: number; // minutos desde medianoche
  fin: number;
  capacidad: number;
  usados: number;
  flex: boolean;
  tareas: Tarea[];
};

export type PlanDia = {
  bloques: BloquePlaneado[]; // todos los del día, en orden de hora (fijos incluidos)
  noCupo: Tarea[]; // vencido o de hoy que no entró en ningún bloque
  hechasFuera: Tarea[]; // completadas hoy que no quedaron en un bloque
};

function hechaHoy(t: Tarea, hoy: string): boolean {
  return t.status === "hecho" && !!t.done_at && fechaCDMX(t.done_at) === hoy;
}

// Arma el día:
// 1. Los bloques focus de frente específico se llenan primero; los flex
//    (focus sin frentes) al final, con lo que sobre de cualquier frente.
// 2. Dentro de cada bloque entran las tareas de mayor puntaje que quepan.
//    Lo completado hoy se acomoda antes para que no se mueva de lugar al
//    tacharlo. Una tarea más larga que el bloque entero entra sola si el
//    bloque está vacío (si no, nunca aparecería).
// 3. Lo vencido o de hoy que no cupo sale en "No cupo hoy".
export function planearDia(bloquesDelDia: Bloque[], tareas: Tarea[], hoy: string): PlanDia {
  const bloques: BloquePlaneado[] = [...bloquesDelDia]
    .sort((a, b) => horaAMinutos(a.start_time) - horaAMinutos(b.start_time))
    .map((b) => {
      const inicio = horaAMinutos(b.start_time);
      const fin = horaAMinutos(b.end_time);
      return {
        bloque: b,
        inicio,
        fin,
        capacidad: b.kind === "focus" ? fin - inicio : 0,
        usados: 0,
        flex: b.kind === "focus" && b.areas.length === 0,
        tareas: []
      };
    });

  const hechas = tareas
    .filter((t) => hechaHoy(t, hoy))
    .sort((a, b) => (a.done_at! < b.done_at! ? -1 : 1));
  const pendientes = ordenarPorPuntaje(
    tareas.filter((t) => t.status !== "hecho"),
    hoy
  );
  const candidatas = [...hechas, ...pendientes];
  const asignadas = new Set<string>();

  const llenar = (bp: BloquePlaneado) => {
    for (const t of candidatas) {
      if (asignadas.has(t.id)) continue;
      if (!bp.flex && !bp.bloque.areas.includes(t.area)) continue;
      const libre = bp.capacidad - bp.usados;
      if (t.est_minutes <= libre || (bp.usados === 0 && t.est_minutes > bp.capacidad)) {
        bp.tareas.push(t);
        bp.usados = Math.min(bp.capacidad, bp.usados + t.est_minutes);
        asignadas.add(t.id);
      }
      if (bp.usados >= bp.capacidad) break;
    }
  };

  const focus = bloques.filter((b) => b.bloque.kind === "focus");
  focus.filter((b) => !b.flex).forEach(llenar);
  focus.filter((b) => b.flex).forEach(llenar);

  const noCupo = pendientes.filter((t) => !asignadas.has(t.id) && t.due_date !== null && t.due_date <= hoy);
  const hechasFuera = hechas.filter((t) => !asignadas.has(t.id));

  return { bloques, noCupo, hechasFuera };
}

// Las 3 de hoy: lo más importante que sigue pendiente.
export function lasTresDeHoy(tareas: Tarea[], hoy: string): Tarea[] {
  return ordenarPorPuntaje(
    tareas.filter((t) => t.status !== "hecho"),
    hoy
  ).slice(0, 3);
}
