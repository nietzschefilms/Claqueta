import { diasEntre, sumarDias } from "./fechas";
import type { Hito } from "./tipos";

// Contrato de EK Bars: 12 semanas desde el 25 de septiembre de 2026.
export const EK_INICIO = "2026-09-25";
export const EK_SEMANAS = 12;
export const EK_ENTREGA = "2026-12-18";

export type Semaforo = "en-tiempo" | "atras-1" | "atras-2";

// Semana en curso: 0 antes de arrancar, 1 a 12 durante (el día de entrega
// cuenta como semana 12) y 13 cuando ya pasó la entrega.
export function semanaEK(hoy: string, inicio = EK_INICIO): number {
  const d = diasEntre(inicio, hoy);
  if (d < 0) return 0;
  if (d > EK_SEMANAS * 7) return EK_SEMANAS + 1;
  return Math.min(EK_SEMANAS, Math.floor(d / 7) + 1);
}

// Fechas que abarca la semana N (inicio y fin).
export function rangoSemana(n: number, inicio = EK_INICIO): { desde: string; hasta: string } {
  const desde = sumarDias(inicio, (n - 1) * 7);
  return { desde, hasta: sumarDias(desde, 6) };
}

export type RiesgoEK = {
  semana: number;
  hechos: number;
  total: number;
  // Semanas de retraso: hitos que ya debían estar (semanas cerradas) menos hechos.
  atraso: number;
  semaforo: Semaforo;
  texto: string;
  avance: number; // 0 a 1, hitos hechos
  tiempo: number; // 0 a 1, semanas transcurridas
};

export function riesgoEK(hitos: Pick<Hito, "done" | "week">[], hoy: string, inicio = EK_INICIO): RiesgoEK {
  const semana = semanaEK(hoy, inicio);
  const total = hitos.length || EK_SEMANAS;
  const hechos = hitos.filter((h) => h.done).length;
  const debidos = hitos.filter((h) => h.week < semana).length;
  const atraso = Math.max(0, debidos - hechos);
  const semaforo: Semaforo = atraso === 0 ? "en-tiempo" : atraso === 1 ? "atras-1" : "atras-2";
  const texto = atraso === 0 ? "En tiempo" : atraso === 1 ? "1 semana atrás" : `${atraso} semanas atrás`;
  const transcurridos = Math.min(EK_SEMANAS * 7, Math.max(0, diasEntre(inicio, hoy) + 1));
  return {
    semana,
    hechos,
    total,
    atraso,
    semaforo,
    texto,
    avance: hechos / total,
    tiempo: transcurridos / (EK_SEMANAS * 7)
  };
}
