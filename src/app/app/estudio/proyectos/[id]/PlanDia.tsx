"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { agregarBloque, archivarBloque, armarPlanDesdePlanos, editarBloque, marcarBloque } from "./acciones-equipo";
import { ritmoDelDia, textoRitmo, type BloquePlan } from "@/lib/claqueta/puestos";
import { minutosAhoraCDMX } from "@/lib/claqueta/fechas";
import type { BloqueDia } from "@/lib/claqueta/datos-estudio";

const TIPOS = [
  { v: "llamado", t: "Llamado" },
  { v: "montaje", t: "Montaje" },
  { v: "ensayo", t: "Ensayo" },
  { v: "toma", t: "Toma" },
  { v: "comida", t: "Comida" },
  { v: "traslado", t: "Traslado" },
  { v: "cierre", t: "Cierre" },
  { v: "otro", t: "Otro" }
];
const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const minDe = (ts: string | null) => (ts ? minutosAhoraCDMX(new Date(ts)) : null);
const fechaLarga = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// PLAN MINUTO A MINUTO · lo arma dirección/producción; todos ven en vivo dónde vamos.
export function PlanDia({ proyectoId, bloques, diasRodaje, hoy, puedeEditar }: { proyectoId: string; bloques: BloqueDia[]; diasRodaje: string[]; hoy: string; puedeEditar: boolean }) {
  const router = useRouter();
  const dias = useMemo(() => [...new Set([...diasRodaje, ...bloques.map((b) => b.fecha)])].sort(), [diasRodaje, bloques]);
  const [dia, setDia] = useState(() => (dias.includes(hoy) ? hoy : dias.find((d) => d >= hoy) ?? dias[dias.length - 1] ?? hoy));
  const [ahora, setAhora] = useState(() => minutosAhoraCDMX());
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [llamado, setLlamado] = useState("07:00");

  // Reloj y datos frescos: cada 30 s en el día de hoy (para ver lo que marca el AD en set).
  useEffect(() => {
    const t = setInterval(() => {
      setAhora(minutosAhoraCDMX());
      if (dia === hoy) router.refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [dia, hoy, router]);

  const correr = (f: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>) =>
    iniciar(async () => {
      setError(null);
      setMensaje(null);
      const r = await f();
      if (!r.ok) setError(r.error ?? "No se pudo.");
      else if (r.mensaje) setMensaje(r.mensaje);
    });

  const delDia = bloques.filter((b) => b.fecha === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const esHoy = dia === hoy;
  const ritmo = esHoy
    ? ritmoDelDia(
        delDia.map<BloquePlan>((b) => ({ id: b.id, inicio: b.inicio, minutos: b.minutos, estado: b.estado, empezo: minDe(b.empezo_en), termino: minDe(b.termino_en) })),
        ahora
      )
    : null;
  const r = ritmo ? textoRitmo(ritmo.minutos) : null;
  const fin = delDia.length ? Math.max(...delDia.map((b) => aMin(b.inicio) + b.minutos)) : null;
  const finEstimado = fin !== null && ritmo ? fin + Math.max(0, ritmo.minutos) : fin;
  const hechos = delDia.filter((b) => b.estado === "hecho").length;

  return (
    <div className="space-y-5">
      <nav aria-label="Días de rodaje" className="sin-barra -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {dias.length === 0 && <p className="text-sm text-muted">Aún no hay días de rodaje. Asígnalos en Plan de rodaje o elige una fecha abajo.</p>}
        {dias.map((d) => (
          <button key={d} type="button" aria-pressed={d === dia} onClick={() => setDia(d)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize ${d === dia ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"}`}>
            {d === hoy ? "Hoy" : new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
          </button>
        ))}
        {puedeEditar && (
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Otro día" className="campo w-auto shrink-0 rounded-full py-2 font-mono text-sm" />
        )}
      </nav>

      <section className={`tarjeta flex flex-wrap items-center justify-between gap-4 ${r?.tono === "rojo" ? "ring-2 ring-rojo" : ""}`} aria-live="polite">
        <div>
          <p className="etiqueta capitalize">{fechaLarga(dia)}</p>
          {r ? (
            <p className={`titulo text-4xl ${r.tono === "rojo" ? "text-rojo" : r.tono === "aviso" ? "text-acento" : "text-ok"}`}>{r.texto}</p>
          ) : (
            <p className="titulo text-4xl">{delDia.length ? `${delDia.length} bloques` : "Sin plan todavía"}</p>
          )}
          {ritmo?.actual && <p className="mt-1 text-sm">Ahora: <span className="font-semibold">{delDia.find((b) => b.id === ritmo.actual)?.titulo}</span></p>}
          {ritmo?.siguiente && <p className="text-sm text-muted">Sigue: {delDia.find((b) => b.id === ritmo.siguiente)?.titulo}</p>}
        </div>
        <div className="text-right">
          {esHoy && <p className="cifra text-3xl font-semibold text-rojo">{hh(ahora)}</p>}
          {finEstimado !== null && <p className="cifra text-sm text-muted">Terminamos ≈ {hh(finEstimado)}</p>}
          {delDia.length > 0 && <p className="cifra text-xs text-muted">{hechos}/{delDia.length} hechos</p>}
        </div>
      </section>

      {error && <p className="alerta-error" role="alert">{error}</p>}
      {mensaje && <p className="alerta-ok" role="status">{mensaje}</p>}

      {delDia.length === 0 && puedeEditar && (
        <section className="tarjeta space-y-3">
          <h3 className="titulo text-2xl">Armarlo solo</h3>
          <p className="text-sm text-muted">Toma las escenas de este día (Plan de rodaje) y sus planos con minutos, y arma: llamado, montaje, cada plano, comida a media jornada y cierre.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              Llamado
              <input type="time" value={llamado} onChange={(e) => setLlamado(e.target.value)} className="campo w-auto rounded-full py-2 font-mono text-sm" />
            </label>
            <button type="button" disabled={pendiente} onClick={() => correr(() => armarPlanDesdePlanos(proyectoId, dia, llamado))} className="btn-rojo">
              Armar plan del día
            </button>
          </div>
        </section>
      )}

      <ol className="space-y-2">
        {delDia.map((b) => {
          const ini = aMin(b.inicio);
          const real = minDe(b.empezo_en);
          const realFin = minDe(b.termino_en);
          const tarde = real !== null && real - ini > 5;
          const vencido = esHoy && b.estado === "pendiente" && ahora > ini + 5;
          return (
            <li
              key={b.id}
              className={`tarjeta grid items-center gap-3 p-4 md:grid-cols-[8.5rem_minmax(0,1fr)_auto] ${b.estado === "en_curso" ? "ring-2 ring-rojo" : ""} ${b.estado === "hecho" ? "opacity-60" : ""}`}
            >
              <div>
                {puedeEditar && b.estado === "pendiente" ? (
                  <input type="time" defaultValue={b.inicio.slice(0, 5)} aria-label={`Hora de ${b.titulo}`} onBlur={(e) => e.target.value && e.target.value !== b.inicio.slice(0, 5) && correr(() => editarBloque(proyectoId, b.id, { inicio: e.target.value }))} className="campo rounded-full py-1.5 font-mono text-sm" />
                ) : (
                  <p className="cifra text-lg font-semibold">{b.inicio.slice(0, 5)}</p>
                )}
                <p className="cifra text-[11px] text-muted">{b.minutos} min · hasta {hh(ini + b.minutos)}</p>
              </div>
              <div className="min-w-0">
                <p className="etiqueta">{TIPOS.find((t) => t.v === b.tipo)?.t ?? b.tipo}</p>
                <p className="font-semibold">{b.titulo}</p>
                {real !== null && (
                  <p className={`cifra text-xs ${tarde ? "text-rojo" : "text-muted"}`}>
                    Empezó {hh(real)}{realFin !== null ? ` · terminó ${hh(realFin)} (${realFin - real} min)` : ""}
                  </p>
                )}
                {vencido && <p className="text-xs font-semibold text-rojo">Ya debió empezar</p>}
              </div>
              {puedeEditar && (
                <div className="flex flex-wrap gap-1.5">
                  {b.estado === "pendiente" && (
                    <>
                      <input type="number" min={1} max={720} defaultValue={b.minutos} aria-label={`Minutos de ${b.titulo}`} onBlur={(e) => Number(e.target.value) !== b.minutos && correr(() => editarBloque(proyectoId, b.id, { minutos: Number(e.target.value) }))} className="campo w-20 rounded-full py-1.5 font-mono text-sm" />
                      <button type="button" disabled={pendiente} onClick={() => correr(() => marcarBloque(proyectoId, b.id, "en_curso"))} className="btn-rojo px-4 py-1.5">Empezar</button>
                    </>
                  )}
                  {b.estado === "en_curso" && (
                    <button type="button" disabled={pendiente} onClick={() => correr(() => marcarBloque(proyectoId, b.id, "hecho"))} className="btn-primario px-4 py-1.5">Terminar</button>
                  )}
                  {b.estado !== "pendiente" && (
                    <button type="button" disabled={pendiente} onClick={() => correr(() => marcarBloque(proyectoId, b.id, "pendiente"))} className="btn-secundario px-3 py-1.5">Deshacer</button>
                  )}
                  {b.estado === "pendiente" && (
                    <button type="button" aria-label={`Quitar ${b.titulo}`} onClick={() => correr(() => archivarBloque(proyectoId, b.id))} className="px-2 text-muted hover:text-tinta">✕</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {puedeEditar && <NuevoBloque onAgregar={(c) => correr(() => agregarBloque(proyectoId, { fecha: dia, ...c }))} sugerida={fin !== null ? hh(fin) : llamado} pendiente={pendiente} />}
      {!puedeEditar && <p className="text-xs text-muted">El plan lo arma y lo avanza dirección. Aquí ves en vivo dónde van; se actualiza solo.</p>}
    </div>
  );
}

function NuevoBloque({ onAgregar, sugerida, pendiente }: { onAgregar: (c: { inicio: string; minutos: number; titulo: string; tipo: string }) => void; sugerida: string; pendiente: boolean }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("toma");
  const [inicio, setInicio] = useState(sugerida);
  const [minutos, setMinutos] = useState(20);
  useEffect(() => setInicio(sugerida), [sugerida]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAgregar({ inicio, minutos, titulo, tipo });
        setTitulo("");
      }}
      className="tarjeta space-y-3"
    >
      <h3 className="titulo text-xl">Agregar bloque</h3>
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => (
          <button key={t.v} type="button" aria-pressed={tipo === t.v} onClick={() => setTipo(t.v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tipo === t.v ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"}`}>
            {t.t}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[8.5rem_6rem_1fr_auto]">
        <input type="time" required value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="Hora de inicio" className="campo rounded-full py-2 font-mono text-sm" />
        <input type="number" min={1} max={720} required value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} aria-label="Minutos" className="campo rounded-full py-2 font-mono text-sm" />
        <input required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Qué se hace, ej. Plano 2B o Traslado a la azotea" aria-label="Qué se hace" className="campo rounded-full py-2 text-sm" />
        <button type="submit" disabled={pendiente} className="btn-primario">Agregar</button>
      </div>
    </form>
  );
}
