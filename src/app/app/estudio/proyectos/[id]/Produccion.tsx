"use client";

import { useMemo, useState, useTransition } from "react";
import { agendarRodaje, agregarDesglose, asignarDia, editarProyecto, planearRodaje, quitarDesglose } from "../../acciones";
import { escenasDe, esNoche, paginas, type Escena, type Linea } from "@/lib/claqueta/estudio";
import type { Desglose, RodajeEscena } from "@/lib/claqueta/datos-estudio";

export const CATEGORIAS: { v: string; t: string }[] = [
  { v: "reparto", t: "Reparto" },
  { v: "extras", t: "Extras" },
  { v: "utileria", t: "Utilería" },
  { v: "vestuario", t: "Vestuario" },
  { v: "maquillaje", t: "Maquillaje" },
  { v: "arte", t: "Arte" },
  { v: "vehiculos", t: "Vehículos" },
  { v: "efectos", t: "Efectos" },
  { v: "sonido", t: "Sonido" },
  { v: "camara", t: "Cámara" },
  { v: "locacion", t: "Locación" },
  { v: "otro", t: "Otro" }
];
export const nombreCategoria = (v: string) => CATEGORIAS.find((c) => c.v === v)?.t ?? v;

// Colores clásicos del stripboard.
export function colorTira(e: Escena) {
  const noche = esNoche(e.slug.momento);
  const ext = e.slug.intExt === "EXT";
  if (ext && noche) return "bg-ok/20 border-ok/40";
  if (noche) return "bg-f-nietzsche/20 border-f-nietzsche/40";
  if (ext) return "bg-aviso/20 border-aviso/40";
  return "bg-superficie border-borde";
}

const ESTADOS = [
  { v: "idea", t: "Idea" },
  { v: "preproduccion", t: "Preproducción" },
  { v: "rodaje", t: "Rodaje" },
  { v: "post", t: "Post" },
  { v: "entregado", t: "Entregado" }
];

