"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { escenasDe, type Linea } from "@/lib/claqueta/estudio";
import type { FloorPlanGuardado, Plano } from "@/lib/claqueta/datos-estudio";
import {
  ALTO,
  ANCHO,
  APERTURAS,
  CUADRO,
  ES_LINEA,
  MAX_ELEMENTOS,
  alinear,
  anguloHacia,
  personajesSugeridos,
  punta,
  rotar,
  siguienteNumeroCamara,
  type Elemento,
  type TipoElemento
} from "@/lib/claqueta/floorplan";
import { guardarFloorPlan } from "./acciones-floorplan";

// El plano se dibuja como papel impreso (hueso y negro) en tema claro y
// oscuro: así el PNG sale igual que en pantalla. Rojo solo para lo elegido.
const PAPEL = "#EBE7E0";
const TINTA = "#0A0A0A";
const GRIS = "#6C665E";
const CUADRICULA = "#D3CCC1";
const LUZ = "#D99A2B";
const ROJO = "#FF0000";
const LETRA = "'IBM Plex Mono', ui-monospace, monospace";
const CM_POR_UNIDAD = 50 / CUADRO;

const NOMBRE: Record<TipoElemento, string> = { personaje: "Personaje", camara: "Cámara", luz: "Luz", mueble: "Mueble o prop", pared: "Pared", puerta: "Puerta", flecha: "Flecha" };
type Modo = "mover" | "pared" | "puerta" | "flecha-actor" | "flecha-camara";
const MODOS: { v: Exclude<Modo, "mover">; t: string }[] = [
  { v: "pared", t: "Pared" },
  { v: "puerta", t: "Puerta" },
  { v: "flecha-actor", t: "Flecha actor" },
  { v: "flecha-camara", t: "Flecha cámara" }
];
type Arrastre =
  | { tipo: "mover"; id: string; orig: Elemento; x0: number; y0: number; antes: Elemento[]; movio: boolean }
  | { tipo: "girar" | "p1" | "p2"; id: string; antes: Elemento[]; movio: boolean }
  | { tipo: "dibujar"; x: number; y: number }
  | { tipo: "pasear"; cx: number; cy: number; sx: number; sy: number; movio: boolean };
// Acercar en el celular: 1×, 1.75× y 2.5× (luego se arrastra el fondo para pasear).
const ZOOMS = [1, 1.75, 2.5];
type Estado = "guardado" | "pendiente" | "guardando" | "error";

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const nuevoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const btnChico = "min-h-11 rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:opacity-40";

