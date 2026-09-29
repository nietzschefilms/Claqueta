// Producción tipo Movie Magic: presupuesto (topsheet), Day Out of Days e IDs de reparto.
// Dinero en centavos enteros, igual que el resto de Claqueta.

import { aCentavos } from "./dinero";
import type { Escena } from "./estudio";

// ─── Presupuesto ─────────────────────────────────────────────────────────
export type Grupo = "atl" | "rodaje" | "post" | "otros";
export const GRUPOS: { v: Grupo; t: string; d: string }[] = [
  { v: "atl", t: "Arriba de la línea", d: "Guion, dirección, producción y reparto" },
  { v: "rodaje", t: "Rodaje", d: "Crew, equipo, arte, locaciones y logística" },
  { v: "post", t: "Postproducción", d: "Edición, color, sonido, música y gráficos" },
  { v: "otros", t: "Otros", d: "Seguros, materiales y varios" }
];

export const CUENTAS: { cuenta: string; nombre: string }[] = [
  { cuenta: "1100", nombre: "Guion" },
  { cuenta: "1200", nombre: "Dirección" },
  { cuenta: "1300", nombre: "Producción" },
  { cuenta: "1400", nombre: "Reparto y talento" },
  { cuenta: "2100", nombre: "Staff de producción" },
  { cuenta: "2200", nombre: "Cámara" },
  { cuenta: "2300", nombre: "Iluminación y grip" },
  { cuenta: "2400", nombre: "Arte y utilería" },
  { cuenta: "2500", nombre: "Vestuario y maquillaje" },
  { cuenta: "2600", nombre: "Sonido directo" },
  { cuenta: "2700", nombre: "Locaciones y permisos" },
  { cuenta: "2800", nombre: "Transporte" },
  { cuenta: "2900", nombre: "Alimentos" },
  { cuenta: "4100", nombre: "Edición" },
  { cuenta: "4200", nombre: "Corrección de color" },
  { cuenta: "4300", nombre: "Música y licencias" },
  { cuenta: "4400", nombre: "Diseño sonoro y mezcla" },
  { cuenta: "4500", nombre: "Gráficos y VFX" },
  { cuenta: "5100", nombre: "Seguros" },
  { cuenta: "5200", nombre: "Materiales y discos" },
  { cuenta: "5300", nombre: "Varios" }
];
export const nombreCuenta = (c: string) => CUENTAS.find((x) => x.cuenta === c)?.nombre ?? `Cuenta ${c}`;

export function grupoDe(cuenta: string): Grupo {
  const d = cuenta[0];
  return d === "1" ? "atl" : d === "2" || d === "3" ? "rodaje" : d === "4" ? "post" : "otros";
}

export type LineaPresupuesto = {
  id: string;
  cuenta: string;
  descripcion: string;
  cantidad: number | string;
  unidad: string;
  veces: number | string;
  tarifa: number | string;
  real: number | string | null;
};

const cent = (v: number | string | null | undefined) => (v === null || v === undefined || Number(v) === 0 ? 0 : aCentavos(v) ?? 0);
const centesimas = (v: number | string) => Math.round(Number(v) * 100);

// cantidad × veces × tarifa, sin errores de punto flotante.
export function totalLinea(l: Pick<LineaPresupuesto, "cantidad" | "veces" | "tarifa">): number {
  return Math.round((cent(l.tarifa) * centesimas(l.cantidad) * centesimas(l.veces)) / 10000);
}

export type Topsheet = {
  porCuenta: { cuenta: string; nombre: string; grupo: Grupo; total: number; real: number }[];
  porGrupo: Record<Grupo, number>;
  directo: number;
  imprevistos: number;
  costo: number;
  utilidad: number;
  precioSugerido: number;
  iva: number;
  totalConIva: number;
  real: number;
  // Contra el precio cerrado con el cliente (sin IVA).
  precio: number | null;
  margen: number | null;
  margenPct: number | null;
};

const pct = (base: number, p: number | string) => Math.round((base * Math.round(Number(p) * 100)) / 10000);

export function topsheet(lineas: LineaPresupuesto[], opciones: { imprevistos_pct: number | string; utilidad_pct: number | string; con_iva: boolean; precio_cliente: number | string | null }): Topsheet {
  const mapa = new Map<string, { total: number; real: number }>();
  for (const l of lineas) {
    const x = mapa.get(l.cuenta) ?? { total: 0, real: 0 };
    x.total += totalLinea(l);
    x.real += cent(l.real);
    mapa.set(l.cuenta, x);
  }
  const porCuenta = [...mapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cuenta, v]) => ({ cuenta, nombre: nombreCuenta(cuenta), grupo: grupoDe(cuenta), ...v }));
  const porGrupo: Record<Grupo, number> = { atl: 0, rodaje: 0, post: 0, otros: 0 };
  for (const c of porCuenta) porGrupo[c.grupo] += c.total;
  const directo = porCuenta.reduce((a, c) => a + c.total, 0);
  const imprevistos = pct(directo, opciones.imprevistos_pct);
  const costo = directo + imprevistos;
  const utilidad = pct(costo, opciones.utilidad_pct);
  const precioSugerido = costo + utilidad;
  const iva = opciones.con_iva ? pct(precioSugerido, 16) : 0;
  const precio = opciones.precio_cliente === null || opciones.precio_cliente === "" ? null : cent(opciones.precio_cliente);
  const margen = precio === null ? null : precio - costo;
  return {
    porCuenta,
    porGrupo,
    directo,
    imprevistos,
    costo,
    utilidad,
    precioSugerido,
    iva,
    totalConIva: precioSugerido + iva,
    real: porCuenta.reduce((a, c) => a + c.real, 0),
    precio,
    margen,
    margenPct: precio ? Math.round(((margen ?? 0) / precio) * 1000) / 10 : null
  };
}

