// LINEAMIENTOS de una tarea (ejercicio de la escuela): se pegan como texto y
// se vuelven una lista. Lo que se puede revisar contra el shotlist se revisa
// solo; lo demás queda como casilla para palomear a mano.

export const CATEGORIAS_PROYECTO = [
  { v: "estudiantil", t: "Estudiantil / tarea" },
  { v: "comercial", t: "Comercial" },
  { v: "distribucion", t: "Distribución" },
  { v: "personal", t: "Personal" }
] as const;
export type CategoriaProyecto = (typeof CATEGORIAS_PROYECTO)[number]["v"];
export const nombreCategoria = (v: string | null | undefined) => CATEGORIAS_PROYECTO.find((c) => c.v === v)?.t ?? null;

export type Regla = "manual" | "max_planos" | "movimientos" | "incluye_pov" | "incluye_insert" | "incluye_over";
export type Lineamiento = { texto: string; regla: Regla; valor: { max?: number; permitidos?: string[]; prohibidos?: string[] } | null };

const MOV: [RegExp, string][] = [
  [/\bzoom\b/i, "Zoom"],
  [/\bdolly\b/i, "Dolly"],
  [/c[aá]mara en mano|\bmano\b|handheld/i, "Mano"],
  [/travel+ing/i, "Travelling"],
  [/steadicam/i, "Steadicam"],
  [/gimbal/i, "Gimbal"],
  [/\bdron\b|\bdrone\b/i, "Dron"],
  [/gr[uú]a/i, "Grúa"],
  [/\bpan(ning|eo)?\b|paneo/i, "Paneo"],
  [/\btilt\b/i, "Tilt"]
];
const movimientosEn = (t: string) => MOV.filter(([re]) => re.test(t)).map(([, m]) => m);

// Parte el texto en renglones con sentido: quita numeración y viñetas, une
// los cortes de línea del PDF y descarta títulos vacíos.
export function partirLineamientos(texto: string): string[] {
  const renglones = texto
    .replace(/\r/g, "")
    .split(/\n(?=\s*(?:\d+[.)]|[a-z]\)|[-•*])\s)|(?<=[.:])\s*\n|\n{2,}/i)
    .map((r) => r.replace(/\s*\n\s*/g, " ").replace(/^\s*(?:\d+[.)]|[a-z]\)|[-•*])\s*/i, "").trim())
    // Fuera los títulos de sección ("Aplicación de correspondientes:").
    .filter((r) => r.length >= 4 && !/:$/.test(r));
  return renglones.slice(0, 40);
}

export function leerLineamiento(texto: string): Lineamiento {
  const t = texto.trim();
  const max = t.match(/(\d{1,3})\s*(?:tomas|planos)\s*(?:como\s*)?m[aá]x/i) ?? t.match(/m[aá]x(?:imo)?\s*(?:de\s*)?(\d{1,3})\s*(?:tomas|planos)/i);
  if (max) return { texto: t, regla: "max_planos", valor: { max: Number(max[1]) } };
  if (/[uú]nicos movimientos|movimientos? permitidos?|solo (?:se permite|paneo|panning)/i.test(t)) {
    const permitidos = movimientosEn(t);
    if (permitidos.length) return { texto: t, regla: "movimientos", valor: { permitidos: [...new Set(["Fijo", ...permitidos])] } };
  }
  if (/\bno (?:usar|se permite)|prohibid|\bsin (?:zoom|dolly)/i.test(t)) {
    const prohibidos = movimientosEn(t);
    if (prohibidos.length) return { texto: t, regla: "movimientos", valor: { prohibidos } };
  }
  if (/\bp\.?o\.?v\.?\b|subjetiva/i.test(t)) return { texto: t, regla: "incluye_pov", valor: null };
  if (/\binsert/i.test(t)) return { texto: t, regla: "incluye_insert", valor: null };
  if (/over[- ]?shoulder|sobre el hombro/i.test(t)) return { texto: t, regla: "incluye_over", valor: null };
  return { texto: t, regla: "manual", valor: null };
}

type PlanoRevisable = { tamano: string | null; angulo: string | null; movimiento: string | null; descripcion: string };

// ¿Se cumple? true / false, o null si se palomea a mano.
export function revisar(l: Pick<Lineamiento, "regla" | "valor">, planos: PlanoRevisable[]): { ok: boolean | null; detalle: string } {
  const txt = (p: PlanoRevisable) => `${p.angulo ?? ""} ${p.descripcion ?? ""}`;
  switch (l.regla) {
    case "max_planos": {
      const max = l.valor?.max ?? 0;
      return { ok: planos.length > 0 && planos.length <= max, detalle: `${planos.length} de ${max} planos` };
    }
    case "movimientos": {
      const malos = planos.filter((p) => {
        if (!p.movimiento) return false;
        if (l.valor?.permitidos?.length) return !l.valor.permitidos.includes(p.movimiento);
        return !!l.valor?.prohibidos?.includes(p.movimiento);
      });
      return { ok: planos.length > 0 && malos.length === 0, detalle: malos.length ? `${malos.length} plano${malos.length > 1 ? "s" : ""} con movimiento no permitido` : planos.length ? "Todos los movimientos valen" : "Aún no hay planos" };
    }
    case "incluye_pov": {
      const n = planos.filter((p) => /\bp\.?o\.?v\.?\b|subjetiv/i.test(txt(p))).length;
      return { ok: n > 0, detalle: n ? `${n} plano${n > 1 ? "s" : ""} POV` : "Ningún plano dice POV o subjetiva" };
    }
    case "incluye_insert": {
      const n = planos.filter((p) => p.tamano === "INSERT" || /\binsert/i.test(txt(p))).length;
      return { ok: n > 0, detalle: n ? `${n} insert` : "Ningún plano es insert" };
    }
    case "incluye_over": {
      const n = planos.filter((p) => /over[- ]?shoulder|\bo\.?s\.?\b|sobre el hombro/i.test(txt(p))).length;
      return { ok: n >= 2, detalle: n ? `${n} over-shoulder (van en pareja)` : "Ningún plano over-shoulder" };
    }
    default:
      return { ok: null, detalle: "" };
  }
}