// FLOOR PLAN · el set visto desde arriba, uno por escena. Lo arman dirección y
// fotografía; el resto del equipo lo ve y lo descarga.
export function FloorPlan({ proyectoId, lineas, planos, reparto, planes, puedeEditar, errorCarga }: { proyectoId: string; lineas: Linea[]; planos: Plano[]; reparto: string[]; planes: FloorPlanGuardado[]; puedeEditar: boolean; errorCarga: boolean }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const editable = puedeEditar && !errorCarga;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [guardados, setGuardados] = useState<Record<string, Elemento[]>>(() => Object.fromEntries(planes.map((p) => [p.escena_id, p.elementos])));
  const primera = escenas.find((e) => guardados[e.id]?.length)?.id ?? escenas[0]?.id ?? "";
  const [escenaId, setEscenaId] = useState(primera);
  const [elementos, setElementos] = useState<Elemento[]>(() => guardados[primera] ?? []);
  const [historial, setHistorial] = useState<Elemento[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("mover");
  const [borrador, setBorrador] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [estado, setEstado] = useState<Estado>("guardado");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [centro, setCentro] = useState({ x: ANCHO / 2, y: ALTO / 2 });
  const arrastre = useRef<Arrastre | null>(null);
  const version = useRef(0);
  const vw = ANCHO / ZOOMS[zoom];
  const vh = ALTO / ZOOMS[zoom];
  const vx = limitar(centro.x - vw / 2, 0, ANCHO - vw);
  const vy = limitar(centro.y - vh / 2, 0, ALTO - vh);

  const escena = escenas.find((e) => e.id === escenaId);
  const tomas = planos.filter((p) => p.escena_id === escenaId).sort((a, b) => a.numero - b.numero);
  const sugeridos = personajesSugeridos(escena?.personajes ?? [], reparto, elementos);
  const elegido = elementos.find((e) => e.id === sel) ?? null;

  // ─── Guardar ───────────────────────────────────────────────────────────
  const guardar = async (escena: string, lista: Elemento[]) => {
    const v = version.current;
    setEstado("guardando");
    const r = await guardarFloorPlan(proyectoId, escena, lista).catch(() => ({ ok: false, error: "No hay conexión. Dale Reintentar cuando tengas señal; tus cambios siguen aquí." }));
    if (!r.ok) {
      setEstado("error");
      setError(r.error ?? "No se guardó el floor plan.");
      return;
    }
    setGuardados((g) => ({ ...g, [escena]: lista }));
    setError(null);
    // Si siguió moviendo cosas mientras se guardaba, queda pendiente.
    setEstado(version.current === v ? "guardado" : "pendiente");
  };

  // Se guarda solo, un segundo después del último cambio (no a media arrastrada).
  useEffect(() => {
    if (estado !== "pendiente" || arrastrando || !escenaId) return;
    const t = setTimeout(() => guardar(escenaId, elementos), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, arrastrando, elementos, escenaId]);

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (estado !== "pendiente" && estado !== "guardando") return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estado]);

  // ─── Cambios con deshacer ──────────────────────────────────────────────
  const marcar = () => {
    version.current += 1;
    setEstado("pendiente");
  };
  const recordar = (antes: Elemento[]) => setHistorial((h) => [...h.slice(-49), antes]);
  const cambiar = (nuevos: Elemento[]) => {
    recordar(elementos);
    setElementos(nuevos);
    marcar();
  };
  const editar = (id: string, c: Partial<Elemento>, conHistorial = true) => {
    const nuevos = elementos.map((e) => (e.id === id ? { ...e, ...c } : e));
    if (conHistorial) cambiar(nuevos);
    else {
      setElementos(nuevos);
      marcar();
    }
  };
  const deshacer = () => {
    const prev = historial[historial.length - 1];
    if (!prev) return;
    setHistorial((h) => h.slice(0, -1));
    setElementos(prev);
    if (sel && !prev.some((e) => e.id === sel)) setSel(null);
    marcar();
  };
  const quitar = (id: string) => {
    cambiar(elementos.filter((e) => e.id !== id));
    setSel(null);
  };

  const agregar = (tipo: "personaje" | "camara" | "luz" | "mueble", etiqueta?: string) => {
    if (elementos.length >= MAX_ELEMENTOS) return setError(`Llegaste al máximo de ${MAX_ELEMENTOS} elementos en esta escena.`);
    const n = elementos.filter((e) => e.tipo === tipo).length;
    const corrida = ((n % 5) - 2) * CUADRO * 2;
    const base: Elemento =
      tipo === "personaje"
        ? { id: nuevoId(), tipo, x: ANCHO / 2 + corrida, y: ALTO / 2 - CUADRO * 2, rot: 90, etiqueta: etiqueta ?? sugeridos[0] ?? `Personaje ${n + 1}` }
        : tipo === "camara"
          ? { id: nuevoId(), tipo, x: ANCHO / 2 + corrida, y: ALTO - CUADRO * 3, rot: 270, etiqueta: "", numero: siguienteNumeroCamara(elementos, tomas.map((t) => t.numero)), fov: 50 }
          : tipo === "luz"
            ? { id: nuevoId(), tipo, x: CUADRO * 3 + n * CUADRO * 2, y: CUADRO * 3, rot: 45, etiqueta: "" }
            : { id: nuevoId(), tipo, x: ANCHO / 2 + corrida, y: ALTO / 2 + CUADRO, rot: 0, etiqueta: "Mesa", w: CUADRO * 2, h: CUADRO * 1.5 };
    base.x = limitar(base.x, CUADRO, ANCHO - CUADRO);
    cambiar([...elementos, base]);
    setSel(base.id);
    setModo("mover");
  };

  const cambiarEscena = (id: string) => {
    // Lo pendiente de la escena anterior se guarda antes de cambiar.
    if (estado === "pendiente" && escenaId) guardar(escenaId, elementos);
    setEscenaId(id);
    setElementos(guardados[id] ?? []);
    setHistorial([]);
    setSel(null);
    setModo("mover");
  };

  // ─── Puntero (dedo o mouse) ────────────────────────────────────────────
  const punto = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: limitar(p.x, 0, ANCHO), y: limitar(p.y, 0, ALTO) };
  };
  const capturar = (e: React.PointerEvent) => {
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no dejan capturar; igual funciona dentro del lienzo */
    }
  };

  const tocarElemento = (e: React.PointerEvent, el: Elemento) => {
    if (!editable) return;
    e.stopPropagation();
    if (modo !== "mover") setModo("mover");
    setSel(el.id);
    const p = punto(e);
    arrastre.current = { tipo: "mover", id: el.id, orig: el, x0: p.x, y0: p.y, antes: elementos, movio: false };
    setArrastrando(true);
    capturar(e);
  };
  const tocarAsa = (e: React.PointerEvent, tipo: "girar" | "p1" | "p2", id: string) => {
    e.stopPropagation();
    arrastre.current = { tipo, id, antes: elementos, movio: false };
    setArrastrando(true);
    capturar(e);
  };
  const tocarFondo = (e: React.PointerEvent) => {
    if (modo === "mover" || !editable) {
      // Con zoom, arrastrar el fondo pasea por el plano; un toque suelta lo elegido.
      if (zoom > 0) {
        arrastre.current = { tipo: "pasear", cx: vx + vw / 2, cy: vy + vh / 2, sx: e.clientX, sy: e.clientY, movio: false };
        capturar(e);
      } else setSel(null);
      return;
    }
    const p = punto(e);
    const x = alinear(p.x);
    const y = alinear(p.y);
    arrastre.current = { tipo: "dibujar", x, y };
    setBorrador({ x, y, x2: x, y2: y });
    setArrastrando(true);
    capturar(e);
  };
  const mover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    if (a.tipo === "pasear") {
      const ancho = svgRef.current?.getBoundingClientRect().width || 1;
      const escala = vw / ancho;
      if (Math.hypot(e.clientX - a.sx, e.clientY - a.sy) > 4) a.movio = true;
      return setCentro({ x: a.cx - (e.clientX - a.sx) * escala, y: a.cy - (e.clientY - a.sy) * escala });
    }
    const p = punto(e);
    if (a.tipo === "dibujar") return setBorrador({ x: a.x, y: a.y, x2: alinear(p.x), y2: alinear(p.y) });
    a.movio = true;
    setElementos((lista) =>
      lista.map((el) => {
        if (el.id !== a.id) return el;
        if (a.tipo === "mover") {
          const dx = alinear(p.x - a.x0, 10);
          const dy = alinear(p.y - a.y0, 10);
          const o = a.orig;
          if (ES_LINEA[o.tipo]) {
            // La línea se mueve entera sin salirse del lienzo.
            const mx = limitar(dx, -Math.min(o.x, o.x2 ?? 0), ANCHO - Math.max(o.x, o.x2 ?? 0));
            const my = limitar(dy, -Math.min(o.y, o.y2 ?? 0), ALTO - Math.max(o.y, o.y2 ?? 0));
            return { ...el, x: o.x + mx, y: o.y + my, x2: (o.x2 ?? 0) + mx, y2: (o.y2 ?? 0) + my };
          }
          return { ...el, x: limitar(o.x + dx, 0, ANCHO), y: limitar(o.y + dy, 0, ALTO) };
        }
        if (a.tipo === "girar") return { ...el, rot: Math.round(anguloHacia(el.x, el.y, p.x, p.y) / 5) * 5 % 360 };
        if (a.tipo === "p1") return { ...el, x: alinear(p.x, 10), y: alinear(p.y, 10) };
        return { ...el, x2: alinear(p.x, 10), y2: alinear(p.y, 10) };
      })
    );
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    setArrastrando(false);
    if (!a) return;
    if (a.tipo === "pasear") {
      if (!a.movio) setSel(null);
      return;
    }
    if (a.tipo === "dibujar") {
      const b = borrador;
      setBorrador(null);
      if (!b || Math.hypot(b.x2 - b.x, b.y2 - b.y) < CUADRO / 2) return;
      if (elementos.length >= MAX_ELEMENTOS) return setError(`Llegaste al máximo de ${MAX_ELEMENTOS} elementos en esta escena.`);
      const tipo: TipoElemento = modo === "pared" ? "pared" : modo === "puerta" ? "puerta" : "flecha";
      const nuevo: Elemento = { id: nuevoId(), tipo, x: b.x, y: b.y, x2: b.x2, y2: b.y2, rot: 0, etiqueta: "", ...(tipo === "flecha" ? { de: modo === "flecha-camara" ? ("camara" as const) : ("actor" as const) } : {}) };
      cambiar([...elementos, nuevo]);
      setSel(nuevo.id);
      return;
    }
    if (a.movio) {
      recordar(a.antes);
      marcar();
    }
  };

  // Teclado: flechas mueven, [ y ] giran, Supr borra.
  const teclado = (e: React.KeyboardEvent, el: Elemento) => {
    if (!editable) return;
    const paso = e.shiftKey ? CUADRO : 10;
    const d: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    if (d[e.key]) {
      e.preventDefault();
      const [dx, dy] = d[e.key];
      const c: Partial<Elemento> = { x: limitar(el.x + dx, 0, ANCHO), y: limitar(el.y + dy, 0, ALTO) };
      if (ES_LINEA[el.tipo]) Object.assign(c, { x2: limitar((el.x2 ?? 0) + dx, 0, ANCHO), y2: limitar((el.y2 ?? 0) + dy, 0, ALTO) });
      editar(el.id, c);
    } else if ((e.key === "[" || e.key === "]") && !ES_LINEA[el.tipo]) {
      e.preventDefault();
      editar(el.id, { rot: rotar(el.rot, e.key === "]" ? 15 : -15) });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      quitar(el.id);
    } else if (e.key === "Escape") setSel(null);
  };

  // ─── PNG ───────────────────────────────────────────────────────────────
  const descargar = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setError(null);
    try {
      const copia = svg.cloneNode(true) as SVGSVGElement;
      copia.querySelectorAll("[data-ui]").forEach((n) => n.remove());
      copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      // El PNG siempre sale con el plano completo, aunque esté acercado.
      copia.setAttribute("viewBox", `0 0 ${ANCHO} ${ALTO}`);
      copia.setAttribute("width", String(ANCHO * 2));
      copia.setAttribute("height", String(ALTO * 2));
      copia.removeAttribute("style");
      copia.removeAttribute("class");
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copia)], { type: "image/svg+xml;charset=utf-8" }));
      try {
        const img = await new Promise<HTMLImageElement>((ok, mal) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.onerror = () => mal(new Error("No pude dibujar el plano."));
          i.src = url;
        });
        const c = document.createElement("canvas");
        c.width = ANCHO * 2;
        c.height = ALTO * 2;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = PAPEL;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const png = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
        if (!png) throw new Error("No pude crear el PNG.");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = `floor-plan-escena-${escena?.numero ?? 0}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar. Intenta otra vez.");
    }
  };

  if (!escenas.length) return <p className="tarjeta text-sm text-muted">Escribe escenas en el guion para dibujar el floor plan de cada una.</p>;

  const textoEstado = { guardado: "Guardado", pendiente: "Sin guardar", guardando: "Guardando…", error: "No se guardó" }[estado];
  const modoActivo = MODOS.find((m) => m.v === modo);

  return (
    <div className="space-y-4">
      {errorCarga && <p className="alerta-error">No pude cargar los floor plans. Recarga la página en un momento; mientras, no se puede editar para no perder nada.</p>}
      <div className="tarjeta space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className="etiqueta mb-1.5 block">Escena</span>
            <select value={escenaId} onChange={(e) => cambiarEscena(e.target.value)} className="campo font-mono text-sm uppercase">
              {escenas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.numero}. {e.texto}
                  {(e.id === escenaId ? elementos.length : guardados[e.id]?.length) ? " ●" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={descargar} className="btn-secundario">
            Descargar PNG
          </button>
        </div>
        {editable ? (
          <>
            <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Agregar al plano">
              <button type="button" onClick={() => agregar("personaje")} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>+ Personaje</button>
              <button type="button" onClick={() => agregar("camara")} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>+ Cámara</button>
              <button type="button" onClick={() => agregar("luz")} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>+ Luz</button>
              <button type="button" onClick={() => agregar("mueble")} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>+ Mueble</button>
              {MODOS.map((m) => (
                <button key={m.v} type="button" aria-pressed={modo === m.v} onClick={() => { setModo(modo === m.v ? "mover" : m.v); setSel(null); }} className={`${btnChico} ${modo === m.v ? "bg-tinta text-fondo" : "bg-tinta/[0.06] hover:bg-tinta/[0.1]"}`}>
                  {m.t}
                </button>
              ))}
            </div>
            {sugeridos.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="etiqueta mr-1">{escena?.personajes.length ? "En la escena" : "Reparto"}</span>
                {sugeridos.slice(0, 12).map((p) => (
                  <button key={p} type="button" onClick={() => agregar("personaje", p)} className={`${btnChico} bg-tinta/[0.06] font-mono text-xs uppercase hover:bg-tinta/[0.1]`}>
                    + {p}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={deshacer} disabled={!historial.length} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>
                ↶ Deshacer
              </button>
              <p className={`cifra text-xs ${estado === "error" ? "font-semibold text-rojo" : "text-muted"}`} role="status">
                {textoEstado}
                {estado === "error" && (
                  <button type="button" onClick={() => guardar(escenaId, elementos)} className="ml-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                    Reintentar
                  </button>
                )}
              </p>
            </div>
          </>
        ) : (
          !errorCarga && <p className="text-xs text-muted">Solo dirección y fotografía cambian el floor plan. Tú lo ves y lo puedes descargar.</p>
        )}
        {error && <p className="alerta-error">{error}</p>}
      </div>

      {modoActivo && (
        <p className="rounded-full bg-tinta px-4 py-2 text-center text-xs font-semibold text-fondo" role="status">
          {modoActivo.t}: arrastra en el plano para dibujar.{" "}
          <button type="button" onClick={() => setModo("mover")} className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
            Listo
          </button>
        </p>
      )}

      <div className="relative overflow-hidden rounded-2xl border-2 border-tinta/80 shadow-suave">
        <div className="absolute bottom-2 left-2 z-10 flex gap-1">
          <button type="button" aria-label="Alejar" disabled={zoom === 0} onClick={() => setZoom((z) => Math.max(0, z - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-[#0A0A0A] text-xl font-semibold text-[#EBE7E0] shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:opacity-30">
            −
          </button>
          <button
            type="button"
            aria-label="Acercar"
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => {
              if (zoom === 0) setCentro(elegido ? { x: elegido.x, y: elegido.y } : { x: ANCHO / 2, y: ALTO / 2 });
              setZoom((z) => Math.min(ZOOMS.length - 1, z + 1));
            }}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#0A0A0A] text-xl font-semibold text-[#EBE7E0] shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:opacity-30"
          >
            +
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`${vx} ${vy} ${vw} ${vh}`}
          role={editable ? "group" : "img"}
          aria-label={`Floor plan de la escena ${escena?.numero ?? ""}: ${elementos.length} elementos`}
          className="block h-auto w-full select-none"
          style={{ touchAction: editable || zoom > 0 ? "none" : "auto", cursor: modo !== "mover" ? "crosshair" : zoom > 0 ? "grab" : undefined }}
          onPointerDown={tocarFondo}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <defs>
            <pattern id={`c-${uid}`} width={CUADRO} height={CUADRO} patternUnits="userSpaceOnUse">
              <path d={`M ${CUADRO} 0 L 0 0 0 ${CUADRO}`} fill="none" stroke={CUADRICULA} strokeWidth="1" />
            </pattern>
            <pattern id={`m-${uid}`} width={CUADRO * 5} height={CUADRO * 5} patternUnits="userSpaceOnUse">
              <path d={`M ${CUADRO * 5} 0 L 0 0 0 ${CUADRO * 5}`} fill="none" stroke={GRIS} strokeOpacity="0.35" strokeWidth="1.5" />
            </pattern>
            <marker id={`p-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={TINTA} />
            </marker>
          </defs>
          <rect width={ANCHO} height={ALTO} fill={PAPEL} />
          <rect width={ANCHO} height={ALTO} fill={`url(#c-${uid})`} />
          <rect width={ANCHO} height={ALTO} fill={`url(#m-${uid})`} />
          <text x="16" y="28" fontFamily={LETRA} fontSize="15" fontWeight="700" fill={TINTA}>
            {escena ? `ESC. ${escena.numero} · ${escena.texto.toUpperCase()}`.slice(0, 70) : ""}
          </text>
          <text x={ANCHO - 16} y={ALTO - 14} textAnchor="end" fontFamily={LETRA} fontSize="11" fill={GRIS}>
            1 cuadro ≈ 50 cm · Claqueta
          </text>

          {/* Primero lo que va abajo (paredes, muebles, cuadros de cámara), luego lo de arriba. */}
          {[...elementos]
            .sort((a, b) => capa(a.tipo) - capa(b.tipo))
            .map((el) => (
              <g
                key={el.id}
                tabIndex={editable ? 0 : undefined}
                role={editable ? "button" : undefined}
                aria-label={`${NOMBRE[el.tipo]}${el.tipo === "camara" && el.numero ? ` toma ${el.numero}` : ""}${el.etiqueta ? ` ${el.etiqueta}` : ""}`}
                aria-pressed={editable ? sel === el.id : undefined}
                onPointerDown={(e) => tocarElemento(e, el)}
                onFocus={() => editable && setSel(el.id)}
                onKeyDown={(e) => teclado(e, el)}
                style={{ cursor: editable ? "move" : undefined, outline: "none" }}
              >
                <Figura el={el} marcador={`p-${uid}`} />
              </g>
            ))}

          {borrador && <line data-ui="1" x1={borrador.x} y1={borrador.y} x2={borrador.x2} y2={borrador.y2} stroke={ROJO} strokeWidth="4" strokeDasharray="8 6" strokeLinecap="round" />}
          {editable && elegido && <Asas el={elegido} onAsa={tocarAsa} />}
        </svg>
      </div>

      {editable && elegido && (
        <Panel
          el={elegido}
          tomas={tomas}
          onEditar={(c, h) => editar(elegido.id, c, h)}
          onRecordar={() => recordar(elementos)}
          onQuitar={() => quitar(elegido.id)}
        />
      )}
      {editable && !elegido && elementos.length > 0 && <p className="text-center text-xs text-muted">Toca algo del plano para moverlo, girarlo o cambiarle el nombre. Con + te acercas y arrastrando el fondo te paseas.</p>}
      {!editable && elementos.length === 0 && !errorCarga && <p className="tarjeta text-sm text-muted">Esta escena aún no tiene floor plan.</p>}
    </div>
  );
}

