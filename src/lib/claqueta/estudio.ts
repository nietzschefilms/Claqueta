// Estudio: lógica pura (sin base de datos) para la agenda compartida y el guion.
// Horas en minutos desde las 00:00. Fechas "AAAA-MM-DD".

import { diaSemana, horaAMinutos } from "./fechas";
import type { Bloque } from "./tipos";

// ─── Huecos en común ─────────────────────────────────────────────────────
export type Ocupado = { user_id: string; fecha: string; inicio: string; fin: string; tipo: "clase" | "fijo" | "bloque" | "evento" };
export type Hueco = { fecha: string; inicio: number; fin: number; pisaBloques: boolean };

type Rango = [number, number];

function unir(rangos: Rango[]): Rango[] {
  const r = [...rangos].sort((a, b) => a[0] - b[0]);
  const out: Rango[] = [];
  for (const x of r) {
    const u = out[out.length - 1];
    if (u && x[0] <= u[1]) u[1] = Math.max(u[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

// Huecos donde TODOS están libres de clases, fijos y eventos. Los bloques de
// foco son flexibles: el hueco se ofrece, pero se marca si pisa alguno.
// margen: minutos libres antes y después de cada clase (traslado).
export function huecosEnComun(
  ocupados: Ocupado[],
  fechas: string[],
  opciones: { duracion: number; desde?: number; hasta?: number; margen?: number; ahora?: { fecha: string; minutos: number } }
): Hueco[] {
  const { duracion, desde = 8 * 60, hasta = 22 * 60, margen = 0, ahora } = opciones;
  const out: Hueco[] = [];
  for (const fecha of fechas) {
    const delDia = ocupados.filter((o) => o.fecha === fecha);
    const duros = unir(
      delDia
        .filter((o) => o.tipo !== "bloque")
        .map((o): Rango => [horaAMinutos(o.inicio) - (o.tipo === "clase" ? margen : 0), horaAMinutos(o.fin) + (o.tipo === "clase" ? margen : 0)])
    );
    const suaves = delDia.filter((o) => o.tipo === "bloque").map((o): Rango => [horaAMinutos(o.inicio), horaAMinutos(o.fin)]);
    let cursor = desde;
    if (ahora && ahora.fecha === fecha) cursor = Math.max(cursor, Math.ceil(ahora.minutos / 15) * 15);
    if (ahora && fecha < ahora.fecha) continue;
    for (const [a, b] of [...duros, [hasta, hasta] as Rango]) {
      const fin = Math.min(a, hasta);
      if (fin - cursor >= duracion) {
        out.push({ fecha, inicio: cursor, fin, pisaBloques: suaves.some(([sa, sb]) => sa < fin && sb > cursor) });
      }
      cursor = Math.max(cursor, b);
      if (cursor >= hasta) break;
    }
  }
  return out;
}

// ─── Guion ───────────────────────────────────────────────────────────────
export const TIPOS_LINEA = ["escena", "accion", "personaje", "parentesis", "dialogo", "transicion", "nota"] as const;
export type TipoLinea = (typeof TIPOS_LINEA)[number];
export type Linea = { id: string; orden: number; tipo: TipoLinea; texto: string };

export const NOMBRE_TIPO: Record<TipoLinea, string> = {
  escena: "Escena",
  accion: "Acción",
  personaje: "Personaje",
  parentesis: "Paréntesis",
  dialogo: "Diálogo",
  transicion: "Transición",
  nota: "Nota"
};

// Enter al final de una línea: qué tipo sigue (como Final Draft).
export const SIGUIENTE: Record<TipoLinea, TipoLinea> = {
  escena: "accion",
  accion: "accion",
  personaje: "dialogo",
  parentesis: "dialogo",
  dialogo: "personaje",
  transicion: "escena",
  nota: "accion"
};

// Tab / Shift+Tab: rotar el tipo de la línea.
const CICLO: TipoLinea[] = ["accion", "personaje", "dialogo", "parentesis", "transicion", "escena"];
export function rotarTipo(t: TipoLinea, atras = false): TipoLinea {
  const i = CICLO.indexOf(t);
  if (i < 0) return "accion";
  return CICLO[(i + (atras ? CICLO.length - 1 : 1)) % CICLO.length];
}

// "int. cocina - noche" escrito en acción se vuelve encabezado de escena.
export function pareceEscena(texto: string): boolean {
  return /^(int|ext|int\.?\s*\/\s*ext|i\/e)[.\s]/i.test(texto.trim());
}

export type Slug = { intExt: "INT" | "EXT" | "INT/EXT" | null; lugar: string; momento: string | null };

export function leerSlug(texto: string): Slug {
  const t = texto.trim().toUpperCase();
  const m = t.match(/^(INT\.?\s*\/\s*EXT|I\/E|INT|EXT)\.?\s*(.*)$/);
  let intExt: Slug["intExt"] = null;
  let resto = t;
  if (m) {
    intExt = m[1].startsWith("INT") && m[1].includes("EXT") ? "INT/EXT" : m[1] === "I/E" ? "INT/EXT" : m[1] === "INT" ? "INT" : "EXT";
    resto = m[2];
  }
  const partes = resto.split(/\s+[-–—]\s+/);
  const momento = partes.length > 1 ? partes.pop()!.trim() : null;
  return { intExt, lugar: partes.join(" - ").trim() || "SIN LUGAR", momento: momento || null };
}

export const esNoche = (momento: string | null) => !!momento && /NOCHE|NIGHT|ANOCHECER/.test(momento);

// Nombre limpio del personaje: sin (V.O.), (O.S.), (CONT'D), (CONT.).
export function nombrePersonaje(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Renglones aproximados que ocupa en la página (Courier 12, márgenes estándar).
function renglones(l: Linea): number {
  const ancho = l.tipo === "dialogo" ? 35 : l.tipo === "parentesis" ? 25 : 61;
  const n = Math.max(1, Math.ceil(l.texto.length / ancho));
  if (l.tipo === "escena" || l.tipo === "transicion") return n + 2;
  if (l.tipo === "accion") return n + 1;
  if (l.tipo === "dialogo") return n + 1;
  if (l.tipo === "nota") return 0;
  return n;
}

export const RENGLONES_POR_PAGINA = 55;

export type Escena = {
  id: string;
  numero: number;
  slug: Slug;
  texto: string;
  personajes: string[];
  octavos: number; // largo en octavos de página (lo estándar en plan de rodaje)
  lineas: Linea[];
  mayusculas: string[]; // palabras en MAYÚSCULAS dentro de la acción: posibles elementos de desglose
};

// Parte el guion en escenas. Lo que haya antes de la primera escena no cuenta.
export function escenasDe(lineas: Linea[]): Escena[] {
  const orden = [...lineas].sort((a, b) => a.orden - b.orden);
  const out: Escena[] = [];
  let actual: Escena | null = null;
  let r = 0;
  const cerrar = () => {
    if (actual) actual.octavos = Math.max(1, Math.round((r / RENGLONES_POR_PAGINA) * 8));
  };
  for (const l of orden) {
    if (l.tipo === "escena") {
      cerrar();
      actual = { id: l.id, numero: out.length + 1, slug: leerSlug(l.texto), texto: l.texto, personajes: [], octavos: 1, lineas: [], mayusculas: [] };
      out.push(actual);
      r = renglones(l);
      continue;
    }
    if (!actual) continue;
    actual.lineas.push(l);
    r += renglones(l);
    if (l.tipo === "personaje") {
      const n = nombrePersonaje(l.texto);
      if (n && !actual.personajes.includes(n)) actual.personajes.push(n);
    }
    if (l.tipo === "accion") {
      for (const m of l.texto.match(/\b[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ0-9'’]{2,}(?:\s+[A-ZÁÉÍÓÚÑÜ0-9'’]{2,})*\b/g) ?? []) {
        const w = m.trim();
        if (!actual.mayusculas.includes(w)) actual.mayusculas.push(w);
      }
    }
  }
  cerrar();
  return out;
}

// "1 4/8" páginas.
export function paginas(octavos: number): string {
  const p = Math.floor(octavos / 8);
  const o = octavos % 8;
  if (!p) return `${o}/8`;
  return o ? `${p} ${o}/8` : `${p}`;
}

export type ResumenGuion = { escenas: number; octavos: number; minutos: number; personajes: { nombre: string; escenas: number }[]; lugares: { lugar: string; escenas: number }[] };

export function resumenGuion(escenas: Escena[]): ResumenGuion {
  const octavos = escenas.reduce((a, e) => a + e.octavos, 0);
  const pj = new Map<string, number>();
  const lu = new Map<string, number>();
  for (const e of escenas) {
    for (const p of e.personajes) pj.set(p, (pj.get(p) ?? 0) + 1);
    lu.set(e.slug.lugar, (lu.get(e.slug.lugar) ?? 0) + 1);
  }
  const orden = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    escenas: escenas.length,
    octavos,
    // Regla de la industria: una página ≈ un minuto en pantalla.
    minutos: Math.round((octavos / 8) * 10) / 10,
    personajes: orden(pj).map(([nombre, escenas]) => ({ nombre, escenas })),
    lugares: orden(lu).map(([lugar, escenas]) => ({ lugar, escenas }))
  };
}

// Plan de rodaje sugerido: agrupa por locación y luz (día/noche) y llena días
// hasta el máximo de páginas por jornada. Devuelve el índice de día por escena.
export function sugerirPlan(escenas: Escena[], octavosPorDia: number): Map<string, number> {
  const grupos = new Map<string, Escena[]>();
  for (const e of escenas) {
    const k = `${e.slug.lugar}|${esNoche(e.slug.momento) ? "N" : "D"}`;
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  // Primero los grupos grandes (se aprovecha la instalación), luego día antes que noche.
  const lista = [...grupos.entries()].sort((a, b) => {
    const oa = a[1].reduce((x, e) => x + e.octavos, 0);
    const ob = b[1].reduce((x, e) => x + e.octavos, 0);
    return ob - oa || a[0].localeCompare(b[0]);
  });
  const plan = new Map<string, number>();
  let dia = 0;
  let usados = 0;
  for (const [, g] of lista) {
    for (const e of g) {
      if (usados > 0 && usados + e.octavos > octavosPorDia) {
        dia += 1;
        usados = 0;
      }
      plan.set(e.id, dia);
      usados += e.octavos;
    }
  }
  return plan;
}

// ─── Fountain (texto plano de guion) ─────────────────────────────────────
export function aFountain(lineas: Linea[], titulo?: string): string {
  const orden = [...lineas].sort((a, b) => a.orden - b.orden);
  const partes: string[] = [];
  if (titulo) partes.push(`Title: ${titulo}\n`);
  for (const l of orden) {
    const t = l.texto.trim();
    if (!t && l.tipo !== "accion") continue;
    if (l.tipo === "escena") partes.push(`\n${pareceEscena(t) ? t.toUpperCase() : `.${t.toUpperCase()}`}\n`);
    else if (l.tipo === "personaje") partes.push(`\n${t.toUpperCase()}`);
    else if (l.tipo === "parentesis") partes.push(`(${t.replace(/^\(|\)$/g, "")})`);
    else if (l.tipo === "dialogo") partes.push(t);
    else if (l.tipo === "transicion") partes.push(`\n> ${t.toUpperCase()}\n`);
    else if (l.tipo === "nota") partes.push(`[[${t}]]`);
    else partes.push(`\n${t}`);
  }
  return partes.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// Lee Fountain básico (lo que exportan Final Draft, Highland, WriterSolo…).
export function deFountain(texto: string): { tipo: TipoLinea; texto: string }[] {
  const out: { tipo: TipoLinea; texto: string }[] = [];
  const bloques = texto.replace(/\r\n?/g, "\n").replace(/^Title:.*\n(?:[A-Za-z ]+:.*\n)*/i, "").split(/\n{2,}/);
  for (const bruto of bloques) {
    const renglones = bruto.split("\n").filter((r) => r.trim() !== "");
    if (!renglones.length) continue;
    const primero = renglones[0].trim();
    if (/^\[\[.*\]\]$/.test(primero)) {
      out.push({ tipo: "nota", texto: primero.slice(2, -2).trim() });
      continue;
    }
    if (primero.startsWith(".") && !primero.startsWith("..")) {
      out.push({ tipo: "escena", texto: primero.slice(1).trim() });
      continue;
    }
    if (pareceEscena(primero) && renglones.length === 1) {
      out.push({ tipo: "escena", texto: primero });
      continue;
    }
    if (primero.startsWith(">") && !primero.endsWith("<")) {
      out.push({ tipo: "transicion", texto: primero.slice(1).trim() });
      continue;
    }
    if (renglones.length === 1 && /^[A-ZÁÉÍÓÚÑ0-9 .'’-]+TO:$/.test(primero)) {
      out.push({ tipo: "transicion", texto: primero });
      continue;
    }
    const esNombre = (r: string) => (r.startsWith("@") || (r === r.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(r))) && r.length <= 40;
    if (renglones.length > 1 && esNombre(primero)) {
      out.push({ tipo: "personaje", texto: primero.replace(/^@/, "") });
      for (const r of renglones.slice(1)) {
        const t = r.trim();
        if (/^\(.*\)$/.test(t)) out.push({ tipo: "parentesis", texto: t.slice(1, -1) });
        else out.push({ tipo: "dialogo", texto: t });
      }
      continue;
    }
    out.push({ tipo: "accion", texto: renglones.map((r) => r.trim()).join(" ") });
  }
  return out;
}

// Orden fraccionario: un número entre dos vecinos.
export function ordenEntre(antes: number | null, despues: number | null): number {
  if (antes === null && despues === null) return 1024;
  if (antes === null) return despues! - 1024;
  if (despues === null) return antes + 1024;
  return (antes + despues) / 2;
}

// Una cita del equipo como bloque fijo del día (para Hoy, Semana y los avisos).
export function eventoABloque(e: { id: string; fecha: string; inicio: string; fin: string; titulo: string; tipo: string; lugar: string | null }): Bloque {
  return {
    id: `ev-${e.id}`,
    weekday: diaSemana(e.fecha),
    start_time: e.inicio,
    end_time: e.fin,
    label: e.titulo,
    kind: "fixed",
    areas: ["nietzsche"],
    evento: { tipo: e.tipo, lugar: e.lugar }
  };
}
