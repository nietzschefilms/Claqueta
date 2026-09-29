"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { agregarLineaPresupuesto, archivarLineaPresupuesto, cargarPlantillaPresupuesto, editarLineaPresupuesto, editarTopsheet } from "../../acciones";
import { CUENTAS, GRUPOS, grupoDe, nombreCuenta, topsheet, totalLinea } from "@/lib/claqueta/produccion";
import { pesos } from "@/lib/claqueta/dinero";
import type { LineaPres } from "@/lib/claqueta/datos-estudio";

const UNIDADES = ["día", "semana", "hora", "pieza", "fijo", "km", "persona"];
type Ajustes = { imprevistos_pct: string; utilidad_pct: string; con_iva: boolean; precio_cliente: string | null };

// Presupuesto tipo Movie Magic: cuentas, topsheet y margen contra lo que paga el cliente.
export function Presupuesto({ proyectoId, nombre, cliente, inicial, ajustesIniciales }: { proyectoId: string; nombre: string; cliente: string | null; inicial: LineaPres[]; ajustesIniciales: Ajustes }) {
  const [lineas, setLineas] = useState(inicial);
  const [aj, setAj] = useState(ajustesIniciales);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [cotizacion, setCotizacion] = useState(false);
  useEffect(() => setLineas(inicial), [inicial]);

  const t = useMemo(() => topsheet(lineas, aj), [lineas, aj]);
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      const r = await f();
      setError(r.ok ? null : r.error ?? "No se guardó.");
    });

  const editar = (id: string, campo: keyof LineaPres, valor: string) => {
    const antes = lineas.find((l) => l.id === id);
    if (!antes || String(antes[campo] ?? "") === valor) return;
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
    correr(() => editarLineaPresupuesto(proyectoId, id, { [campo]: campo === "real" && valor === "" ? null : valor }));
  };
  const ajustar = (c: Partial<Ajustes>) => {
    setAj((a) => ({ ...a, ...c }));
    correr(() => editarTopsheet(proyectoId, c as Parameters<typeof editarTopsheet>[1]));
  };

  const cuentasUsadas = [...new Set(lineas.map((l) => l.cuenta))].sort();
  const colorMargen = t.margenPct === null ? "" : t.margenPct < 15 ? "text-acento" : t.margenPct < 30 ? "text-aviso" : "text-ok";

  if (cotizacion)
    return <Cotizacion nombre={nombre} cliente={cliente} t={t} lineas={lineas} conIva={aj.con_iva} onCerrar={() => setCotizacion(false)} />;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {error && <p className="alerta-error">{error}</p>}
        {lineas.length === 0 && (
          <div className="tarjeta">
            <p className="font-semibold">Presupuesto vacío</p>
            <p className="mt-1 text-sm text-muted">Carga las líneas típicas de un spot y llena cada tarifa con la cotización real. Nada se inventa: todo empieza en $0.</p>
            <button type="button" disabled={pendiente} onClick={() => correr(() => cargarPlantillaPresupuesto(proyectoId))} className="btn-primario mt-3">
              Cargar plantilla de spot
            </button>
          </div>
        )}
        {GRUPOS.map((g) => {
          const cuentas = cuentasUsadas.filter((c) => grupoDe(c) === g.v);
          if (!cuentas.length) return null;
          return (
            <section key={g.v} className="tarjeta p-0">
              <header className="flex items-baseline justify-between gap-2 px-4 pb-2 pt-4">
                <h3 className="titulo text-xl">{g.t}</h3>
                <span className="cifra text-sm font-semibold">{pesos(t.porGrupo[g.v])}</span>
              </header>
              {cuentas.map((c) => {
                const ls = lineas.filter((l) => l.cuenta === c);
                const info = t.porCuenta.find((x) => x.cuenta === c);
                return (
                  <div key={c} className="border-t border-borde/60">
                    <p className="flex items-baseline justify-between px-4 py-2 text-xs">
                      <span>
                        <span className="cifra text-muted">{c}</span> <span className="font-semibold uppercase tracking-wide">{nombreCuenta(c)}</span>
                      </span>
                      <span className="cifra">{pesos(info?.total ?? 0)}</span>
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="text-[10px] uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-4 py-1 text-left font-medium">Concepto</th>
                            <th className="w-16 py-1 text-right font-medium">Cant.</th>
                            <th className="w-20 py-1 text-left font-medium">Unidad</th>
                            <th className="w-14 py-1 text-right font-medium">× Veces</th>
                            <th className="w-24 py-1 text-right font-medium">Tarifa</th>
                            <th className="w-24 py-1 text-right font-medium">Total</th>
                            <th className="w-24 py-1 text-right font-medium">Real</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {ls.map((l) => {
                            const total = totalLinea(l);
                            const real = l.real ? Math.round(Number(l.real) * 100) : null;
                            return (
                              <tr key={l.id} className="border-t border-borde/40">
                                <td className="px-4 py-1">
                                  <input defaultValue={l.descripcion} maxLength={120} onBlur={(e) => editar(l.id, "descripcion", e.target.value)} aria-label="Concepto" className="w-full bg-transparent py-1 outline-none focus:bg-tinta/[0.04]" />
                                </td>
                                <td className="py-1">
                                  <input defaultValue={Number(l.cantidad)} inputMode="decimal" onBlur={(e) => editar(l.id, "cantidad", e.target.value)} aria-label="Cantidad" className="cifra w-full bg-transparent py-1 text-right outline-none focus:bg-tinta/[0.04]" />
                                </td>
                                <td className="py-1">
                                  <select defaultValue={l.unidad} onChange={(e) => editar(l.id, "unidad", e.target.value)} aria-label="Unidad" className="w-full bg-transparent py-1 text-xs outline-none">
                                    {UNIDADES.map((u) => (
                                      <option key={u}>{u}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-1">
                                  <input defaultValue={Number(l.veces)} inputMode="decimal" onBlur={(e) => editar(l.id, "veces", e.target.value)} aria-label="Veces" className="cifra w-full bg-transparent py-1 text-right outline-none focus:bg-tinta/[0.04]" />
                                </td>
                                <td className="py-1">
                                  <input defaultValue={Number(l.tarifa) || ""} placeholder="0" inputMode="decimal" onBlur={(e) => editar(l.id, "tarifa", e.target.value || "0")} aria-label="Tarifa" className={`cifra w-full bg-transparent py-1 text-right outline-none focus:bg-tinta/[0.04] ${Number(l.tarifa) === 0 ? "placeholder:text-acento" : ""}`} />
                                </td>
                                <td className="cifra py-1 text-right font-semibold">{pesos(total)}</td>
                                <td className="py-1">
                                  <input defaultValue={l.real ? Number(l.real) : ""} placeholder="—" inputMode="decimal" onBlur={(e) => editar(l.id, "real", e.target.value)} aria-label="Gasto real" className={`cifra w-full bg-transparent py-1 text-right outline-none focus:bg-tinta/[0.04] ${real !== null && real > total ? "text-acento" : ""}`} />
                                </td>
                                <td className="py-1 text-center">
                                  <button type="button" aria-label={`Quitar ${l.descripcion}`} onClick={() => { setLineas((x) => x.filter((y) => y.id !== l.id)); correr(() => archivarLineaPresupuesto(proyectoId, l.id)); }} className="text-muted hover:text-tinta">
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
        <NuevaLinea onAgregar={(c) => correr(() => agregarLineaPresupuesto(proyectoId, c))} />
      </div>

      {/* Topsheet */}
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section className="tarjeta">
          <h3 className="titulo text-2xl">Topsheet</h3>
          <dl className="cifra mt-3 space-y-1.5 text-sm">
            {GRUPOS.map((g) => (
              <div key={g.v} className="flex justify-between gap-2">
                <dt className="text-muted">{g.t}</dt>
                <dd>{pesos(t.porGrupo[g.v])}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-borde/60 pt-1.5 font-semibold">
              <dt>Costo directo</dt>
              <dd>{pesos(t.directo)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1 text-muted">
                Imprevistos
                <input defaultValue={Number(aj.imprevistos_pct)} inputMode="decimal" onBlur={(e) => e.target.value !== String(Number(aj.imprevistos_pct)) && ajustar({ imprevistos_pct: e.target.value })} aria-label="Porcentaje de imprevistos" className="w-12 rounded bg-tinta/[0.06] px-1 text-right" />%
              </dt>
              <dd>{pesos(t.imprevistos)}</dd>
            </div>
            <div className="flex justify-between gap-2 font-semibold">
              <dt>Costo total</dt>
              <dd>{pesos(t.costo)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-1 text-muted">
                Utilidad
                <input defaultValue={Number(aj.utilidad_pct)} inputMode="decimal" onBlur={(e) => e.target.value !== String(Number(aj.utilidad_pct)) && ajustar({ utilidad_pct: e.target.value })} aria-label="Porcentaje de utilidad" className="w-12 rounded bg-tinta/[0.06] px-1 text-right" />%
              </dt>
              <dd>{pesos(t.utilidad)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-borde/60 pt-1.5 text-base font-semibold">
              <dt>Precio sugerido</dt>
              <dd>{pesos(t.precioSugerido)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-muted">
                <input type="checkbox" checked={aj.con_iva} onChange={(e) => ajustar({ con_iva: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--c-rojo))]" aria-label="Cobrar IVA" />
                IVA 16%
              </dt>
              <dd>{pesos(t.iva)}</dd>
            </div>
            <div className="flex justify-between gap-2 font-semibold">
              <dt>Total al cliente</dt>
              <dd>{pesos(t.totalConIva)}</dd>
            </div>
          </dl>
        </section>
        <section className="tarjeta">
          <label className="block">
            <span className="etiqueta">Precio cerrado con el cliente (sin IVA)</span>
            <span className="relative mt-1.5 block">
              <span className="cifra pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input defaultValue={aj.precio_cliente ? Number(aj.precio_cliente) : ""} inputMode="decimal" placeholder="14000" onBlur={(e) => e.target.value !== String(aj.precio_cliente ? Number(aj.precio_cliente) : "") && ajustar({ precio_cliente: e.target.value || null })} className="campo cifra rounded-full py-2 pl-8 text-sm" />
            </span>
          </label>
          {t.margen !== null && (
            <p className={`cifra mt-3 text-2xl font-semibold ${colorMargen}`}>
              {t.margen >= 0 ? "Ganan" : "Pierden"} {pesos(Math.abs(t.margen))} <span className="text-sm">({t.margenPct}%)</span>
            </p>
          )}
          {t.margen !== null && <p className="mt-1 text-xs text-muted">Precio menos costo total (con imprevistos). Arriba de 30% es sano; abajo de 15%, revisen el presupuesto.</p>}
          {t.real > 0 && (
            <p className="cifra mt-3 text-sm">
              Real gastado: <span className={`font-semibold ${t.real > t.costo ? "text-acento" : ""}`}>{pesos(t.real)}</span> de {pesos(t.costo)}
            </p>
          )}
        </section>
        <button type="button" onClick={() => setCotizacion(true)} disabled={!lineas.length} className="btn-secundario w-full">
          Ver cotización para el cliente
        </button>
        {pendiente && <p className="text-center text-xs text-muted">Guardando…</p>}
      </aside>
    </div>
  );
}

function NuevaLinea({ onAgregar }: { onAgregar: (c: { cuenta: string; descripcion: string; cantidad: string; unidad: string; veces: string; tarifa: string }) => void }) {
  const [cuenta, setCuenta] = useState("2200");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [unidad, setUnidad] = useState("día");
  const [tarifa, setTarifa] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!descripcion.trim()) return;
        onAgregar({ cuenta, descripcion, cantidad, unidad, veces: "1", tarifa: tarifa || "0" });
        setDescripcion("");
        setTarifa("");
      }}
      className="tarjeta grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_4.5rem_6rem_7rem_auto]"
    >
      <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Cuenta" className="campo rounded-full py-2 text-sm">
        {CUENTAS.map((c) => (
          <option key={c.cuenta} value={c.cuenta}>
            {c.cuenta} · {c.nombre}
          </option>
        ))}
      </select>
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={120} placeholder="Concepto, ej. Renta de dron" aria-label="Concepto" className="campo rounded-full py-2 text-sm" />
      <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" aria-label="Cantidad" className="campo cifra rounded-full py-2 text-right text-sm" />
      <select value={unidad} onChange={(e) => setUnidad(e.target.value)} aria-label="Unidad" className="campo rounded-full py-2 text-sm">
        {UNIDADES.map((u) => (
          <option key={u}>{u}</option>
        ))}
      </select>
      <input value={tarifa} onChange={(e) => setTarifa(e.target.value)} inputMode="decimal" placeholder="Tarifa" aria-label="Tarifa" className="campo cifra rounded-full py-2 text-right text-sm" />
      <button type="submit" className="btn-primario">Agregar</button>
    </form>
  );
}

// Cotización para el cliente: conceptos por área y precio, sin costos internos.
function Cotizacion({ nombre, cliente, t, lineas, conIva, onCerrar }: { nombre: string; cliente: string | null; t: ReturnType<typeof topsheet>; lineas: LineaPres[]; conIva: boolean; onCerrar: () => void }) {
  const precio = t.precio ?? t.precioSugerido;
  const iva = conIva ? Math.round(precio * 0.16) : 0;
  const hoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2 print:hidden">
        <button type="button" onClick={onCerrar} className="enlace-mono">← Presupuesto</button>
        <button type="button" onClick={() => window.print()} className="btn-primario">Imprimir / PDF</button>
      </div>
      <article className="imprimible mx-auto max-w-3xl rounded-tarjeta bg-[#FBFAF7] p-8 text-[#111] md:p-12">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#111] pb-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em]">Nietzsche Studios · Cotización</p>
            <h1 className="titulo mt-2 text-4xl">{nombre}</h1>
            {cliente && <p className="mt-1 text-sm">Para: {cliente}</p>}
          </div>
          <p className="text-right text-sm">{hoy}</p>
        </header>
        <section className="mt-6 space-y-4">
          {GRUPOS.map((g) => {
            const ls = lineas.filter((l) => grupoDe(l.cuenta) === g.v);
            if (!ls.length) return null;
            return (
              <div key={g.v}>
                <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.15em]">{g.t}</h2>
                <p className="mt-1 text-sm">{[...new Set(ls.map((l) => l.descripcion))].join(" · ")}</p>
              </div>
            );
          })}
        </section>
        <dl className="cifra mt-8 space-y-1 border-t border-[#111]/20 pt-4 text-right text-sm">
          <div className="flex justify-end gap-8">
            <dt>Subtotal</dt>
            <dd className="w-32">{pesos(precio)}</dd>
          </div>
          {conIva && (
            <div className="flex justify-end gap-8">
              <dt>IVA 16%</dt>
              <dd className="w-32">{pesos(iva)}</dd>
            </div>
          )}
          <div className="flex justify-end gap-8 text-lg font-semibold">
            <dt>Total</dt>
            <dd className="w-32">{pesos(precio + iva)}</dd>
          </div>
        </dl>
        <footer className="mt-10 text-xs leading-relaxed text-[#555]">
          Incluye preproducción, rodaje y postproducción descritos arriba. Precio en pesos mexicanos. Vigencia de 15 días. 50% de anticipo para apartar la fecha de rodaje y 50% contra entrega.
        </footer>
      </article>
    </div>
  );
}