const capa = (t: TipoElemento) => ({ pared: 0, puerta: 0, mueble: 1, luz: 2, flecha: 3, camara: 4, personaje: 5 })[t];

// Cada elemento como se ve desde arriba. Solo atributos (nada de clases)
// para que el PNG salga igual.
function Figura({ el, marcador }: { el: Elemento; marcador: string }) {
  const etiqueta = (dy: number) =>
    el.etiqueta ? (
      <text x={el.x} y={el.y + dy} textAnchor="middle" fontFamily={LETRA} fontSize="12" fontWeight="600" fill={TINTA}>
        {el.etiqueta.toUpperCase()}
      </text>
    ) : null;
  const giro = `translate(${el.x} ${el.y}) rotate(${el.rot})`;

  if (el.tipo === "pared" || el.tipo === "puerta" || el.tipo === "flecha") {
    const x2 = el.x2 ?? el.x;
    const y2 = el.y2 ?? el.y;
    const hit = <line x1={el.x} y1={el.y} x2={x2} y2={y2} stroke="transparent" strokeWidth="28" strokeLinecap="round" />;
    const mx = (el.x + x2) / 2;
    const my = (el.y + y2) / 2;
    const texto = el.etiqueta ? (
      <text x={mx} y={my - 10} textAnchor="middle" fontFamily={LETRA} fontSize="11" fontWeight="600" fill={TINTA}>
        {el.etiqueta.toUpperCase()}
      </text>
    ) : null;
    if (el.tipo === "pared")
      return (
        <>
          {hit}
          <line x1={el.x} y1={el.y} x2={x2} y2={y2} stroke={TINTA} strokeWidth="8" strokeLinecap="square" />
          {texto}
        </>
      );
    if (el.tipo === "puerta") {
      // Hueco de la puerta, la hoja abierta a 90° y su recorrido.
      const largo = Math.hypot(x2 - el.x, y2 - el.y);
      const px = el.x - (y2 - el.y);
      const py = el.y + (x2 - el.x);
      return (
        <>
          {hit}
          <line x1={el.x} y1={el.y} x2={x2} y2={y2} stroke={PAPEL} strokeWidth="9" />
          <line x1={el.x} y1={el.y} x2={x2} y2={y2} stroke={GRIS} strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1={el.x} y1={el.y} x2={px} y2={py} stroke={TINTA} strokeWidth="4" strokeLinecap="round" />
          <path d={`M ${x2} ${y2} A ${largo} ${largo} 0 0 1 ${px} ${py}`} fill="none" stroke={TINTA} strokeWidth="1.5" strokeDasharray="5 4" />
          {texto}
        </>
      );
    }
    return (
      <>
        {hit}
        <line x1={el.x} y1={el.y} x2={x2} y2={y2} stroke={TINTA} strokeWidth="3" strokeDasharray={el.de === "camara" ? "10 7" : undefined} strokeLinecap="round" markerEnd={`url(#${marcador})`} />
        {texto}
      </>
    );
  }

  if (el.tipo === "personaje")
    return (
      <>
        <circle cx={el.x} cy={el.y} r="30" fill="transparent" />
        <g transform={giro}>
          <circle r="18" fill={PAPEL} stroke={TINTA} strokeWidth="3" />
          {/* La "nariz": hacia dónde mira. */}
          <polygon points="17,-9 31,0 17,9" fill={TINTA} />
        </g>
        {etiqueta(36)}
      </>
    );

  if (el.tipo === "camara") {
    const h = (((el.fov ?? 50) / 2) * Math.PI) / 180;
    const L = 240;
    return (
      <>
        <path d={`M 0 0 L ${L * Math.cos(h)} ${-L * Math.sin(h)} A ${L} ${L} 0 0 1 ${L * Math.cos(h)} ${L * Math.sin(h)} Z`} transform={giro} fill={TINTA} fillOpacity="0.07" stroke={TINTA} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="6 5" />
        <circle cx={el.x} cy={el.y} r="30" fill="transparent" />
        <g transform={giro}>
          <rect x="-18" y="-14" width="30" height="28" rx="4" fill={TINTA} />
          <polygon points="11,-7 24,-13 24,13 11,7" fill={TINTA} />
        </g>
        <text x={el.x - 3} y={el.y + 5} textAnchor="middle" fontFamily={LETRA} fontSize="14" fontWeight="700" fill={PAPEL}>
          {el.numero ?? "?"}
        </text>
        {etiqueta(38)}
      </>
    );
  }

  if (el.tipo === "luz")
    return (
      <>
        <polygon points="10,-8 170,-60 170,60 10,8" transform={giro} fill={LUZ} fillOpacity="0.22" />
        <circle cx={el.x} cy={el.y} r="28" fill="transparent" />
        <g transform={giro}>
          <circle r="13" fill={PAPEL} stroke={TINTA} strokeWidth="3" />
          <rect x="9" y="-11" width="5" height="22" fill={TINTA} />
          <circle r="4" fill={LUZ} />
        </g>
        {etiqueta(32)}
      </>
    );

  // Mueble o prop.
  const w = el.w ?? CUADRO * 2;
  const hh = el.h ?? CUADRO * 1.5;
  return (
    <>
      <rect x={-w / 2} y={-hh / 2} width={w} height={hh} transform={giro} fill={GRIS} fillOpacity="0.2" stroke={TINTA} strokeWidth="2" rx="3" />
      {el.etiqueta && (
        <text x={el.x} y={el.y + 4} textAnchor="middle" fontFamily={LETRA} fontSize="11" fontWeight="600" fill={TINTA}>
          {el.etiqueta.toUpperCase()}
        </text>
      )}
    </>
  );
}