export function EstadoProyecto({ id, estado }: { id: string; estado: string }) {
  const [valor, setValor] = useState(estado);
  const [, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap gap-1">
      {ESTADOS.map((e) => (
        <button
          key={e.v}
          type="button"
          aria-pressed={valor === e.v}
          onClick={() => {
            setValor(e.v);
            iniciar(async () => void (await editarProyecto(id, { estado: e.v })));
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${valor === e.v ? "bg-rojo text-white" : "bg-tinta/[0.06] text-muted hover:text-tinta"}`}
        >
          {e.t}
        </button>
      ))}
    </div>
  );
}

export function Logline({ id, valor }: { id: string; valor: string | null }) {
  const [, iniciar] = useTransition();
  return (
    <textarea
      defaultValue={valor ?? ""}
      maxLength={400}
      rows={2}
      placeholder="Logline: la historia en una frase."
      aria-label="Logline"
      onBlur={(e) => e.target.value !== (valor ?? "") && iniciar(async () => void (await editarProyecto(id, { logline: e.target.value })))}
      className="campo mt-3 w-full max-w-2xl rounded-2xl py-2 text-sm"
    />
  );
}

// ─── Desglose ────────────────────────────────────────────────────────────
export function DesgloseEscenas({ proyectoId, lineas, desglose }: { proyectoId: string; lineas: Linea[]; desglose: Desglose[] }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const agregar = (escena: string | null, categoria: string, elemento: string) =>
    iniciar(async () => {
      const r = await agregarDesglose(proyectoId, escena, categoria, elemento);
      setError(r.ok ? null : r.error ?? "No se guardó.");
    });

  if (!escenas.length) return <p className="tarjeta text-sm text-muted">Escribe al menos una escena en el guion (INT. o EXT.) para desglosarla.</p>;

  // Todo el proyecto agrupado por categoría (para la lista de compras de arte y producción).
  const porCategoria = CATEGORIAS.map((c) => ({ ...c, items: [...new Set(desglose.filter((d) => d.categoria === c.v).map((d) => d.elemento))] })).filter((c) => c.items.length);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        {error && <p className="alerta-error">{error}</p>}
        {escenas.map((e) => {
          const items = desglose.filter((d) => d.escena_id === e.id);
          const ya = new Set(items.map((d) => d.elemento.toUpperCase()));
          const sugeridos = e.mayusculas.filter((m) => !ya.has(m) && !e.personajes.includes(m));
          return (
            <section key={e.id} className={`rounded-tarjeta border p-4 ${colorTira(e)}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-mono text-sm font-bold uppercase">
                  {e.numero}. {e.texto}
                </h3>
                <span className="cifra text-xs text-muted">{paginas(e.octavos)} pág.</span>
              </div>
              {e.personajes.length > 0 && (
                <p className="mt-2 text-xs">
                  <span className="etiqueta mr-2">Reparto</span>
                  {e.personajes.join(" · ")}
                </p>
              )}
              {items.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {items.map((d) => (
                    <li key={d.id} className="flex items-center gap-1 rounded-full bg-fondo/70 px-2.5 py-1 text-xs">
                      <span className="text-muted">{nombreCategoria(d.categoria)}:</span> {d.elemento}
                      <button type="button" aria-label={`Quitar ${d.elemento}`} onClick={() => iniciar(async () => void (await quitarDesglose(proyectoId, d.id)))} className="ml-0.5 text-muted hover:text-tinta">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {sugeridos.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="etiqueta">Detectado en mayúsculas</span>
                  {sugeridos.map((m) => (
                    <button key={m} type="button" disabled={pendiente} onClick={() => agregar(e.id, "utileria", m)} className="rounded-full border border-dashed border-tinta/30 px-2.5 py-1 hover:border-tinta/60">
                      + {m}
                    </button>
                  ))}
                </p>
              )}
              <AgregarElemento onAgregar={(c, t) => agregar(e.id, c, t)} />
            </section>
          );
        })}
      </div>
      <aside className="tarjeta self-start xl:sticky xl:top-6">
        <h3 className="titulo text-xl">Lista del proyecto</h3>
        {porCategoria.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Agrega elementos por escena y aquí se junta todo: lo que hay que conseguir, rentar o preparar.</p>
        ) : (
          <dl className="mt-3 space-y-3 text-sm">
            {porCategoria.map((c) => (
              <div key={c.v}>
                <dt className="etiqueta">{c.t}</dt>
                <dd>{c.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>
    </div>
  );
}

function AgregarElemento({ onAgregar }: { onAgregar: (categoria: string, texto: string) => void }) {
  const [cat, setCat] = useState("utileria");
  const [texto, setTexto] = useState("");
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!texto.trim()) return;
        onAgregar(cat, texto);
        setTexto("");
      }}
      className="mt-3 flex gap-2"
    >
      <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría" className="campo w-auto rounded-full py-1.5 text-xs">
        {CATEGORIAS.map((c) => (
          <option key={c.v} value={c.v}>
            {c.t}
          </option>
        ))}
      </select>
      <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={120} placeholder="Agregar elemento" aria-label="Elemento" className="campo min-w-0 flex-1 rounded-full py-1.5 text-xs" />
      <button type="submit" className="rounded-full bg-tinta px-3 text-xs font-semibold text-fondo">+</button>
    </form>
  );
}

// ─── Plan de rodaje (stripboard) ─────────────────────────────────────────
export function PlanRodaje({ proyectoId, lineas, rodaje, hoy }: { proyectoId: string; lineas: Linea[]; rodaje: RodajeEscena[]; hoy: string }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const [inicio, setInicio] = useState(hoy);
  const [porDia, setPorDia] = useState(4);
  const [llamado, setLlamado] = useState("08:00");
  const [horas, setHoras] = useState(10);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const dia = new Map(rodaje.map((r) => [r.escena_id, r.dia]));

  if (!escenas.length) return <p className="tarjeta text-sm text-muted">El plan sale del guion: escribe escenas (INT. / EXT.) y aquí se arma el stripboard.</p>;

  const grupos = new Map<string, Escena[]>();
  for (const e of escenas) {
    const k = dia.get(e.id) ?? "";
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  const dias = [...grupos.keys()].filter(Boolean).sort();
  const sinDia = grupos.get("") ?? [];
  const correr = (f: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>) =>
    iniciar(async () => {
      const r = await f();
      setMsg({ ok: r.ok, t: r.ok ? r.mensaje ?? "Listo." : r.error ?? "No se pudo." });
    });

  return (
    <div className="space-y-5">
      <section className="tarjeta grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="titulo text-xl">Armar plan automático</h3>
          <p className="mt-1 text-sm text-muted">Junta escenas de la misma locación y luz (día/noche) y llena jornadas.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="etiqueta block">Primer día</span>
              <input type="date" value={inicio} min={hoy} onChange={(e) => setInicio(e.target.value)} className="campo mt-1 rounded-full py-2 font-mono text-sm" />
            </label>
            <label className="text-xs">
              <span className="etiqueta block">Páginas por día</span>
              <input type="number" min={0.5} max={20} step={0.5} value={porDia} onChange={(e) => setPorDia(Number(e.target.value))} className="campo mt-1 w-24 rounded-full py-2 font-mono text-sm" />
            </label>
            <button type="button" disabled={pendiente} onClick={() => correr(() => planearRodaje(proyectoId, inicio, porDia))} className="btn-primario">
              Armar plan
            </button>
          </div>
        </div>
        <div>
          <h3 className="titulo text-xl">Mandar a la agenda</h3>
          <p className="mt-1 text-sm text-muted">Cada día de rodaje sale en Hoy y Semana de los dos, con aviso.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="etiqueta block">Llamado</span>
              <input type="time" value={llamado} onChange={(e) => setLlamado(e.target.value)} className="campo mt-1 rounded-full py-2 font-mono text-sm" />
            </label>
            <label className="text-xs">
              <span className="etiqueta block">Horas</span>
              <input type="number" min={1} max={16} value={horas} onChange={(e) => setHoras(Number(e.target.value))} className="campo mt-1 w-20 rounded-full py-2 font-mono text-sm" />
            </label>
            <button type="button" disabled={pendiente || !dias.length} onClick={() => correr(() => agendarRodaje(proyectoId, llamado, horas))} className="btn-rojo">
              Agendar rodaje
            </button>
          </div>
        </div>
        {msg && <p className={`${msg.ok ? "alerta-ok" : "alerta-error"} md:col-span-2`}>{msg.t}</p>}
      </section>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-borde bg-superficie" /> INT día</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-aviso/40 bg-aviso/20" /> EXT día</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-f-nietzsche/40 bg-f-nietzsche/20" /> INT noche</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-ok/40 bg-ok/20" /> EXT noche</span>
      </div>

      {[...dias, ...(sinDia.length ? [""] : [])].map((d, n) => {
        const es = grupos.get(d) ?? [];
        const oct = es.reduce((a, e) => a + e.octavos, 0);
        return (
          <section key={d || "sin"} className="space-y-1.5">
            <h3 className="flex items-baseline justify-between gap-2">
              <span className="titulo text-xl">{d ? `Día ${n + 1} · ${new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}` : "Sin día"}</span>
              <span className="cifra text-xs text-muted">{paginas(oct)} pág. · {es.length} esc.</span>
            </h3>
            {es.map((e) => (
              <div key={e.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${colorTira(e)}`}>
                <span className="cifra w-6 text-sm font-semibold">{e.numero}</span>
                <span className="min-w-0 flex-1 font-mono text-xs font-bold uppercase">{e.slug.intExt ?? ""} {e.slug.lugar}</span>
                <span className="cifra text-[11px] text-muted">{e.slug.momento ?? ""}</span>
                <span className="cifra w-10 text-right text-[11px]">{paginas(e.octavos)}</span>
                <span className="hidden max-w-[12rem] truncate text-[11px] text-muted md:block">{e.personajes.join(", ")}</span>
                <input
                  type="date"
                  defaultValue={d}
                  aria-label={`Día de la escena ${e.numero}`}
                  onChange={(ev) => iniciar(async () => void (await asignarDia(proyectoId, e.id, ev.target.value || null)))}
                  className="campo w-[9.5rem] rounded-full py-1 font-mono text-xs"
                />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function BotonImprimir({ texto = "Imprimir / PDF" }: { texto?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secundario print:hidden">
      {texto}
    </button>
  );
}
