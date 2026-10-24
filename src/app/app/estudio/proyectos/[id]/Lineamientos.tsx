"use client";

import { useState, useTransition } from "react";
import { archivarLineamiento, cambiarCategoria, importarLineamientos, marcarLineamiento } from "./acciones-equipo";
import { CATEGORIAS_PROYECTO, revisar, type Regla } from "@/lib/claqueta/lineamientos";
import type { LineamientoGuardado, Plano } from "@/lib/claqueta/datos-estudio";

// LINEAMIENTOS · los de la tarea, revisados solos contra el shotlist cuando se
// puede (tope, movimientos, POV, insert, over-shoulder); lo demás, a mano.
export function Lineamientos({ proyectoId, lineamientos, planos, puedeEditar, compacto = false }: { proyectoId: string; lineamientos: LineamientoGuardado[]; planos: Plano[]; puedeEditar: boolean; compacto?: boolean }) {
  const [texto, setTexto] = useState("");
  const [pegar, setPegar] = useState(lineamientos.length === 0);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (f: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>) =>
    iniciar(async () => {
      const r = await f();
      setMsg(r.ok ? (r.mensaje ? { ok: true, t: r.mensaje } : null) : { ok: false, t: r.error ?? "No se pudo." });
    });

  const filas = lineamientos.map((l) => {
    const auto = revisar({ regla: l.regla as Regla, valor: l.valor }, planos);
    return { ...l, ok: auto.ok === null ? l.cumplido : auto.ok, auto: auto.ok !== null, detalle: auto.detalle };
  });
  const cumplidos = filas.filter((f) => f.ok).length;

  if (!lineamientos.length && !puedeEditar) return null;
  return (
    <section className="tarjeta space-y-3" aria-labelledby="lineamientos">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="lineamientos" className="titulo text-2xl">Lineamientos de la tarea</h3>
        {filas.length > 0 && (
          <span className={`cifra text-sm font-semibold ${cumplidos === filas.length ? "text-ok" : "text-muted"}`}>
            {cumplidos} de {filas.length} cumplidos
          </span>
        )}
      </div>
      {filas.length > 0 && (
        <ul className="divide-y divide-borde/60">
          {(compacto ? filas.filter((f) => f.auto || !f.ok) : filas).map((f) => (
            <li key={f.id} className="flex items-start gap-3 py-2.5">
              {f.auto ? (
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${f.ok ? "bg-ok" : "bg-rojo"}`} aria-label={f.ok ? "Se cumple" : "No se cumple"}>
                  {f.ok ? "✓" : "✕"}
                </span>
              ) : (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={f.cumplido}
                  disabled={!puedeEditar || pendiente}
                  onClick={() => correr(() => marcarLineamiento(proyectoId, f.id, !f.cumplido))}
                  aria-label={`${f.texto}: palomear a mano`}
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-xs font-bold ${f.cumplido ? "border-ok bg-ok text-white" : "border-tinta/30"}`}
                >
                  {f.cumplido && "✓"}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${f.ok ? "text-muted" : ""}`}>{f.texto}</p>
                <p className="text-[11px] text-muted">{f.auto ? `Se revisa solo · ${f.detalle}` : "Se palomea a mano"}</p>
              </div>
              {puedeEditar && !compacto && (
                <button type="button" aria-label={`Quitar ${f.texto}`} onClick={() => correr(() => archivarLineamiento(proyectoId, f.id))} className="text-muted hover:text-tinta">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puedeEditar && !compacto && (
        pegar ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              correr(async () => {
                const r = await importarLineamientos(proyectoId, texto);
                if (r.ok) {
                  setTexto("");
                  setPegar(false);
                }
                return r;
              });
            }}
            className="space-y-2"
          >
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              maxLength={8000}
              placeholder={"Pega aquí los lineamientos de la tarea (cópialos del PDF). Ej.:\n14 tomas máximo.\nNo usar zoom, dolly ni cámara en mano.\nIncluir un insert y un POV."}
              aria-label="Lineamientos de la tarea"
              className="campo text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pendiente || !texto.trim()} className="btn-rojo">
                {pendiente ? "Leyendo…" : "Convertir en lista"}
              </button>
              {lineamientos.length > 0 && (
                <button type="button" onClick={() => setPegar(false)} className="btn-secundario">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setPegar(true)} className="text-sm font-semibold text-muted underline-offset-4 hover:text-tinta hover:underline">
            + Pegar más lineamientos
          </button>
        )
      )}
      {msg && <p className={msg.ok ? "alerta-ok" : "alerta-error"}>{msg.t}</p>}
    </section>
  );
}

// Selector del tipo de proyecto (dirección).
export function SelectorCategoria({ proyectoId, categoria }: { proyectoId: string; categoria: string | null }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <select
      defaultValue={categoria ?? ""}
      disabled={pendiente}
      onChange={(e) => iniciar(async () => void (await cambiarCategoria(proyectoId, e.target.value || null)))}
      aria-label="Tipo de proyecto"
      className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs font-semibold"
    >
      <option value="">Tipo de proyecto…</option>
      {CATEGORIAS_PROYECTO.map((c) => (
        <option key={c.v} value={c.v}>
          {c.t}
        </option>
      ))}
    </select>
  );
}
