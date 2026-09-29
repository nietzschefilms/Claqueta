"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { actualizarProspecto, crearProspecto, type Resultado } from "../acciones";
import type { EstadoProspecto, Prospecto } from "@/lib/claqueta/datos-estudio";

type Miembro = { id: string; nombre: string };

export const ESTADOS: { v: EstadoProspecto; t: string; clase: string }[] = [
  { v: "pendiente", t: "Pendiente", clase: "bg-tinta/[0.06] text-muted" },
  { v: "contactado", t: "Contactado", clase: "bg-aviso/15 text-tinta" },
  { v: "respondio", t: "Respondió", clase: "bg-ok/15 text-tinta" },
  { v: "reunion", t: "Reunión", clase: "bg-ok/25 text-tinta" },
  { v: "cotizado", t: "Cotizado", clase: "bg-f-nietzsche/25 text-tinta" },
  { v: "cerrado", t: "Cerrado ✓", clase: "bg-ok text-white" },
  { v: "descartado", t: "Descartado", clase: "bg-tinta/[0.04] text-muted line-through" }
];
const infoEstado = (v: EstadoProspecto) => ESTADOS.find((e) => e.v === v) ?? ESTADOS[0];

const chip = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
    on ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"
  }`;

const soloDigitos = (t: string) => t.replace(/\D/g, "");

// Mensaje corto para el DM (lo que más funciona con negocios recién abiertos).
function mensajeDM(p: Prospecto, firma: string) {
  return `Hola, ¿qué tal? Somos ${firma} de Nietzsche Studios. Vimos que ${p.nombre} acaba de abrir${p.zona ? ` en ${p.zona}` : ""} y se nos ocurrió un spot para ustedes: un día de rodaje, un spot principal y cortes para reels y pauta, entregado en una semana, por $14,000. ¿Les mando un ejemplo de lo que hacemos?`;
}

// Radar compartido: estado, responsable y seguimiento se ven en vivo para los dos.
export function Radar({ inicial, miembros, yo, equipoId, hoy }: { inicial: Prospecto[]; miembros: Miembro[]; yo: string; equipoId: string; hoy: string }) {
  const [lista, setLista] = useState(inicial);
  const [filtro, setFiltro] = useState<"activos" | "mios" | "todos" | EstadoProspecto>("activos");
  const [buscar, setBuscar] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const firma = miembros.map((m) => m.nombre.split(" ")[0]).join(" y ");

  // Tiempo real: lo que cambie tu compañero aparece sin recargar.
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`radar:${equipoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "prospectos", filter: `equipo_id=eq.${equipoId}` }, (p) => {
        const nuevo = p.new as Prospecto;
        if (!nuevo?.id) return;
        setLista((l) => (l.some((x) => x.id === nuevo.id) ? l.map((x) => (x.id === nuevo.id ? { ...x, ...nuevo } : x)) : [...l, nuevo]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [equipoId]);

  useEffect(() => setLista(inicial), [inicial]);

  const cambiar = (id: string, patch: Partial<Prospecto>) => setLista((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return lista
      .filter((p) => {
        if (q && !`${p.nombre} ${p.zona ?? ""} ${p.giro ?? ""}`.toLowerCase().includes(q)) return false;
        if (filtro === "todos") return true;
        if (filtro === "activos") return !["cerrado", "descartado"].includes(p.estado);
        if (filtro === "mios") return p.responsable === yo;
        return p.estado === filtro;
      })
      .sort((a, b) => {
        // Primero los que tienen seguimiento vencido, luego por estado y nombre.
        const va = a.siguiente_fecha && a.siguiente_fecha <= hoy ? 0 : 1;
        const vb = b.siguiente_fecha && b.siguiente_fecha <= hoy ? 0 : 1;
        return va - vb || ESTADOS.findIndex((e) => e.v === b.estado) - ESTADOS.findIndex((e) => e.v === a.estado) || a.nombre.localeCompare(b.nombre);
      });
  }, [lista, filtro, buscar, yo, hoy]);

  const cuenta = (f: EstadoProspecto) => lista.filter((p) => p.estado === f).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="sin-barra -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {(
            [
              ["activos", `Activos · ${lista.filter((p) => !["cerrado", "descartado"].includes(p.estado)).length}`],
              ["mios", `Míos · ${lista.filter((p) => p.responsable === yo).length}`],
              ...ESTADOS.filter((e) => e.v !== "pendiente").map((e) => [e.v, `${e.t} · ${cuenta(e.v)}`]),
              ["todos", `Todos · ${lista.length}`]
            ] as [typeof filtro, string][]
          ).map(([v, t]) => (
            <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)} className={`shrink-0 ${chip(filtro === v)}`}>
              {t}
            </button>
          ))}
        </div>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar nombre o colonia" aria-label="Buscar prospecto" className="campo w-full rounded-full py-2 text-sm md:ml-auto md:w-64" />
      </div>

      <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {visibles.map((p) => (
          <Tarjeta key={p.id} p={p} abierta={abierto === p.id} onAbrir={() => setAbierto(abierto === p.id ? null : p.id)} miembros={miembros} yo={yo} hoy={hoy} firma={firma} onCambio={(patch) => cambiar(p.id, patch)} />
        ))}
      </ul>
      {visibles.length === 0 && <p className="tarjeta text-center text-sm text-muted">Nada con ese filtro.</p>}

      <details className="tarjeta group">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
          Agregar prospecto
          <span className="text-muted transition group-open:rotate-90">›</span>
        </summary>
        <NuevoProspecto equipoId={equipoId} />
      </details>
    </div>
  );
}

