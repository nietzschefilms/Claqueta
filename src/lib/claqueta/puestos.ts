// Puestos dentro de un proyecto del Estudio y lo que deja hacer cada uno.
// La base (0017) aplica las mismas reglas con RLS; esto solo decide qué se ve.

export const PUESTOS = [
  { v: "productor", t: "Productor" },
  { v: "director", t: "Director" },
  { v: "asistente_direccion", t: "Asistente de dirección" },
  { v: "fotografia", t: "Director de fotografía" },
  { v: "asistente_camara", t: "Asistente de cámara" },
  { v: "sonido", t: "Sonido" },
  { v: "arte", t: "Arte" },
  { v: "vestuario", t: "Vestuario" },
  { v: "maquillaje", t: "Maquillaje" },
  { v: "edicion", t: "Edición" },
  { v: "produccion", t: "Asistente de producción" },
  { v: "otro", t: "Otro" }
] as const;
export type Puesto = (typeof PUESTOS)[number]["v"];

export const esPuesto = (v: unknown): v is Puesto => typeof v === "string" && PUESTOS.some((p) => p.v === v);
export const nombrePuesto = (v: string) => PUESTOS.find((p) => p.v === v)?.t ?? v;

export type Permisos = {
  // Guion completo, desglose, plan de rodaje, gente, llamados y plan minuto a minuto.
  direccion: boolean;
  // Lista de planos (shotlist) y storyboard.
  planos: boolean;
  // Presupuesto, precio y quién tiene qué puesto.
  productor: boolean;
};

const DIRECCION: Puesto[] = ["productor", "director", "asistente_direccion"];

export function permisosDe(puestos: readonly string[], esAdmin: boolean): Permisos {
  if (esAdmin) return { direccion: true, planos: true, productor: true };
  const tiene = (lista: Puesto[]) => puestos.some((p) => lista.includes(p as Puesto));
  return {
    direccion: tiene(DIRECCION),
    planos: tiene([...DIRECCION, "fotografia"]),
    productor: tiene(["productor"])
  };
}

// Lo que todo proyecto necesita antes de filmar. Se carga al crear el proyecto.
export const AVANCE_BASE = [
  "Guion",
  "Desglose (breakdown)",
  "Shotlist",
  "Storyboard",
  "Casting y reparto",
  "Crew completo",
  "Locaciones",
  "Permisos",
  "Equipo de cámara, luz y sonido",
  "Arte, vestuario y maquillaje",
  "Plan de rodaje",
  "Hojas de llamado",
  "Edición",
  "Entrega al cliente"
];

// ─── Plan minuto a minuto ────────────────────────────────────────────────
export type BloquePlan = {
  id: string;
  inicio: string; // "HH:MM" o "HH:MM:SS", hora de CDMX
  minutos: number;
  estado: "pendiente" | "en_curso" | "hecho";
  empezo: number | null; // minuto del día (CDMX) en que empezó de verdad
  termino: number | null; // minuto del día (CDMX) en que terminó de verdad
};

const aMin = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return a * 60 + b;
};

// ¿Cómo vamos? Minutos de atraso (+) o de adelanto (-) contra lo planeado.
// Mira el bloque que está corriendo; si ninguno corre, el último terminado;
// si nada ha empezado y ya pasó la hora del primero, cuenta desde ahí.
export function ritmoDelDia(bloques: BloquePlan[], ahora: number): { minutos: number; actual: string | null; siguiente: string | null } | null {
  const orden = [...bloques].sort((a, b) => aMin(a.inicio) - aMin(b.inicio));
  if (!orden.length) return null;
  const enCurso = orden.find((b) => b.estado === "en_curso");
  const siguiente = (id: string | null) => {
    const i = id ? orden.findIndex((b) => b.id === id) : -1;
    return orden.slice(i + 1).find((b) => b.estado === "pendiente")?.id ?? null;
  };
  if (enCurso) {
    const plan = aMin(enCurso.inicio);
    const inicioReal = enCurso.empezo ?? ahora;
    // Si ya se pasó de su duración, el atraso crece con el reloj.
    const porFin = ahora - (plan + enCurso.minutos);
    return { minutos: Math.max(inicioReal - plan, porFin), actual: enCurso.id, siguiente: siguiente(enCurso.id) };
  }
  const hechos = orden.filter((b) => b.estado === "hecho" && b.termino !== null);
  if (hechos.length) {
    const ult = hechos.reduce((a, b) => ((b.termino ?? 0) > (a.termino ?? 0) ? b : a));
    const sig = siguiente(ult.id);
    const finPlan = aMin(ult.inicio) + ult.minutos;
    let atraso = (ult.termino ?? 0) - finPlan;
    // Esperando el siguiente: si ya pasó su hora, también es atraso.
    const b = sig ? orden.find((x) => x.id === sig) : null;
    if (b && ahora > aMin(b.inicio)) atraso = Math.max(atraso, ahora - aMin(b.inicio));
    return { minutos: atraso, actual: null, siguiente: sig };
  }
  const primero = orden[0];
  return { minutos: Math.max(0, ahora - aMin(primero.inicio)), actual: null, siguiente: primero.id };
}

// "A tiempo" con 5 minutos de margen.
export function textoRitmo(minutos: number): { texto: string; tono: "ok" | "aviso" | "rojo" } {
  if (Math.abs(minutos) <= 5) return { texto: "Vamos a tiempo", tono: "ok" };
  const m = Math.abs(minutos);
  const cuanto = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
  if (minutos < 0) return { texto: `Vamos ${cuanto} adelantados`, tono: "ok" };
  return { texto: `Vamos ${cuanto} atrasados`, tono: minutos > 20 ? "rojo" : "aviso" };
}
