// Avisos de rutina: 5 minutos antes de cada bloque y al empezar (cambio de actividad).
// El cron corre cada minuto; la ventana tolera que una corrida llegue tarde y
// la clave evita mandar el mismo aviso dos veces.
import { minutosAHora } from "./fechas";
import type { BloquePlaneado } from "./planeador";

export const MINUTOS_ANTES = 5;

export type AvisoRutina = { clave: string; titulo: string; cuerpo: string };

export function avisosRutina(bloques: BloquePlaneado[], ahora: number, hoy: string): AvisoRutina[] {
  const out: AvisoRutina[] = [];
  for (const bp of bloques) {
    const faltan = bp.inicio - ahora;
    const pendientes = bp.tareas.filter((t) => t.status !== "hecho");
    const queToca = pendientes.length ? `Toca: ${pendientes[0].title}${pendientes.length > 1 ? ` (+${pendientes.length - 1})` : ""}` : "";
    const horario = `${minutosAHora(bp.inicio)} a ${minutosAHora(bp.fin)}`;

    if (faltan > 0 && faltan <= MINUTOS_ANTES) {
      out.push({
        clave: `${hoy}:${bp.bloque.id}:antes`,
        titulo: `En ${faltan} min: ${bp.bloque.label}`,
        cuerpo: [horario, queToca].filter(Boolean).join(" · ")
      });
    }
    // Al empezar (hasta 2 min tarde por si el cron se retrasó).
    if (faltan <= 0 && faltan > -3) {
      out.push({
        clave: `${hoy}:${bp.bloque.id}:ahora`,
        titulo: `Ahora: ${bp.bloque.label}`,
        cuerpo: [`Hasta las ${minutosAHora(bp.fin)}`, queToca].filter(Boolean).join(" · ")
      });
    }
  }
  return out;
}