function Tarjeta({ p, abierta, onAbrir, miembros, yo, hoy, firma, onCambio }: { p: Prospecto; abierta: boolean; onAbrir: () => void; miembros: Miembro[]; yo: string; hoy: string; firma: string; onCambio: (patch: Partial<Prospecto>) => void }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const e = infoEstado(p.estado);
  const nombre = (id: string | null) => (id === yo ? "Tú" : miembros.find((m) => m.id === id)?.nombre.split(" ")[0] ?? null);
  const vencido = p.siguiente_fecha && p.siguiente_fecha <= hoy && !["cerrado", "descartado"].includes(p.estado);

  const guardar = (patch: Parameters<typeof actualizarProspecto>[1]) => {
    onCambio(patch as Partial<Prospecto>);
    setError(null);
    iniciar(async () => {
      const r = await actualizarProspecto(p.id, patch);
      if (!r.ok) setError(r.error ?? "No se guardó.");
    });
  };

  const wa = p.whatsapp ?? (p.telefono && soloDigitos(p.telefono).length >= 10 ? p.telefono : null);

  return (
    <li className={`vidrio flex flex-col rounded-tarjeta ${p.estado === "descartado" ? "opacity-60" : ""} ${vencido ? "ring-2 ring-rojo/40" : ""}`}>
      <button type="button" onClick={onAbrir} aria-expanded={abierta} className="flex items-start justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rojo">
        <span className="min-w-0">
          <span className="titulo block text-xl leading-tight">{p.nombre}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">{[p.zona, p.giro].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${e.clase}`}>{e.t}</span>
          {p.responsable && <span className="text-[11px] text-muted">{nombre(p.responsable)}</span>}
        </span>
      </button>

      {(p.siguiente_paso || p.siguiente_fecha) && (
        <p className={`-mt-2 px-4 pb-2 text-xs ${vencido ? "font-semibold text-acento" : "text-muted"}`}>
          → {p.siguiente_paso ?? "Seguimiento"}
          {p.siguiente_fecha ? ` · ${p.siguiente_fecha.split("-").reverse().slice(0, 2).join("/")}` : ""}
        </p>
      )}

      {/* Contacto en un toque */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {p.instagram && (
          <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs font-semibold hover:bg-tinta/10">
            @{p.instagram}
          </a>
        )}
        {wa && (
          <a href={`https://wa.me/${soloDigitos(wa)}?text=${encodeURIComponent(mensajeDM(p, firma))}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-ok/15 px-3 py-1.5 text-xs font-semibold hover:bg-ok/25">
            WhatsApp
          </a>
        )}
        {p.email && (
          <a href={`mailto:${p.email}?subject=${encodeURIComponent(`Spot para ${p.nombre}`)}&body=${encodeURIComponent(mensajeDM(p, firma))}`} className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs font-semibold hover:bg-tinta/10">
            Correo
          </a>
        )}
        {p.direccion && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(`${p.direccion}, CDMX`)}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs font-semibold hover:bg-tinta/10">
            Mapa
          </a>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(mensajeDM(p, firma));
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1800);
            } catch {
              /* sin permiso de portapapeles */
            }
          }}
          className="rounded-full bg-rojo/10 px-3 py-1.5 text-xs font-semibold text-acento hover:bg-rojo/15"
        >
          {copiado ? "¡Copiado!" : "Copiar DM"}
        </button>
      </div>

      {abierta && (
        <div className="space-y-4 border-t border-borde/60 p-4">
          <fieldset>
            <legend className="etiqueta">Estado</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ESTADOS.map((x) => (
                <button key={x.v} type="button" aria-pressed={p.estado === x.v} onClick={() => guardar({ estado: x.v })} className={chip(p.estado === x.v)}>
                  {x.t}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="etiqueta">Quién lo lleva</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={!p.responsable} onClick={() => guardar({ responsable: null })} className={chip(!p.responsable)}>
                Nadie
              </button>
              {miembros.map((m) => (
                <button key={m.id} type="button" aria-pressed={p.responsable === m.id} onClick={() => guardar({ responsable: m.id })} className={chip(p.responsable === m.id)}>
                  {m.id === yo ? "Yo" : m.nombre.split(" ")[0]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              defaultValue={p.siguiente_paso ?? ""}
              maxLength={200}
              placeholder="Siguiente paso: mandar DM, ir a comer…"
              aria-label="Siguiente paso"
              onBlur={(ev) => ev.target.value !== (p.siguiente_paso ?? "") && guardar({ siguiente_paso: ev.target.value })}
              className="campo rounded-full py-2 text-sm"
            />
            <input
              type="date"
              defaultValue={p.siguiente_fecha ?? ""}
              aria-label="Fecha del siguiente paso"
              onChange={(ev) => guardar({ siguiente_fecha: ev.target.value || null })}
              className="campo w-[9.5rem] rounded-full py-2 font-mono text-sm"
            />
          </div>
          <textarea
            defaultValue={p.notas ?? ""}
            maxLength={2000}
            rows={2}
            placeholder="Notas: con quién hablaron, qué dijo, precio…"
            aria-label="Notas"
            onBlur={(ev) => ev.target.value !== (p.notas ?? "") && guardar({ notas: ev.target.value })}
            className="campo rounded-2xl py-2 text-sm"
          />
          {p.angulo && (
            <div className="rounded-2xl border-l-4 border-rojo bg-tinta/[0.04] p-3">
              <p className="etiqueta">El pitch</p>
              <p className="mt-1 text-sm">{p.angulo}</p>
            </div>
          )}
          {p.senal && (
            <div>
              <p className="etiqueta">Por qué ahora</p>
              <p className="mt-1 text-sm text-muted">{p.senal}</p>
            </div>
          )}
          {p.video && (
            <div>
              <p className="etiqueta">Su video hoy</p>
              <p className="mt-1 text-sm text-muted">{p.video}</p>
            </div>
          )}
          {p.contacto && <p className="text-xs text-muted">{p.contacto}</p>}
          {p.fuentes?.length > 0 && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {p.fuentes.map((f) => (
                <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="text-muted underline decoration-tinta/20 underline-offset-2 hover:text-tinta">
                  {f.t}
                </a>
              ))}
            </p>
          )}
          {pendiente && <p className="text-xs text-muted">Guardando…</p>}
          {error && <p className="alerta-error" role="alert">{error}</p>}
        </div>
      )}
    </li>
  );
}

function NuevoProspecto({ equipoId }: { equipoId: string }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearProspecto, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={enviar} className="mt-4 grid gap-2 md:grid-cols-2">
      <input type="hidden" name="equipo_id" value={equipoId} />
      <input name="nombre" required maxLength={80} placeholder="Nombre del negocio" aria-label="Nombre del negocio" className="campo rounded-full py-2.5 text-sm" />
      <input name="instagram" maxLength={60} placeholder="Instagram, ej. bribona_mx" aria-label="Instagram" className="campo rounded-full py-2.5 text-sm" />
      <input name="zona" maxLength={120} placeholder="Colonia" aria-label="Colonia" className="campo rounded-full py-2.5 text-sm" />
      <input name="giro" maxLength={160} placeholder="Qué es: bar, café, hotel…" aria-label="Giro" className="campo rounded-full py-2.5 text-sm" />
      <textarea name="angulo" maxLength={2000} rows={2} placeholder="El pitch: por qué necesitan un spot" aria-label="Pitch" className="campo rounded-2xl py-2.5 text-sm md:col-span-2" />
      {estado?.error && <p className="alerta-error md:col-span-2" role="alert">{estado.error}</p>}
      {estado?.ok && estado.mensaje && <p className="alerta-ok md:col-span-2" role="status">{estado.mensaje}</p>}
      <button type="submit" disabled={enviando} className="btn-primario md:col-span-2">
        {enviando ? "Guardando…" : "Agregar al Radar"}
      </button>
    </form>
  );
}
