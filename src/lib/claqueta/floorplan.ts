// Floor plan (plano de planta): el set visto desde arriba, uno por escena.
// Se guarda como una lista de elementos en floor_plans.elementos (0027).
// Coordenadas en unidades del lienzo (ANCHO × ALTO); un cuadro de la
// cuadrícula (CUADRO) son unos 50 cm. Los ángulos van en grados, 0 = a la
// derecha y crecen en el sentido del reloj (como el SVG, con la y hacia abajo).

// 20 × 15 cuadros (unos 10 × 7.5 m): cabe un set normal y en el celular las
// cosas no quedan tan chiquitas.
export const ANCHO = 800;
export const ALTO = 600;
export const CUADRO = 40;
export const MAX_ELEMENTOS = 200;

export const TIPOS = ["personaje", "camara", "luz", "mueble", "pared", "puerta", "flecha"] as const;
export type TipoElemento = (typeof TIPOS)[number];
// Los que se dibujan como línea (de x,y a x2,y2).
export const ES_LINEA: Record<TipoElemento, boolean> = { personaje: false, camara: false, luz: false, mueble: false, pared: true, puerta: true, flecha: true };

export type Elemento = {
  id: string;
  tipo: TipoElemento;
  x: number;
  y: number;
  rot: number;
  etiqueta: string;
  // Mueble: ancho y fondo.
  w?: number;
  h?: number;
  // Pared, puerta y flecha: el otro extremo.
  x2?: number;
  y2?: number;
  // Cámara: número de toma (plano) y apertura del cuadro en grados.
  numero?: number | null;
  fov?: number;
  // Flecha: movimiento de actor (línea continua) o de cámara (punteada).
  de?: "actor" | "camara";
};

export const APERTURAS = [
  { v: 80, t: "Angular" },
  { v: 50, t: "Normal" },
  { v: 25, t: "Tele" }
];

const ID = /^[a-z0-9-]{1,40}$/i;
const r1 = (n: number) => Math.round(n * 10) / 10;
const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const esNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Grados entre 0 y 359.9.
export const normalizarGrados = (g: number) => r1(((g % 360) + 360) % 360);
export const rotar = (rot: number, delta: number) => normalizarGrados(rot + delta);

// Revisa lo que llega del navegador antes de guardar: forma, tipos, rangos y
// largo de textos. Devuelve una copia limpia (sin campos de más).
export function validarElementos(raw: unknown): { ok: true; elementos: Elemento[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "El floor plan no tiene la forma correcta." };
  if (raw.length > MAX_ELEMENTOS) return { ok: false, error: `Máximo ${MAX_ELEMENTOS} elementos por escena.` };
  const ids = new Set<string>();
  const out: Elemento[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, error: "Hay un elemento que no se entiende." };
    const e = x as Record<string, unknown>;
    if (typeof e.id !== "string" || !ID.test(e.id) || ids.has(e.id)) return { ok: false, error: "Hay un elemento con identificador repetido o raro." };
    ids.add(e.id);
    if (typeof e.tipo !== "string" || !(TIPOS as readonly string[]).includes(e.tipo)) return { ok: false, error: "Hay un elemento de un tipo que no existe." };
    const tipo = e.tipo as TipoElemento;
    if (!esNum(e.x) || !esNum(e.y)) return { ok: false, error: "Hay un elemento sin posición." };
    const etiqueta = typeof e.etiqueta === "string" ? e.etiqueta.trim() : "";
    if (etiqueta.length > 40) return { ok: false, error: "Los nombres van de máximo 40 letras." };
    const limpio: Elemento = {
      id: e.id,
      tipo,
      x: r1(limitar(e.x, 0, ANCHO)),
      y: r1(limitar(e.y, 0, ALTO)),
      rot: esNum(e.rot) ? normalizarGrados(e.rot) : 0,
      etiqueta
    };
    if (ES_LINEA[tipo]) {
      if (!esNum(e.x2) || !esNum(e.y2)) return { ok: false, error: "Hay una línea sin su otro extremo." };
      limpio.x2 = r1(limitar(e.x2, 0, ANCHO));
      limpio.y2 = r1(limitar(e.y2, 0, ALTO));
      if (tipo === "flecha") limpio.de = e.de === "camara" ? "camara" : "actor";
    }
    if (tipo === "mueble") {
      limpio.w = r1(limitar(esNum(e.w) ? e.w : 80, 10, 600));
      limpio.h = r1(limitar(esNum(e.h) ? e.h : 60, 10, 600));
    }
    if (tipo === "camara") {
      if (e.numero !== undefined && e.numero !== null && (!Number.isInteger(e.numero) || (e.numero as number) < 1 || (e.numero as number) > 999)) return { ok: false, error: "El número de toma de la cámara va de 1 a 999." };
      limpio.numero = (e.numero as number | null | undefined) ?? null;
      limpio.fov = r1(limitar(esNum(e.fov) ? e.fov : 50, 10, 120));
    }
    out.push(limpio);
  }
  return { ok: true, elementos: out };
}

// Número para una cámara nueva: la primera toma de la escena que aún no tiene
// cámara dibujada; si todas tienen, la que sigue de la más alta.
export function siguienteNumeroCamara(elementos: Pick<Elemento, "tipo" | "numero">[], tomas: number[]): number {
  const usados = new Set(elementos.filter((e) => e.tipo === "camara" && e.numero).map((e) => e.numero as number));
  const libre = [...new Set(tomas)].sort((a, b) => a - b).find((n) => !usados.has(n));
  if (libre !== undefined) return libre;
  return Math.max(0, ...usados, ...tomas) + 1;
}

// Personajes sugeridos para la escena: los que hablan en ella y, si no hay
// (el equipo sin acceso al guion completo), el reparto del proyecto. Sin los
// que ya están en el plano.
export function personajesSugeridos(deEscena: string[], reparto: string[], elementos: Pick<Elemento, "tipo" | "etiqueta">[]): string[] {
  const ya = new Set(elementos.filter((e) => e.tipo === "personaje").map((e) => e.etiqueta.trim().toUpperCase()));
  const base = deEscena.length ? deEscena : reparto;
  return [...new Set(base.map((p) => p.trim()).filter(Boolean))].filter((p) => !ya.has(p.toUpperCase()));
}

// Punta de un elemento girado (para el asa de giro, la nariz o la lente).
export function punta(x: number, y: number, rot: number, distancia: number) {
  const a = (rot * Math.PI) / 180;
  return { x: x + Math.cos(a) * distancia, y: y + Math.sin(a) * distancia };
}

// Ángulo (grados) desde un punto hacia otro: para girar arrastrando el asa.
export const anguloHacia = (x: number, y: number, hx: number, hy: number) => normalizarGrados((Math.atan2(hy - y, hx - x) * 180) / Math.PI);

// Imán a la cuadrícula (medio cuadro), para que las cosas queden alineadas.
export const alinear = (v: number, paso = CUADRO / 2) => Math.round(v / paso) * paso;