// Lo elegido: aro rojo, asa para girar o asas en los extremos de las líneas.
// Lleva data-ui para que no salga en el PNG.
function Asas({ el, onAsa }: { el: Elemento; onAsa: (e: React.PointerEvent, tipo: "girar" | "p1" | "p2", id: string) => void }) {
  if (ES_LINEA[el.tipo]) {
    return (
      <g data-ui="1">
        <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} stroke={ROJO} strokeWidth="2" strokeDasharray="6 5" />
        {(["p1", "p2"] as const).map((p) => (
          <g key={p} onPointerDown={(e) => onAsa(e, p, el.id)} style={{ cursor: "grab" }}>
            <circle cx={p === "p1" ? el.x : el.x2} cy={p === "p1" ? el.y : el.y2} r="24" fill="transparent" />
            <circle cx={p === "p1" ? el.x : el.x2} cy={p === "p1" ? el.y : el.y2} r="10" fill={PAPEL} stroke={ROJO} strokeWidth="3" />
          </g>
        ))}
      </g>
    );
  }
  const radio = el.tipo === "mueble" ? Math.hypot(el.w ?? 80, el.h ?? 60) / 2 + 8 : 32;
  const asa = punta(el.x, el.y, el.rot, radio + 26);
  return (
    <g data-ui="1">
      <circle cx={el.x} cy={el.y} r={radio} fill="none" stroke={ROJO} strokeWidth="2" strokeDasharray="6 5" />
      <line x1={el.x} y1={el.y} x2={asa.x} y2={asa.y} stroke={ROJO} strokeWidth="2" />
      <g onPointerDown={(e) => onAsa(e, "girar", el.id)} style={{ cursor: "grab" }}>
        <circle cx={asa.x} cy={asa.y} r="24" fill="transparent" />
        <circle cx={asa.x} cy={asa.y} r="10" fill={ROJO} />
      </g>
    </g>
  );
}