// Plantilla de un spot: las líneas típicas, sin montos (se llenan con las cotizaciones reales).
export const PLANTILLA_SPOT: { cuenta: string; descripcion: string; cantidad: number; unidad: string }[] = [
  { cuenta: "1100", descripcion: "Guion y concepto", cantidad: 1, unidad: "fijo" },
  { cuenta: "1200", descripcion: "Director", cantidad: 1, unidad: "día" },
  { cuenta: "1300", descripcion: "Productor", cantidad: 1, unidad: "día" },
  { cuenta: "1400", descripcion: "Talento principal", cantidad: 1, unidad: "día" },
  { cuenta: "2100", descripcion: "Asistente de producción", cantidad: 1, unidad: "día" },
  { cuenta: "2200", descripcion: "Director de fotografía", cantidad: 1, unidad: "día" },
  { cuenta: "2200", descripcion: "Renta de cámara y lentes", cantidad: 1, unidad: "día" },
  { cuenta: "2300", descripcion: "Gaffer / luces", cantidad: 1, unidad: "día" },
  { cuenta: "2400", descripcion: "Arte y utilería", cantidad: 1, unidad: "fijo" },
  { cuenta: "2500", descripcion: "Maquillaje", cantidad: 1, unidad: "día" },
  { cuenta: "2600", descripcion: "Sonidista", cantidad: 1, unidad: "día" },
  { cuenta: "2700", descripcion: "Locación / permiso", cantidad: 1, unidad: "día" },
  { cuenta: "2800", descripcion: "Transporte de equipo", cantidad: 1, unidad: "día" },
  { cuenta: "2900", descripcion: "Comida del crew", cantidad: 6, unidad: "persona" },
  { cuenta: "4100", descripcion: "Edición (spot + cortes)", cantidad: 1, unidad: "fijo" },
  { cuenta: "4200", descripcion: "Color", cantidad: 1, unidad: "fijo" },
  { cuenta: "4300", descripcion: "Música con licencia", cantidad: 1, unidad: "pieza" },
  { cuenta: "4400", descripcion: "Mezcla de sonido", cantidad: 1, unidad: "fijo" },
  { cuenta: "5200", descripcion: "Discos y respaldo", cantidad: 1, unidad: "pieza" }
];

// ─── Reparto: IDs y Day Out of Days ──────────────────────────────────────
// ID 1 = quien sale en más escenas (como en Movie Magic). Empate: quien aparece primero.
export function idsReparto(escenas: Escena[]): Map<string, number> {
  const conteo = new Map<string, { n: number; primera: number }>();
  escenas.forEach((e, i) => {
    for (const p of e.personajes) {
      const x = conteo.get(p) ?? { n: 0, primera: i };
      x.n += 1;
      conteo.set(p, x);
    }
  });
  return new Map(
    [...conteo.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[1].primera - b[1].primera)
      .map(([nombre], i) => [nombre, i + 1])
  );
}

export type EstadoDOOD = "SW" | "W" | "WF" | "SWF" | "H" | "";
export type FilaDOOD = { id: number; nombre: string; dias: EstadoDOOD[]; trabaja: number; espera: number };

// Day Out of Days: por personaje y día de rodaje.
// SW = empieza, W = trabaja, WF = termina, SWF = un solo día, H = en espera (entre su primer y último día sin filmar).
export function dayOutOfDays(escenas: Escena[], diaDe: Map<string, string | null>): { dias: string[]; filas: FilaDOOD[] } {
  const dias = [...new Set(escenas.map((e) => diaDe.get(e.id)).filter((d): d is string => !!d))].sort();
  const ids = idsReparto(escenas);
  const filas: FilaDOOD[] = [...ids.entries()].map(([nombre, id]) => {
    const trabaja = dias.map((d) => escenas.some((e) => diaDe.get(e.id) === d && e.personajes.includes(nombre)));
    const primero = trabaja.indexOf(true);
    const ultimo = trabaja.lastIndexOf(true);
    const estados: EstadoDOOD[] = trabaja.map((t, i) => {
      if (primero < 0 || i < primero || i > ultimo) return "";
      if (!t) return "H";
      if (primero === ultimo) return "SWF";
      if (i === primero) return "SW";
      if (i === ultimo) return "WF";
      return "W";
    });
    return { id, nombre, dias: estados, trabaja: trabaja.filter(Boolean).length, espera: estados.filter((x) => x === "H").length };
  });
  return { dias, filas };
}
