"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { tutorialPara, type Paso } from "@/lib/claqueta/tutoriales";
import { Logo } from "./Logo";

// Tutorial guiado tipo videojuego (el mismo de EK Bars): oscurece la pantalla,
// ilumina un botón a la vez y explica qué hace, cuándo usarlo y un tip. Sale solo la
// primera vez en cada pantalla (se recuerda en este celular) y se repite con el
// botón "?" de arriba. Si un botón no está (celular vs escritorio), se salta.
// Precisión: se mide cuando el scroll ya se asentó, se sigue cuadro a cuadro
// y la tarjeta se acomoda donde no tape lo que se está explicando.

const CLAVE = (rol: string, t: string) => `claqueta-tutorial:v1:${rol}:${t}`;
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return "1"; } };
const guardar = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ } };

type ConVisibilidad = Element & { checkVisibility?: (o?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean };
// Visible de verdad: con tamaño, sin display:none/visibility:hidden/opacity 0 en
// ella o en sus papás, y fuera de zonas ocultas (aria-hidden, inert).
function visible(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const e = el as ConVisibilidad;
  if (typeof e.checkVisibility === "function") { if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; }
  else { const s = getComputedStyle(el); if (s.visibility === "hidden" || s.display === "none") return false; }
  return !el.closest("[aria-hidden='true'], [inert]");
}

// Fijo = vive en una barra (menú de abajo, encabezado, barra lateral): no hace falta hacer scroll.
function esFijo(el: Element) {
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    const pos = getComputedStyle(n).position;
    if (pos === "fixed" || pos === "sticky") return true;
  }
  return false;
}

// Selectores: "nav:/app/clases" (menú), "texto:button,a|^Reservar" (por texto),
// o CSS normal ([data-tour=x], [aria-label=...]). Con caja: se ilumina la tarjeta que lo contiene.
// Si hay varios, gana el primero visible DENTRO del contenido de la pantalla
// (así "[aria-expanded]" no agarra el botón Más del menú).
function candidatos(p: Paso): Element[] {
  if (!p.el) return [];
  if (p.el.startsWith("nav:")) {
    const href = p.el.slice(4);
    return href === "mas" ? [...document.querySelectorAll('button[aria-controls="menu-mas"]')] : [...document.querySelectorAll(`nav a[href="${href}"], header a[href="${href}"]`)];
  }
  let lista: Element[] = [];
  if (p.el.startsWith("texto:")) {
    const resto = p.el.slice(6), corte = resto.indexOf("|");
    const tags = resto.slice(0, corte), patron = resto.slice(corte + 1);
    const re = new RegExp(patron, "i");
    lista = [...document.querySelectorAll(tags)].filter((e) => re.test((e.textContent ?? "").replace(/\s+/g, " ").trim()));
  } else {
    try { lista = [...document.querySelectorAll(p.el)]; } catch { lista = []; }
  }
  const main = document.getElementById("contenido");
  return main ? [...lista.filter((e) => main.contains(e)), ...lista.filter((e) => !main.contains(e))] : lista;
}
function buscarBase(p: Paso): Element | null {
  return candidatos(p).find((e) => !e.closest("[data-tutorial]") && visible(e)) ?? null;
}
// Para contar pasos al empezar.
function buscar(p: Paso): Element | null {
  const el = buscarBase(p);
  return el && p.caja ? el.closest("section, .tarjeta, li") ?? el : el;
}

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8, M = 12, ANCHO_ESC = 360;
const igual = (a: Rect | null, b: Rect | null) => !!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// Ancho que de verdad se ve (si algo de la página se desborda, innerWidth crece).
const anchoVisible = () => Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth, window.visualViewport?.width ?? window.innerWidth);

// Zona útil de la pantalla: sin la barra de arriba ni la de abajo del celular.
function zonaUtil() {
  let top = 0, bottom = window.innerHeight;
  const arriba = document.querySelector("[data-barra=arriba]"), abajo = document.querySelector("[data-barra=abajo]");
  if (arriba && visible(arriba)) top = Math.max(top, arriba.getBoundingClientRect().bottom);
  if (abajo && visible(abajo)) bottom = Math.min(bottom, abajo.getBoundingClientRect().top);
  return { top: top + M, bottom: bottom - M };
}

// Mueve de lado un carrusel (por ejemplo, los días) para que el elemento se vea.
function mostrarDeLado(el: Element, comportamiento: ScrollBehavior) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    if ((s.overflowX === "auto" || s.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 1) {
      const r = el.getBoundingClientRect(), c = n.getBoundingClientRect();
      const delta = r.left < c.left ? r.left - c.left - 16 : r.right > c.right ? r.right - c.right + 16 : 0;
      if (delta) n.scrollBy({ left: delta, behavior: comportamiento });
      return;
    }
  }
}