// Lo que se cambia de lo elegido: nombre, giro, toma de la cámara, tamaño.
function Panel({
  el,
  tomas,
  onEditar,
  onRecordar,
  onQuitar
}: {
  el: Elemento;
  tomas: Plano[];
  onEditar: (c: Partial<Elemento>, conHistorial?: boolean) => void;
  onRecordar: () => void;
  onQuitar: () => void;
}) {
  const linea = ES_LINEA[el.tipo];
  const cm = (u: number | undefined) => Math.round((u ?? 0) * CM_POR_UNIDAD);
  return (
    <section className="tarjeta space-y-3" aria-label={`${NOMBRE[el.tipo]} elegido`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="etiqueta">{el.tipo === "flecha" ? (el.de === "camara" ? "Movimiento de cámara" : "Movimiento de actor") : NOMBRE[el.tipo]}</p>
        <button type="button" onClick={onQuitar} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>
          Quitar
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">Nombre</span>
        <input
          value={el.etiqueta}
          maxLength={40}
          onFocus={onRecordar}
          onChange={(e) => onEditar({ etiqueta: e.target.value }, false)}
          placeholder={el.tipo === "personaje" ? "Ej. JUAN" : el.tipo === "camara" ? "Ej. Cámara A" : el.tipo === "luz" ? "Ej. Key, fill, contra" : el.tipo === "mueble" ? "Ej. Sillón" : "Opcional"}
          className="campo py-2 text-sm"
        />
      </label>
      {!linea && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">Girar</span>
          <button type="button" aria-label="Girar 15 grados a la izquierda" onClick={() => onEditar({ rot: rotar(el.rot, -15) })} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>
            ↺ 15°
          </button>
          <button type="button" aria-label="Girar 15 grados a la derecha" onClick={() => onEditar({ rot: rotar(el.rot, 15) })} className={`${btnChico} bg-tinta/[0.06] hover:bg-tinta/[0.1]`}>
            ↻ 15°
          </button>
          <span className="cifra text-xs text-muted">{Math.round(el.rot)}°</span>
        </div>
      )}
      {el.tipo === "camara" && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Toma</span>
            <select value={el.numero ?? ""} onChange={(e) => onEditar({ numero: e.target.value ? Number(e.target.value) : null })} className="campo py-2 text-sm">
              <option value="">Sin toma</option>
              {[...new Set([...tomas.map((t) => t.numero), ...(el.numero ? [el.numero] : [])])]
                .sort((a, b) => a - b)
                .map((n) => {
                  const t = tomas.find((x) => x.numero === n);
                  return (
                    <option key={n} value={n}>
                      Toma {n}
                      {t ? ` · ${[t.tamano, t.movimiento].filter(Boolean).join(" ")}${t.descripcion ? ` · ${t.descripcion.slice(0, 40)}` : ""}` : ""}
                    </option>
                  );
                })}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold">Lente</span>
            {APERTURAS.map((a) => (
              <button key={a.v} type="button" aria-pressed={el.fov === a.v} onClick={() => onEditar({ fov: a.v })} className={`${btnChico} ${el.fov === a.v ? "bg-tinta text-fondo" : "bg-tinta/[0.06] hover:bg-tinta/[0.1]"}`}>
                {a.t}
              </button>
            ))}
          </div>
        </>
      )}
      {el.tipo === "flecha" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold">Quién se mueve</span>
          {(["actor", "camara"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={el.de === d} onClick={() => onEditar({ de: d })} className={`${btnChico} ${el.de === d ? "bg-tinta text-fondo" : "bg-tinta/[0.06] hover:bg-tinta/[0.1]"}`}>
              {d === "actor" ? "Actor" : "Cámara (punteada)"}
            </button>
          ))}
        </div>
      )}
      {el.tipo === "mueble" && (
        <div className="grid grid-cols-2 gap-2">
          {(["w", "h"] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-semibold">{k === "w" ? "Ancho (cm)" : "Fondo (cm)"}</span>
              <input
                type="number"
                inputMode="numeric"
                min={15}
                max={750}
                step={5}
                defaultValue={cm(el[k])}
                key={`${el.id}-${k}-${el[k]}`}
                onBlur={(e) => {
                  const v = Math.round(Number(e.target.value) / CM_POR_UNIDAD);
                  if (Number.isFinite(v) && v >= 10 && v <= 600 && v !== Math.round(el[k] ?? 0)) onEditar({ [k]: v });
                }}
                className="campo cifra py-2 text-sm"
              />
            </label>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted">Arrastra para mover{linea ? "; las bolitas rojas mueven cada punta" : "; la bolita roja lo gira"}. En teclado: flechas mueven, [ y ] giran, Supr quita.</p>
    </section>
  );
}
