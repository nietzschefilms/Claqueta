"use client";

import { useMemo, useState, useTransition } from "react";
import { cambiarEstadoItem, guardarAjustesInversion, guardarItem, marcarComprado, type CamposItem } from "./acciones";
import { pesos } from "@/lib/claqueta/dinero";
import { CATEGORIAS_INVERSION, PRIORIDADES, consejosCompra, costoItem, nombreCategoriaInversion, ordenCompra, type Fondo, type ItemInversion, type Semaforo } from "@/lib/claqueta/inversion";

export type Item = ItemInversion & { link: string | null; tienda: string | null; nota: string | null; comprado_en: string | null };
type Cuenta = { id: string; nombre: string; tipo: string };
type Ajustes = { ya_gastado: string; reserva_pct: string; iva_aparte: boolean };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const RETORNO = ["", "Bajo", "Medio", "Alto"];

const chip = (on: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
    on ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"
  }`;

const COLOR = {
  verde: { barra: "bg-ok", fondo: "bg-ok/10 border-ok/40", texto: "text-ok", t: "Cómpralo ya" },
  amarillo: { barra: "bg-aviso", fondo: "bg-aviso/10 border-aviso/40", texto: "text-aviso", t: "Con lo que falta de EK" },
  gris: { barra: "bg-tinta/20", fondo: "bg-tinta/[0.03] border-borde", texto: "text-muted", t: "Después del contrato" }
} as const;

export function Inversion({ items, semaforo, fondo, ajustes, cuentas, resico, hoy, contrato }: { items: Item[]; semaforo: Record<string, Semaforo>; fondo: Fondo; ajustes: Ajustes; cuentas: Cuenta[]; resico: boolean; hoy: string; contrato: string | null }) {
  const [cat, setCat] = useState("todas");
  const [prio, setPrio] = useState(0);
  const [color, setColor] = useState<"todos" | "verde" | "amarillo" | "gris">("todos");
  const [q, setQ] = useState("");
  const [rentables, setRentables] = useState(false);
  const [verOtros, setVerOtros] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const quiero = items.filter((i) => i.estado === "quiero");
  const totalLista = quiero.reduce((a, i) => a + costoItem(i), 0);
  const totalVerde = quiero.filter((i) => semaforo[i.id]?.color === "verde").reduce((a, i) => a + costoItem(i), 0);
  const nVerde = quiero.filter((i) => semaforo[i.id]?.color === "verde").length;
  const alcanzaContrato = fondo.disponible + fondo.porLlegarNeto;

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const base = verOtros ? items : quiero;
    return ordenCompra(base).filter((i) => {
      if (cat !== "todas" && i.categoria !== cat) return false;
      if (prio && i.prioridad !== prio) return false;
      if (rentables && !i.rentable) return false;
      if (color !== "todos" && semaforo[i.id]?.color !== color) return false;
      if (texto && !`${i.nombre} ${i.tienda ?? ""} ${i.nota ?? ""}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [items, quiero, verOtros, cat, prio, rentables, color, q, semaforo]);

  return (
    <div className="space-y-6">
      {/* ── Fondo ── */}
      <section className="vidrio aparecer relative overflow-hidden rounded-tarjeta p-5 md:p-7">
        <span className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ok/20 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-end">
          <div>
            <p className="etiqueta">Listo para invertir hoy</p>
            <p className="cifra mt-1 text-[clamp(2.6rem,11vw,4.5rem)] font-semibold leading-none tracking-tight text-ok">{pesos(fondo.disponible)}</p>
            <p className="mt-2 text-sm text-muted">
              Y por llegar de {contrato ?? "tu contrato"}: <span className="cifra font-semibold text-tinta">{pesos(fondo.porLlegarNeto)}</span> limpios
              {fondo.netoMensual > 0 && <> (≈ {pesos(fondo.netoMensual)} al mes)</>}.
            </p>
          </div>
          <dl className="cifra grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Dato t="Cobrado" v={pesos(fondo.cobrado)} />
            <Dato t="Impuestos" v={`−${pesos(fondo.impuestos)}`} />
            <Dato t="Reserva" v={`−${pesos(fondo.reserva)}`} />
            <Dato t="Ya invertido" v={`−${pesos(fondo.invertido)}`} />
          </dl>
        </div>
        <div className="relative mt-5 grid gap-3 border-t border-borde/60 pt-4 md:grid-cols-3">
          <p className="text-sm">
            Tu lista: <span className="cifra font-semibold">{pesos(totalLista)}</span>
            <span className="block text-xs text-muted">
              {nVerde} de {quiero.length} ya alcanzan ({pesos(totalVerde)}).
            </span>
          </p>
          <p className="text-sm">
            Todo el contrato rinde: <span className="cifra font-semibold">{pesos(alcanzaContrato)}</span>
            <span className={`block text-xs ${totalLista > alcanzaContrato ? "font-semibold text-acento" : "text-muted"}`}>
              {totalLista > alcanzaContrato ? `Te pasas por ${pesos(totalLista - alcanzaContrato)}: lo gris queda para después.` : `Te sobran ${pesos(alcanzaContrato - totalLista)}.`}
            </span>
          </p>
          <AjustesFondo ajustes={ajustes} />
        </div>
      </section>

      {/* ── Filtros ── */}
      <section className="space-y-2">
        <div className="sin-barra -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <button type="button" aria-pressed={cat === "todas"} onClick={() => setCat("todas")} className={chip(cat === "todas")}>Todo</button>
          {CATEGORIAS_INVERSION.filter((c) => items.some((i) => i.categoria === c.v)).map((c) => (
            <button key={c.v} type="button" aria-pressed={cat === c.v} onClick={() => setCat(c.v)} className={chip(cat === c.v)}>
              {c.t} · {quiero.filter((i) => i.categoria === c.v).length}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["todos", "verde", "amarillo", "gris"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={color === v} onClick={() => setColor(v)} className={chip(color === v)}>
              {v === "todos" ? "Todos" : v === "verde" ? "● Ya" : v === "amarillo" ? "● Pronto" : "● Después"}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-borde" aria-hidden="true" />
          {[0, 1, 2, 3, 4].map((p) => (
            <button key={p} type="button" aria-pressed={prio === p} onClick={() => setPrio(p)} className={chip(prio === p)}>
              {p === 0 ? "Toda prioridad" : PRIORIDADES[p - 1].t}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={rentables} onChange={(e) => setRentables(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-rojo))]" /> Se puede rentar
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={verOtros} onChange={(e) => setVerOtros(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-rojo))]" /> Ver comprados y descartados
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar artículo" className="campo w-full rounded-full py-2 text-sm md:ml-auto md:w-56" />
        </div>
      </section>

      {/* ── Lista ── */}
      <ol className="space-y-2">
        {visibles.map((i) => (
          <Fila key={i.id} i={i} s={semaforo[i.id]} abierto={abierto === i.id} onAbrir={() => setAbierto(abierto === i.id ? null : i.id)} cuentas={cuentas} resico={resico} hoy={hoy} />
        ))}
        {visibles.length === 0 && <li className="tarjeta text-center text-sm text-muted">Nada con esos filtros.</li>}
      </ol>

      <NuevoItem />
    </div>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="rounded-2xl bg-tinta/[0.05] p-3">
      <dt className="etiqueta">{t}</dt>
      <dd className="mt-1 font-semibold">{v}</dd>
    </div>
  );
}

function AjustesFondo({ ajustes }: { ajustes: Ajustes }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const guardar = (c: Parameters<typeof guardarAjustesInversion>[0]) =>
    iniciar(async () => {
      const r = await guardarAjustesInversion(c);
      setError(r.ok ? null : r.error ?? "No se guardó.");
    });
  return (
    <div className="text-sm">
      <button type="button" onClick={() => setAbierto(!abierto)} className="enlace-mono">
        Ajustar el fondo {abierto ? "▴" : "▾"}
      </button>
      {abierto && (
        <div className="mt-2 space-y-2">
          <label className="flex items-center justify-between gap-2 text-xs">
            Ya gastado del contrato
            <input defaultValue={Number(ajustes.ya_gastado)} inputMode="decimal" onBlur={(e) => guardar({ ya_gastado: e.target.value })} className="campo cifra w-28 rounded-full py-1.5 text-right text-xs" />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs">
            Reserva para imprevistos (%)
            <input defaultValue={Number(ajustes.reserva_pct)} inputMode="decimal" onBlur={(e) => guardar({ reserva_pct: e.target.value })} className="campo cifra w-20 rounded-full py-1.5 text-right text-xs" />
          </label>
          <label className="flex items-center justify-between gap-2 text-xs">
            EK me paga el IVA aparte
            <input type="checkbox" defaultChecked={ajustes.iva_aparte} onChange={(e) => guardar({ iva_aparte: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--c-rojo))]" />
          </label>
          {error && <p className="text-xs font-semibold text-acento">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Fila({ i, s, abierto, onAbrir, cuentas, resico, hoy }: { i: Item; s?: Semaforo; abierto: boolean; onAbrir: () => void; cuentas: Cuenta[]; resico: boolean; hoy: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [comprando, setComprando] = useState(false);
  const col = i.estado === "quiero" && s ? COLOR[s.color] : null;
  const costo = costoItem(i);
  const consejos = i.estado === "quiero" ? consejosCompra(i, { resico, semaforo: s }) : [];
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      const r = await f();
      setError(r.ok ? null : r.error ?? "No se guardó.");
    });
  const guardar = (c: CamposItem) => correr(() => guardarItem(i.id, c));

  return (
    <li className={`relative overflow-hidden rounded-tarjeta border ${col ? col.fondo : "border-borde bg-tinta/[0.02] opacity-70"}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${col ? col.barra : "bg-tinta/10"}`} aria-hidden="true" />
      <button type="button" onClick={onAbrir} aria-expanded={abierto} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3 pl-5 pr-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rojo">
        <span className="min-w-0">
          <span className="block font-semibold leading-snug">
            {i.nombre}
            {i.cantidad > 1 && <span className="cifra font-normal text-muted"> ×{i.cantidad}</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
            <span>{nombreCategoriaInversion(i.categoria)}</span>
            <span>· {PRIORIDADES[i.prioridad - 1]?.t}</span>
            <span>· retorno {RETORNO[i.retorno].toLowerCase()}</span>
            {i.rentable && <span>· se renta</span>}
            {i.tienda && <span>· {i.tienda}</span>}
          </span>
        </span>
        <span className="text-right">
          <span className="cifra block font-semibold">{pesos(i.estado === "comprado" && i.precio_real ? Math.round(Number(i.precio_real) * 100) : costo)}</span>
          <span className={`block text-[11px] font-semibold ${col ? col.texto : "text-muted"}`}>
            {i.estado === "comprado" ? `Comprado ${i.comprado_en ? mesCorto(i.comprado_en) : ""}` : i.estado === "descartado" ? "Descartado" : s?.color === "amarillo" && s.fecha ? `≈ ${mesCorto(s.fecha)}` : col?.t}
          </span>
        </span>
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-borde/60 py-4 pl-5 pr-4">
          {i.link && (
            <a href={i.link} target="_blank" rel="noopener noreferrer" className="btn-secundario inline-flex">
              Ver producto ↗
            </a>
          )}
          {i.nota && <p className="text-sm text-muted">{i.nota}</p>}
          {consejos.length > 0 && (
            <ul className="space-y-1 rounded-2xl bg-tinta/[0.04] p-3 text-sm">
              <li className="etiqueta">Tu contador dice</li>
              {consejos.map((c) => (
                <li key={c} className="flex gap-2">
                  <span aria-hidden="true">·</span>
                  {c}
                </li>
              ))}
            </ul>
          )}

          {i.estado === "quiero" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs">
                <span className="etiqueta">Precio</span>
                <input defaultValue={Number(i.precio)} inputMode="decimal" onBlur={(e) => e.target.value !== String(Number(i.precio)) && guardar({ precio: e.target.value })} className="campo cifra mt-1 rounded-full py-1.5 text-sm" />
              </label>
              <label className="text-xs">
                <span className="etiqueta">Prioridad</span>
                <select defaultValue={i.prioridad} onChange={(e) => guardar({ prioridad: Number(e.target.value) })} className="campo mt-1 rounded-full py-1.5 text-sm">
                  {PRIORIDADES.map((p) => (
                    <option key={p.v} value={p.v}>{p.t}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="etiqueta">Retorno</span>
                <select defaultValue={i.retorno} onChange={(e) => guardar({ retorno: Number(e.target.value) })} className="campo mt-1 rounded-full py-1.5 text-sm">
                  <option value={3}>Alto: me hace cobrar más</option>
                  <option value={2}>Medio</option>
                  <option value={1}>Bajo</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="etiqueta">Cantidad</span>
                <input type="number" min={1} max={99} defaultValue={i.cantidad} onBlur={(e) => Number(e.target.value) !== i.cantidad && guardar({ cantidad: Number(e.target.value) })} className="campo cifra mt-1 rounded-full py-1.5 text-sm" />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="etiqueta">Link</span>
                <input defaultValue={i.link ?? ""} placeholder="https://" onBlur={(e) => e.target.value !== (i.link ?? "") && guardar({ link: e.target.value })} className="campo mt-1 rounded-full py-1.5 text-sm" />
              </label>
              <label className="text-xs">
                <span className="etiqueta">Tienda</span>
                <input defaultValue={i.tienda ?? ""} maxLength={60} onBlur={(e) => e.target.value !== (i.tienda ?? "") && guardar({ tienda: e.target.value })} className="campo mt-1 rounded-full py-1.5 text-sm" />
              </label>
              <label className="flex items-end gap-2 pb-2 text-xs">
                <input type="checkbox" defaultChecked={i.rentable} onChange={(e) => guardar({ rentable: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--c-rojo))]" /> Se puede rentar
              </label>
            </div>
          )}

          {i.estado === "quiero" && !comprando && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setComprando(true)} className="btn-rojo">Ya lo compré</button>
              <button type="button" disabled={pendiente} onClick={() => correr(() => cambiarEstadoItem(i.id, "descartado"))} className="btn-secundario">Descartar</button>
            </div>
          )}
          {i.estado === "descartado" && (
            <button type="button" disabled={pendiente} onClick={() => correr(() => cambiarEstadoItem(i.id, "quiero"))} className="btn-secundario">Volver a la lista</button>
          )}
          {comprando && <Comprar i={i} cuentas={cuentas} hoy={hoy} onCancelar={() => setComprando(false)} />}
          {error && <p className="alerta-error">{error}</p>}
        </div>
      )}
    </li>
  );
}

function Comprar({ i, cuentas, hoy, onCancelar }: { i: Item; cuentas: Cuenta[]; hoy: string; onCancelar: () => void }) {
  const [precio, setPrecio] = useState(String(costoItem(i) / 100));
  const [fecha, setFecha] = useState(hoy);
  const [cuenta, setCuenta] = useState(cuentas[0]?.id ?? "");
  const [estado, setEstado] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="space-y-2 rounded-2xl border border-rojo/30 p-3">
      <p className="text-sm font-semibold">¿Cuánto pagaste y con qué? Se anota como gasto en Dinero.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" aria-label="Total pagado" className="campo cifra rounded-full py-2 text-sm" />
        <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha de compra" className="campo rounded-full py-2 font-mono text-sm" />
        <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Con qué pagaste" className="campo rounded-full py-2 text-sm">
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}{c.tipo === "credito" ? " (crédito)" : ""}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await marcarComprado(i.id, { precio, fecha, cuenta });
              setEstado({ ok: r.ok, t: r.ok ? r.mensaje ?? "Listo." : r.error ?? "No se guardó." });
            })
          }
          className="btn-rojo"
        >
          {pendiente ? "Guardando…" : "Confirmar compra"}
        </button>
        <button type="button" onClick={onCancelar} className="btn-secundario">Cancelar</button>
      </div>
      {estado && <p className={estado.ok ? "alerta-ok" : "alerta-error"}>{estado.t}</p>}
    </div>
  );
}

function NuevoItem() {
  const [c, setC] = useState<CamposItem>({ nombre: "", categoria: "accesorios", precio: "", prioridad: 2, retorno: 2, cantidad: 1, rentable: false, link: "", tienda: "" });
  const [estado, setEstado] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (x: Partial<CamposItem>) => setC((v) => ({ ...v, ...x }));
  return (
    <details className="tarjeta group">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
        Agregar artículo
        <span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => {
            const r = await guardarItem(null, c);
            setEstado({ ok: r.ok, t: r.ok ? r.mensaje ?? "Agregado." : r.error ?? "No se guardó." });
            if (r.ok) set({ nombre: "", precio: "", link: "", tienda: "" });
          });
        }}
        className="mt-4 grid gap-2 md:grid-cols-4"
      >
        <input value={c.nombre} onChange={(e) => set({ nombre: e.target.value })} required maxLength={120} placeholder="Qué es, ej. Aputure Amaran 200x S" aria-label="Nombre" className="campo rounded-full py-2 text-sm md:col-span-2" />
        <select value={c.categoria} onChange={(e) => set({ categoria: e.target.value })} aria-label="Categoría" className="campo rounded-full py-2 text-sm">
          {CATEGORIAS_INVERSION.map((x) => (
            <option key={x.v} value={x.v}>{x.t}</option>
          ))}
        </select>
        <input value={c.precio} onChange={(e) => set({ precio: e.target.value })} required inputMode="decimal" placeholder="Precio" aria-label="Precio" className="campo cifra rounded-full py-2 text-sm" />
        <select value={c.prioridad} onChange={(e) => set({ prioridad: Number(e.target.value) })} aria-label="Prioridad" className="campo rounded-full py-2 text-sm">
          {PRIORIDADES.map((p) => (
            <option key={p.v} value={p.v}>{p.t}: {p.d}</option>
          ))}
        </select>
        <select value={c.retorno} onChange={(e) => set({ retorno: Number(e.target.value) })} aria-label="Retorno" className="campo rounded-full py-2 text-sm">
          <option value={3}>Retorno alto</option>
          <option value={2}>Retorno medio</option>
          <option value={1}>Retorno bajo</option>
        </select>
        <input value={c.link} onChange={(e) => set({ link: e.target.value })} placeholder="Link (https://…)" aria-label="Link" className="campo rounded-full py-2 text-sm" />
        <input value={c.tienda} onChange={(e) => set({ tienda: e.target.value })} maxLength={60} placeholder="Tienda" aria-label="Tienda" className="campo rounded-full py-2 text-sm" />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={!!c.rentable} onChange={(e) => set({ rentable: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--c-rojo))]" /> Se puede rentar
        </label>
        <button type="submit" disabled={pendiente} className="btn-primario md:col-span-3">{pendiente ? "Guardando…" : "Agregar a la lista"}</button>
        {estado && <p className={`${estado.ok ? "alerta-ok" : "alerta-error"} md:col-span-4`}>{estado.t}</p>}
      </form>
    </details>
  );
}