export function Tutorial({ rol }: { rol: string }) {
  const ruta = usePathname() ?? "/app";
  const tour = useMemo(() => tutorialPara(rol, ruta), [rol, ruta]);
  const [activo, setActivo] = useState(false);
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [listo, setListo] = useState(false);
  const [animar, setAnimar] = useState(false);
  const [fin, setFin] = useState(false);
  const [alto, setAlto] = useState(240);
  const [pantalla, setPantalla] = useState({ w: 0, h: 0, segArriba: 0, segAbajo: 0 });
  const tarjeta = useRef<HTMLDivElement>(null);
  const direccion = useRef(1);

  const empezar = useCallback(() => {
    if (!tour) return;
    // Solo los pasos cuyo botón existe ahora (o los que no apuntan a nada).
    const ok = tour.pasos.filter((p) => !p.el || p.siempre || buscar(p));
    if (!ok.length) return;
    direccion.current = 1;
    setPasos(ok); setI(0); setFin(false); setRect(null); setListo(false); setActivo(true);
  }, [tour]);

  const terminar = useCallback((completo: boolean) => {
    if (tour) guardar(CLAVE(rol, tour.clave), completo ? "hecho" : "saltado");
    if (completo) { setFin(true); setTimeout(() => { setFin(false); setActivo(false); }, 1600); }
    else setActivo(false);
  }, [tour, rol]);

  const ir = useCallback((n: number) => {
    direccion.current = n >= i ? 1 : -1;
    if (n >= pasos.length) terminar(true);
    else if (n >= 0) setI(n);
  }, [i, pasos.length, terminar]);

  // Primera vez en esta pantalla: arranca solo (espera a que cargue).
  useEffect(() => {
    setActivo(false);
    if (!tour || ruta.startsWith("/app/tutorial")) return;
    if (leer(CLAVE(rol, tour.clave))) return;
    // Si la bienvenida, el cambio de contraseña o el aviso de instalar están abiertos, espera.
    let t = setTimeout(function intentar() {
      if (document.querySelector("[data-bienvenida], [data-contrasena], [data-instalar]")) { t = setTimeout(intentar, 1500); return; }
      empezar();
    }, 1200);
    return () => clearTimeout(t);
  }, [tour, rol, ruta, empezar]);

  // Botón "?" del encabezado y "Ver tutoriales otra vez" de Ajustes.
  useEffect(() => {
    const repetir = () => empezar();
    window.addEventListener("claqueta-tutorial", repetir);
    return () => window.removeEventListener("claqueta-tutorial", repetir);
  }, [empezar]);

  // Tamaño de pantalla y zonas seguras (muesca del iPhone), para acomodar la tarjeta.
  useEffect(() => {
    if (!activo) return;
    const sonda = document.createElement("div");
    sonda.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(sonda);
    const medirPantalla = () => {
      const cs = getComputedStyle(sonda);
      setPantalla({ w: anchoVisible(), h: window.innerHeight, segArriba: parseFloat(cs.paddingTop) || 0, segAbajo: parseFloat(cs.paddingBottom) || 0 });
    };
    medirPantalla();
    window.addEventListener("resize", medirPantalla);
    return () => { window.removeEventListener("resize", medirPantalla); sonda.remove(); };
  }, [activo]);

  // Alto real de la tarjeta (cambia con el texto de cada paso).
  useLayoutEffect(() => {
    const t = tarjeta.current;
    if (!t) return;
    setAlto(t.offsetHeight);
    const ro = new ResizeObserver(() => setAlto(t.offsetHeight));
    ro.observe(t);
    return () => ro.disconnect();
  }, [activo, fin, i]);

  const paso = pasos[i];

  // Cada paso: busca el elemento, lo trae a la vista (dejando lugar para la
  // tarjeta), espera a que el scroll se asiente y lo sigue cuadro a cuadro
  // (scroll, cambio de tamaño, imágenes que cargan). La tarjeta aparece hasta
  // que el elemento dejó de moverse.
  useEffect(() => {
    if (!activo || !paso) return;
    const base = paso.el ? buscarBase(paso) : null;
    if (!base) {
      // Su botón ya no está (se ocultó o cambió la pantalla): se salta en la dirección en que ibas.
      if (paso.el && !paso.siempre) { const sig = i + direccion.current; ir(sig < 0 ? i + 1 : sig); return; }
      setAnimar(true); setRect(null); setListo(true);
      return;
    }
    const zona = zonaUtil();
    const libre = zona.bottom - zona.top;
    // Con caja: la tarjeta completa, salvo que sea tan alta que no quepa junto con la tarjeta del tutorial.
    let el: Element = base;
    if (paso.caja) {
      const caja = base.closest("section, .tarjeta, li");
      if (caja && caja.getBoundingClientRect().height + PAD * 2 + alto + M * 2 <= libre) el = caja;
    }
    const comportamiento: ScrollBehavior = reducido() ? "auto" : "smooth";
    let movio = false;
    if (!esFijo(el)) {
      mostrarDeLado(el, comportamiento);
      const r = el.getBoundingClientRect();
      const espacio = alto + M * 2;
      const cabe = r.top - PAD >= zona.top && r.bottom + PAD <= zona.bottom && (r.top - PAD - zona.top >= espacio || zona.bottom - r.bottom - PAD >= espacio);
      if (!cabe) {
        // Si caben los dos, el elemento arriba y la tarjeta abajo; si no, el elemento pegado arriba.
        const sobra = libre - (r.height + PAD * 2) - espacio;
        const destino = zona.top + PAD + (sobra > 0 ? Math.min(sobra / 2, 80) : 0);
        window.scrollBy({ top: r.top - destino, behavior: comportamiento });
        movio = comportamiento === "smooth" && Math.abs(r.top - destino) > 2;
      }
    }
    setAnimar(!movio);
    setListo(!movio);

    let raf = 0, quietos = 0, cuadros = 0, ultimo: Rect | null = null, objetivo = el;
    const seguir = () => {
      if (!objetivo.isConnected) { const otro = paso.caja ? buscar(paso) : buscarBase(paso); if (otro) objetivo = otro; }
      const r = objetivo.getBoundingClientRect();
      const nuevo = { top: r.top, left: r.left, width: r.width, height: r.height };
      if (!igual(nuevo, ultimo)) { setRect(nuevo); quietos = 0; } else quietos++;
      ultimo = nuevo;
      cuadros++;
      if (movio && (quietos >= 5 || cuadros > 90)) { movio = false; setListo(true); }
      raf = requestAnimationFrame(seguir);
    };
    seguir();
    // Tras el cambio suave de paso, el foco ya sigue sin retraso.
    const t = setTimeout(() => setAnimar(false), 320);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // `alto` se lee al empezar el paso; no hace falta reiniciar si cambia después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, paso, i]);

  useEffect(() => {
    if (!activo) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminar(false);
      // Enter sobre un botón (Saltar, Atrás) deja que el botón haga lo suyo.
      if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.closest("button, a")) return;
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); ir(i + 1); }
      if (e.key === "ArrowLeft" && i > 0) ir(i - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [activo, i, ir, terminar]);

  if (!activo || !tour) return null;

  if (fin) {
    return (
      <div data-tutorial className="fixed inset-0 z-[95] grid place-items-center bg-black/70 p-6" role="status" aria-live="polite">
        <div className="tutorial-pop w-full max-w-xs rounded-[1.75rem] border border-borde bg-superficie p-6 text-center text-tinta shadow-2xl">
          <Logo className="mx-auto h-14 w-14" />
          <p className="etiqueta mt-3">Corte. Se queda</p>
          <p className="titulo text-3xl">{tour.titulo}</p>
          <p className="mt-1 text-sm font-semibold">Ya sabes usar esta pantalla.</p>
        </div>
      </div>
    );
  }
  if (!paso) return null;

  const W = pantalla.w || anchoVisible(), H = pantalla.h || window.innerHeight;
  // El foco no se sale de los lados de la pantalla (tarjetas a todo lo ancho en celular).
  const hueco = rect ? (() => { const l = Math.max(2, rect.left - PAD), r = Math.min(W - 2, rect.left + rect.width + PAD); return { top: rect.top - PAD, left: l, width: Math.max(0, r - l), height: rect.height + PAD * 2 }; })() : null;
  const escritorio = W >= 768;
  const arribaMin = M + pantalla.segArriba, abajoMax = H - M - pantalla.segAbajo;
  // La tarjeta NUNCA tapa lo iluminado: va abajo si cabe, si no arriba, si no
  // (escritorio) a un lado; solo si el elemento es enorme se encima lo mínimo.
  let estiloTarjeta: React.CSSProperties;
  if (!hueco || hueco.top + hueco.height < 0 || hueco.top > H) {
    estiloTarjeta = { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "min(92vw, 380px)" };
  } else {
    const ancho = escritorio ? ANCHO_ESC : W - M * 2;
    const abajoLibre = abajoMax - (hueco.top + hueco.height) - M, arribaLibre = hueco.top - M - arribaMin;
    const izq = escritorio ? Math.min(Math.max(M, hueco.left + hueco.width / 2 - ancho / 2), W - ancho - M) : M;
    let top: number;
    let lado: number | null = null;
    if (abajoLibre >= alto) top = escritorio ? hueco.top + hueco.height + M : abajoMax - alto;
    else if (arribaLibre >= alto) top = escritorio ? hueco.top - M - alto : arribaMin;
    else if (escritorio && W - (hueco.left + hueco.width) - M * 2 >= ancho) { lado = hueco.left + hueco.width + M; top = Math.min(Math.max(arribaMin, hueco.top), abajoMax - alto); }
    else if (escritorio && hueco.left - M * 2 >= ancho) { lado = hueco.left - M - ancho; top = Math.min(Math.max(arribaMin, hueco.top), abajoMax - alto); }
    else top = abajoLibre >= arribaLibre ? abajoMax - alto : arribaMin;
    estiloTarjeta = { position: "fixed", width: ancho, left: lado ?? izq, top: Math.max(arribaMin, top) };
  }

  return (
    <div data-tutorial className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label={`Tutorial: ${tour.titulo}`}>
      {/* Oscurece todo menos el botón (clic afuera no hace nada: el tutorial manda).
          Sin elemento, el hueco se cierra al centro y todo queda oscuro. */}
      <div
        className={`pointer-events-none fixed rounded-2xl ${hueco ? "tutorial-foco" : ""} ${animar ? "transition-[top,left,width,height] duration-300 ease-out" : ""}`}
        style={{ ...(hueco ?? { top: H / 2, left: W / 2, width: 0, height: 0 }), boxShadow: "0 0 0 9999px rgba(6,6,7,0.78)" }}
        aria-hidden
      />
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      <div
        key={i}
        ref={tarjeta}
        className={`rounded-[1.75rem] border border-borde bg-superficie p-4 text-tinta shadow-2xl ${listo ? "tutorial-pop" : "pointer-events-none opacity-0"}`}
        style={estiloTarjeta}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <Logo className="h-11 w-11 flex-none" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{i === 0 ? `Tutorial · ${tour.titulo}` : `Paso ${i + 1} de ${pasos.length}`}</p>
            <p className="titulo mt-0.5 text-xl leading-tight">{paso.titulo}</p>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{paso.texto}</p>
        {paso.cuando && <p className="mt-2 rounded-2xl bg-fondo px-3 py-2 text-xs"><b>Úsalo cuando:</b> {paso.cuando}</p>}
        {paso.tip && <p className="mt-2 text-xs text-muted"><b className="text-rojo">Tip:</b> {paso.tip}</p>}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-borde" aria-hidden><div className="h-full rounded-full bg-rojo transition-all" style={{ width: `${((i + 1) / pasos.length) * 100}%` }} /></div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => terminar(false)} className="min-h-11 rounded-full px-2 text-sm font-semibold text-muted [@media(hover:hover)]:hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">Saltar</button>
          <div className="flex-1" />
          {i > 0 && <button type="button" onClick={() => ir(i - 1)} className="btn-secundario min-h-11 px-4 text-sm">Atrás</button>}
          <button type="button" autoFocus onClick={() => ir(i + 1)} className="btn-primario min-h-11 px-5 text-sm">{i + 1 < pasos.length ? (i === 0 ? "Empezar" : "Siguiente") : "Listo"}</button>
        </div>
      </div>
    </div>
  );
}

// Botón "?" para repetir el tutorial de la pantalla actual. Si la pantalla no
// tiene tutorial para este rol, no se muestra.
export function BotonTutorial({ rol, className = "" }: { rol: string; className?: string }) {
  const ruta = usePathname() ?? "/app";
  if (!tutorialPara(rol, ruta)) return null;
  return (
    <button type="button" data-tour="ayuda" onClick={() => window.dispatchEvent(new Event("claqueta-tutorial"))} aria-label="Ver el tutorial de esta pantalla" title="Tutorial de esta pantalla" className={className || "vidrio grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-tinta transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo"}>
      ?
    </button>
  );
}

// Para Ajustes: borra lo visto y todos los tutoriales vuelven a salir.
export function reiniciarTutoriales() {
  try { Object.keys(localStorage).filter((k) => k.startsWith("claqueta-tutorial:")).forEach((k) => localStorage.removeItem(k)); } catch { /* nada */ }
}
