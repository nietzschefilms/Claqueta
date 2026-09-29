"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { guardarBloque, quitarBloque, type Resultado } from "./acciones";
import { FRENTES, type FrenteId } from "@/lib/claqueta/frentes";
import { useFrentes } from "@/components/claqueta/ContextoEquipo";
import { estiloFrente } from "@/components/claqueta/frente-ui";

type Datos = { id?: string; weekday: number; inicio: string; fin: string; label: string; kind: "focus" | "fixed"; areas: FrenteId[]; salon?: string | null };

const chip = (on: boolean) =>
  `rounded-full px-3 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
    on ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"
  }`;

// Un bloque de la rutina: se ve compacto y al tocarlo se edita ahí mismo.
export function EditorBloque({ b, nuevo = false }: { b: Datos; nuevo?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(guardarBloque, null);
  const [kind, setKind] = useState(b.kind);
  const [areas, setAreas] = useState<FrenteId[]>(b.areas);
  const [seguro, setSeguro] = useState(false);
  const frentes = useFrentes();
  const [quitando, iniciar] = useTransition();

  useEffect(() => {
    if (estado?.ok) setAbierto(false);
  }, [estado]);

  const alternar = (f: FrenteId) => setAreas((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]));
  const color = b.kind === "focus" && b.areas[0] ? estiloFrente(b.areas[0]) : undefined;

  if (!abierto)
    return nuevo ? (
      <button type="button" onClick={() => setAbierto(true)} className="w-full rounded-2xl border border-dashed border-tinta/25 px-4 py-3 text-sm font-semibold text-muted transition hover:border-tinta/50 hover:text-tinta">
        + Agregar bloque
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={color}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-tinta/[0.04] ${b.kind === "focus" ? "bg-[rgb(var(--fc,var(--c-tinta))/0.07)]" : ""}`}
      >
        <span className="cifra w-24 shrink-0 text-xs text-muted">{b.inicio} – {b.fin}</span>
        <span className={`h-5 w-1 shrink-0 rounded-full ${b.kind === "focus" ? "bg-[rgb(var(--fc,var(--c-borde)))]" : "bg-transparent"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${b.kind === "focus" ? "font-semibold" : "text-muted"}`}>{b.label}</span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-muted">
            {b.kind === "fixed" ? (b.salon ? `Clase · ${b.salon}` : "Fijo") : b.areas.length ? b.areas.map((a) => FRENTES[a]?.corto).join(" + ") : "Libre"}
          </span>
        </span>
        <span className="text-xs text-muted" aria-hidden="true">Editar</span>
      </button>
    );

  return (
    <form action={enviar} className="vidrio space-y-4 rounded-2xl p-4">
      {b.id && <input type="hidden" name="id" value={b.id} />}
      <input type="hidden" name="weekday" value={b.weekday} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="areas" value={areas.join(",")} />

      <input name="label" required maxLength={80} defaultValue={b.label} placeholder="Nombre del bloque" aria-label="Nombre del bloque" className="campo rounded-full py-2.5 font-semibold" />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="etiqueta">Empieza</span>
          <input type="time" name="inicio" required defaultValue={b.inicio} className="campo mt-1 rounded-full py-2 font-mono" />
        </label>
        <label className="block">
          <span className="etiqueta">Termina</span>
          <input type="time" name="fin" required defaultValue={b.fin} className="campo mt-1 rounded-full py-2 font-mono" />
        </label>
      </div>

      <fieldset>
        <legend className="etiqueta">Tipo</legend>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-tinta/[0.06] p-1">
          <button type="button" aria-pressed={kind === "focus"} onClick={() => setKind("focus")} className={chip(kind === "focus")}>Trabajo</button>
          <button type="button" aria-pressed={kind === "fixed"} onClick={() => setKind("fixed")} className={chip(kind === "fixed")}>Fijo (comida, clase…)</button>
        </div>
      </fieldset>

      {kind === "focus" && (
        <fieldset>
          <legend className="etiqueta">Para qué frente</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {frentes.map((f) => (
              <button key={f.id} type="button" aria-pressed={areas.includes(f.id)} onClick={() => alternar(f.id)} style={estiloFrente(f.id)} className={`flex items-center gap-1.5 ${chip(areas.includes(f.id))}`}>
                <span className="h-2 w-2 rounded-full bg-[rgb(var(--fc))]" aria-hidden="true" />
                {f.corto}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">{areas.length ? "Se llena con tareas de estos frentes." : "Sin frente = bloque libre: se llena con lo más urgente de cualquiera."}</p>
        </fieldset>
      )}

      {estado?.error && <p className="alerta-error" role="alert">{estado.error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className="btn-primario flex-1">{enviando ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={() => setAbierto(false)} className="btn-secundario">Cancelar</button>
        {b.id && (
          <button
            type="button"
            disabled={quitando}
            onClick={() => (seguro ? iniciar(async () => void (await quitarBloque(b.id!))) : setSeguro(true))}
            className={`btn ${seguro ? "bg-rojo text-white" : "text-acento hover:bg-rojo/10"}`}
          >
            {quitando ? "…" : seguro ? "¿Quitar bloque?" : "Quitar"}
          </button>
        )}
      </div>
    </form>
  );
}
