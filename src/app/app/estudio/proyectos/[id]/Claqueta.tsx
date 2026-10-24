"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { editarPlano } from "../../acciones";
import { escenasDe, type Linea } from "@/lib/claqueta/estudio";
import type { Plano } from "@/lib/claqueta/datos-estudio";

// CLAQUETA DIGITAL · la pizarra del set. Cada "¡Acción!" suma una toma al
// plano (queda en el shotlist y en el reporte). Pantalla grande, alto contraste.
export function ClaquetaDigital({
  proyectoId,
  nombre,
  lineas,
  planos,
  director,
  camara,
  puedeAnotar,
  hoy
}: {
  proyectoId: string;
  nombre: string;
  lineas: Linea[];
  planos: Plano[];
  director: string;
  camara: string;
  puedeAnotar: boolean;
  hoy: string;
}) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const lista = useMemo(
    () =>
      escenas.flatMap((e) =>
        planos
          .filter((p) => p.escena_id === e.id)
          .sort((a, b) => a.orden - b.orden)
          .map((p) => ({ ...p, codigo: `${e.numero}${String.fromCharCode(64 + Math.min(p.numero, 26))}`, escena: e.numero }))
      ),
    [escenas, planos]
  );
  const primeroSinFilmar = Math.max(0, lista.findIndex((p) => !p.filmado));
  const [i, setI] = useState(primeroSinFilmar);
  const [tomas, setTomas] = useState<Record<string, number>>({});
  const [cerrada, setCerrada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const p = lista[Math.min(i, lista.length - 1)];
  const toma = p ? (tomas[p.id] ?? p.tomas) : 0;

  // La pantalla no se apaga mientras están filmando.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  if (!p) return <p className="tarjeta text-sm text-muted">Primero arma el shotlist: cada plano sale aquí en orden para filmarlo.</p>;

  const accion = () => {
    if (!puedeAnotar) return;
    const nueva = toma + 1;
    setTomas((t) => ({ ...t, [p.id]: nueva }));
    setCerrada(true);
    setTimeout(() => setCerrada(false), 450);
    golpe();
    iniciar(async () => {
      const r = await editarPlano(proyectoId, p.id, { tomas: nueva });
      if (!r.ok) setError(r.error ?? "No se anotó la toma.");
    });
  };
  const buena = () =>
    iniciar(async () => {
      const r = await editarPlano(proyectoId, p.id, { toma_buena: toma || null, filmado: true });
      if (!r.ok) setError(r.error ?? "No se guardó.");
      else if (i < lista.length - 1) setI(i + 1);
    });
  const fecha = hoy.split("-").reverse().join(".");

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] bg-[#0A0A0A] text-[#EBE7E0] shadow-suave">
        {/* Barras de la claqueta */}
        <div className={`origin-left transition-transform duration-200 ${cerrada ? "rotate-0" : "-rotate-[8deg]"}`} aria-hidden="true">
          <div className="h-10 bg-[repeating-linear-gradient(135deg,#EBE7E0_0_26px,#0A0A0A_26px_52px)]" />
        </div>
        <div className="h-10 bg-[repeating-linear-gradient(45deg,#EBE7E0_0_26px,#0A0A0A_26px_52px)]" aria-hidden="true" />
        <div className="grid grid-cols-3 border-b border-[#EBE7E0]/25">
          <Celda k="Producción" v={nombre} ancho />
        </div>
        <div className="grid grid-cols-3 divide-x divide-[#EBE7E0]/25 border-b border-[#EBE7E0]/25">
          <Celda k="Escena" v={String(p.escena)} grande />
          <Celda k="Plano" v={p.codigo} grande />
          <Celda k="Toma" v={String(toma || 1)} grande rojo />
        </div>
        <div className="grid grid-cols-3 divide-x divide-[#EBE7E0]/25">
          <Celda k="Director" v={director} />
          <Celda k="Cámara" v={camara} />
          <Celda k="Fecha" v={fecha} />
        </div>
        <p className="border-t border-[#EBE7E0]/25 px-5 py-3 text-sm text-[#EBE7E0]/70">
          {[p.tamano, p.movimiento, p.lente].filter(Boolean).join(" · ")}
          {p.descripcion ? ` — ${p.descripcion}` : ""}
        </p>
      </div>

      {error && <p className="alerta-error mx-auto max-w-3xl">{error}</p>}
      <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr_auto] gap-2">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="btn-secundario px-5 py-4 text-lg" aria-label="Plano anterior">
          ◀
        </button>
        {puedeAnotar ? (
          <button type="button" onClick={accion} className="rounded-full bg-rojo py-4 text-xl font-bold uppercase tracking-wider text-white shadow-[0_14px_36px_-12px_rgb(255_0_0/0.8)] transition active:scale-95">
            ¡Acción! · toma {toma + 1}
          </button>
        ) : (
          <p className="grid place-items-center text-center text-sm text-muted">Las tomas las anota dirección o foto.</p>
        )}
        <button type="button" onClick={() => setI(Math.min(lista.length - 1, i + 1))} disabled={i >= lista.length - 1} className="btn-secundario px-5 py-4 text-lg" aria-label="Plano siguiente">
          ▶
        </button>
      </div>
      {puedeAnotar && toma > 0 && (
        <div className="mx-auto max-w-3xl text-center">
          <button type="button" onClick={buena} className="btn-primario px-6 py-3">
            Toma {toma} buena ✓ · siguiente plano
          </button>
        </div>
      )}
      <p className="cifra text-center text-xs text-muted">
        Plano {Math.min(i, lista.length - 1) + 1} de {lista.length} · {lista.filter((x) => x.filmado).length} filmados
      </p>
    </div>
  );
}

function Celda({ k, v, grande, rojo, ancho }: { k: string; v: string; grande?: boolean; rojo?: boolean; ancho?: boolean }) {
  return (
    <div className={`px-5 py-3 ${ancho ? "col-span-3" : ""}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#EBE7E0]/55">{k}</p>
      <p className={`titulo truncate leading-none ${grande ? "mt-1 text-[clamp(3rem,12vw,6rem)]" : "mt-1 text-2xl"} ${rojo ? "text-[#FF0000]" : ""}`}>{v}</p>
    </div>
  );
}

// Golpe de claqueta seco y corto (sin archivo de audio): ruido filtrado + click.
function golpe() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const dur = 0.09;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let n = 0; n < d.length; n++) d[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / d.length, 6);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 2600;
    filtro.Q.value = 0.9;
    const vol = ctx.createGain();
    vol.gain.value = 0.9;
    src.connect(filtro).connect(vol).connect(ctx.destination);
    src.start();
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    /* sin audio no pasa nada */
  }
}
