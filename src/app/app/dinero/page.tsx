import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarDinero } from "@/lib/claqueta/datos";
import { fechaCDMX, fechaCorta, fechaRelativa } from "@/lib/claqueta/fechas";
import { aCentavos, avanceContrato, esperados, fechasTarjeta, gastoPorCategoria, NOMBRE_TIPO, pesos, resumen, saldosCuentas, type Esperado } from "@/lib/claqueta/dinero";
import { ChipFrente, estiloFrente } from "@/components/claqueta/frente-ui";
import { Encabezado } from "@/components/Encabezado";
import { estimadoMes } from "@/lib/claqueta/impuestos";
import { BotonAnular, BotonCobro, BotonFijo, FormEntrada, FormGasto, FormMover, type OpcionCuenta } from "./Formularios";
import Link from "next/link";

export const metadata: Metadata = { title: "Dinero" };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// DINERO · cuánto entra, cuánto sale y cuánto falta del contrato de EK.
export default async function Dinero() {
  await requerirSesion();
  const hoy = fechaCDMX();
  const mes = hoy.slice(0, 7);
  const { reglas, pagos, gastos, contratos, cuentas, transferencias, fijos } = await cargarDinero();
  const cobradosFijos = new Set(gastos.map((g) => g.fijo_key).filter(Boolean));
  const totalFijos = fijos.reduce((a, f) => a + (aCentavos(f.monto_mxn) ?? 0), 0);
  const saldos = saldosCuentas(cuentas, pagos, gastos, transferencias);
  const nombreCuenta = new Map(cuentas.map((c) => [c.id, c.nombre]));
  const opciones: OpcionCuenta[] = cuentas.map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo }));
  const paraGastar = opciones.filter((c) => c.tipo !== "garantia");
  const paraRecibir = opciones.filter((c) => c.tipo === "debito" || c.tipo === "efectivo");

  const r = resumen(pagos, gastos, mes);
  const cobros = esperados(reglas, pagos, hoy);
  const porCategoria = gastoPorCategoria(gastos, mes);
  const maxCategoria = Math.max(1, ...porCategoria.map((c) => c.centavos));
  const clinica = reglas.find((x) => x.area === "rt");
  const fiscal = estimadoMes(pagos, mes);
  const pct = (t: number) => `${(t * 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;

  const movimientos = [
    ...pagos.map((p) => ({ tipo: "entrada" as const, id: p.id, fecha: p.date, titulo: p.source, cuenta: nombreCuenta.get(p.cuenta_id ?? ""), detalle: p.note, centavos: aCentavos(p.amount) ?? 0 })),
    ...gastos.map((g) => ({ tipo: "gasto" as const, id: g.id, fecha: g.date, titulo: g.category, cuenta: nombreCuenta.get(g.cuenta_id ?? ""), detalle: g.note, centavos: aCentavos(g.amount) ?? 0 })),
    ...transferencias.map((t) => ({ tipo: "movimiento" as const, id: t.id, fecha: t.date, titulo: `${nombreCuenta.get(t.desde_id) ?? "?"} → ${nombreCuenta.get(t.hacia_id) ?? "?"}`, cuenta: undefined, detalle: t.note, centavos: aCentavos(t.amount) ?? 0 }))
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 25);

  return (
    <div className="space-y-6">
      <Encabezado etiqueta={`${MESES[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}`} titulo="Dinero">
        <Link href="/app/dinero/plan" className="btn-primario">
          Plan y contador <span aria-hidden="true">→</span>
        </Link>
      </Encabezado>

      {/* ── Saldo ── */}
      <section aria-label="Saldo" className="vidrio aparecer relative overflow-hidden rounded-tarjeta p-5 md:p-7">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-ok/20 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="etiqueta">Disponible</p>
            <p className={`cifra mt-1 text-[clamp(2.75rem,12vw,4.75rem)] font-semibold leading-none tracking-tight ${saldos.disponible < 0 ? "text-acento" : ""}`}>{pesos(saldos.disponible)}</p>
            <p className="mt-2 text-sm text-muted">En débito y efectivo, listo para usar.</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 md:w-[26rem]">
            <div className="rounded-2xl bg-ok/10 p-3">
              <dt className="etiqueta text-ok">Entró este mes</dt>
              <dd className="cifra mt-1 text-xl font-semibold">{pesos(r.entradas)}</dd>
            </div>
            <div className="rounded-2xl bg-tinta/[0.05] p-3">
              <dt className="etiqueta">Gastaste este mes</dt>
              <dd className="cifra mt-1 text-xl font-semibold">{pesos(r.salidas)}</dd>
            </div>
            <div className={`rounded-2xl p-3 ${saldos.deuda > 0 ? "bg-rojo/10" : "bg-tinta/[0.05]"}`}>
              <dt className={`etiqueta ${saldos.deuda > 0 ? "text-acento" : ""}`}>Debes en tarjetas</dt>
              <dd className="cifra mt-1 text-xl font-semibold">{pesos(saldos.deuda)}</dd>
            </div>
            <div className="rounded-2xl bg-tinta/[0.05] p-3">
              <dt className="etiqueta">Apartado</dt>
              <dd className="cifra mt-1 text-xl font-semibold">{pesos(saldos.apartado)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          {/* ── Gasto rápido ── */}
          <section aria-labelledby="gasto" className="tarjeta aparecer">
            <h2 id="gasto" className="titulo mb-4 text-2xl">Anotar gasto</h2>
            <FormGasto hoy={hoy} cuentas={paraGastar} />
          </section>

          {/* ── Otra entrada ── */}
          <section aria-labelledby="otra" className="tarjeta aparecer">
            <h2 id="otra" className="titulo text-2xl">Otra entrada</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Dinero de tus papás, un regalo o un cliente nuevo.</p>
            <FormEntrada
              hoy={hoy}
              fuentes={[
                { t: "Papás", gravable: false },
                { t: "Regalo", gravable: false },
                { t: "Cliente", gravable: true }
              ]}
              area=""
              boton="Guardar entrada"
              idBase="otra"
              cuentas={paraRecibir}
              elegirGravable
            />
          </section>

          {/* ── En qué se va ── */}
          {porCategoria.length > 0 && (
            <section aria-labelledby="categorias" className="tarjeta aparecer">
              <h2 id="categorias" className="titulo mb-4 text-2xl">En qué se va</h2>
              <ul className="space-y-3">
                {porCategoria.map((c) => (
                  <li key={c.categoria}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{c.categoria}</span>
                      <span className="cifra">{pesos(c.centavos)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-tinta/[0.07]" aria-hidden="true">
                      <div className="h-full rounded-full bg-tinta/70" style={{ width: `${(c.centavos / maxCategoria) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Movimientos ── */}
          <section aria-labelledby="movs" className="tarjeta aparecer p-0">
            <h2 id="movs" className="titulo px-5 pb-2 pt-5 text-2xl">Movimientos</h2>
            {movimientos.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Aún no hay movimientos.</p>
            ) : (
              <ul className="divide-y divide-borde/60">
                {movimientos.map((m) => (
                  <li key={`${m.tipo}-${m.id}`} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${m.tipo === "entrada" ? "bg-ok/15 text-ok" : m.tipo === "movimiento" ? "bg-tinta/[0.04] text-muted" : "bg-tinta/[0.06] text-muted"}`}
                      aria-hidden="true"
                    >
                      {m.tipo === "entrada" ? "↓" : m.tipo === "movimiento" ? "⇄" : "↑"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.titulo}</p>
                      <p className="cifra truncate text-[11px] text-muted">
                        {fechaRelativa(m.fecha, hoy)}
                        {m.cuenta ? ` · ${m.cuenta}` : ""}
                        {m.detalle ? ` · ${m.detalle}` : ""}
                      </p>
                    </div>
                    <span className={`cifra shrink-0 text-sm font-semibold ${m.tipo === "entrada" ? "text-ok" : m.tipo === "movimiento" ? "text-muted" : ""}`}>
                      {m.tipo === "entrada" ? "+" : m.tipo === "movimiento" ? "" : "−"}
                      {pesos(m.centavos)}
                    </span>
                    <BotonAnular tipo={m.tipo} id={m.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-5">
          {/* ── Cuentas ── */}
          <section aria-labelledby="cuentas" className="tarjeta aparecer p-0">
            <h2 id="cuentas" className="titulo px-5 pb-2 pt-5 text-2xl">Cuentas</h2>
            <ul className="divide-y divide-borde/60">
              {cuentas.map((c) => {
                const saldo = saldos.porCuenta.get(c.id) ?? 0;
                const tarjeta = c.tipo === "credito" ? fechasTarjeta(c, hoy) : null;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{c.nombre}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                        {NOMBRE_TIPO[c.tipo]}
                        {tarjeta && saldo > 0 ? ` · paga antes del ${fechaCorta(tarjeta.limite)}` : ""}
                        {tarjeta && saldo <= 0 ? ` · corte ${fechaCorta(tarjeta.corte)}` : ""}
                      </p>
                    </div>
                    <p className={`cifra shrink-0 text-right text-base font-semibold ${c.tipo === "credito" && saldo > 0 ? "text-acento" : ""}`}>
                      {c.tipo === "credito" ? (saldo > 0 ? `Debes ${pesos(saldo)}` : saldo < 0 ? `A favor ${pesos(-saldo)}` : "Al corriente") : pesos(saldo)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <details className="group border-t border-borde/60">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rojo">
                Mover dinero
                <span className="text-xs font-normal text-muted">pagar tarjeta, apartar, sacar efectivo <span className="inline-block transition group-open:rotate-90">›</span></span>
              </summary>
              <div className="px-5 pb-5">
                <FormMover hoy={hoy} cuentas={opciones} />
              </div>
            </details>
          </section>

          {/* ── Suscripciones ── */}
          <section aria-labelledby="fijos" className="tarjeta aparecer p-0">
            <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
              <h2 id="fijos" className="titulo text-2xl">Suscripciones</h2>
              <span className="cifra text-xs text-muted">≈ {pesos(totalFijos)} /mes</span>
            </div>
            {fijos.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Sin suscripciones.</p>
            ) : (
              <ul className="divide-y divide-borde/60">
                {fijos.map((f) => {
                  const cobrado = cobradosFijos.has(`${f.id}:${mes}`);
                  return (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{f.nombre}</p>
                        <p className="cifra text-[11px] text-muted">
                          {f.moneda === "USD" ? `US$${Number(f.monto)} ≈ ${pesos(aCentavos(f.monto_mxn) ?? 0)}` : pesos(aCentavos(f.monto_mxn) ?? 0)}
                          {f.dia ? ` · cada día ${f.dia}` : " · mensual"}
                        </p>
                      </div>
                      {cobrado ? (
                        <span className="rounded-full bg-ok/15 px-3 py-1 text-xs font-semibold text-ok">Cobrado este mes ✓</span>
                      ) : (
                        <BotonFijo fijoId={f.id} mes={mes} montoMxn={String(Number(f.monto_mxn))} cuentas={paraGastar} cuentaInicial={f.cuenta_id} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Cobros esperados ── */}
          <section aria-labelledby="cobros" className="tarjeta aparecer p-0">
            <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
              <h2 id="cobros" className="titulo text-2xl">Cobros</h2>
              <span className="etiqueta">Próximos 14 días</span>
            </div>
            {cobros.atrasados.length + cobros.hoy.length + cobros.proximos.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Nada esperado en estos días.</p>
            ) : (
              <ul className="divide-y divide-borde/60">
                {[...cobros.atrasados, ...cobros.hoy, ...cobros.proximos].map((e) => (
                  <FilaCobro key={e.clave} e={e} hoy={hoy} cuentas={paraRecibir} />
                ))}
              </ul>
            )}
          </section>

          {/* ── Impuestos (RESICO) ── */}
          <section aria-labelledby="impuestos" className="tarjeta aparecer">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="impuestos" className="titulo text-2xl">Impuestos</h2>
              <span className="etiqueta">RESICO · estimado</span>
            </div>
            <p className="cifra mt-3 text-3xl font-semibold">{pesos(fiscal.total)}</p>
            <p className="text-sm text-muted">
              De {MESES[Number(mes.slice(5)) - 1]}. Declara y paga antes del <span className="font-semibold text-tinta">{fechaCorta(fiscal.limite)}</span>.
            </p>
            <dl className="cifra mt-4 space-y-1.5 border-t border-borde/60 pt-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Ingresos de tu trabajo</dt>
                <dd>{pesos(fiscal.base)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">ISR {pct(fiscal.tasa)}</dt>
                <dd>{pesos(fiscal.isr)}</dd>
              </div>
              {fiscal.retIsr > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">− ISR que ya te retuvieron</dt>
                  <dd>{pesos(fiscal.retIsr)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-muted">IVA cobrado{fiscal.retIva > 0 ? " − retenido" : ""}</dt>
                <dd>{pesos(fiscal.ivaPagar)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Aparta este dinero para no gastarlo. Es un cálculo para planear: tu contador confirma la declaración. Lo de tus papás y los regalos no cuenta.
            </p>
          </section>

          {/* ── Contratos (EK Bars) ── */}
          {contratos.map((c) => {
            const a = avanceContrato(c, pagos, hoy);
            return (
              <section key={c.id} aria-label={`Contrato ${c.client}`} style={c.area ? estiloFrente(c.area) : undefined} className="tarjeta aparecer relative overflow-hidden">
                <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgb(var(--fc,var(--c-tinta))/0.18)] to-transparent" aria-hidden="true" />
                <div className="relative">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="titulo text-2xl">{c.client}</h2>
                    <span className="etiqueta">Contrato</span>
                  </div>
                  <p className="cifra mt-3 text-3xl font-semibold">
                    {pesos(a.pagado)} <span className="text-base font-normal text-muted">de {pesos(a.total)}</span>
                  </p>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-tinta/10" role="progressbar" aria-label="Avance de pago" aria-valuenow={Math.round(a.porcentaje * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-[rgb(var(--fc,var(--c-ok)))]" style={{ width: `${Math.max(2, a.porcentaje * 100)}%` }} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="etiqueta">Faltan</dt>
                      <dd className="cifra mt-0.5 text-lg font-semibold">{pesos(a.restante)}</dd>
                    </div>
                    {a.mesesRestantes && a.restante > 0 && (
                      <div>
                        <dt className="etiqueta">Ritmo sugerido</dt>
                        <dd className="cifra mt-0.5 text-lg font-semibold">
                          {pesos(a.sugeridoMensual)}
                          <span className="text-xs font-normal text-muted"> /mes · {a.mesesRestantes} meses</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {a.abonos.length > 0 && (
                    <ul className="mt-4 space-y-1.5 border-t border-borde/60 pt-3">
                      {a.abonos.map((p, i) => (
                        <li key={p.id} className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-muted">
                            <span className="cifra text-[11px]">#{i + 1}</span> {p.note || "Abono"} · <span className="cifra text-[11px]">{fechaRelativa(p.date, hoy)}</span>
                          </span>
                          <span className="cifra font-semibold">{pesos(aCentavos(p.amount) ?? 0)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-5">
                    <p className="etiqueta mb-2">Registrar pago del cliente</p>
                    <FormEntrada hoy={hoy} fuente={c.client} area={c.area ?? ""} contrato={c.id} boton="Guardar pago" idBase={`contrato-${c.id}`} cuentas={paraRecibir} />
                  </div>
                </div>
              </section>
            );
          })}

          {/* ── Comisiones de la clínica ── */}
          {clinica && (
            <section aria-labelledby="comisiones" style={estiloFrente("rt")} className="tarjeta aparecer">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="comisiones" className="titulo text-2xl">Comisiones</h2>
                <ChipFrente id="rt" />
              </div>
              <p className="mb-4 mt-1 text-sm text-muted">Lo que te tocó de comisiones esta semana, aparte de tu fijo.</p>
              <FormEntrada hoy={hoy} fuente={`${clinica.source} · comisiones`} area="rt" boton="Guardar comisiones" idBase="comisiones" cuentas={paraRecibir} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaCobro({ e, hoy, cuentas }: { e: Esperado; hoy: string; cuentas: OpcionCuenta[] }) {
  const atrasado = e.fecha < hoy;
  return (
    <li className="flex items-center gap-3 px-5 py-3.5" style={e.regla.area ? estiloFrente(e.regla.area) : undefined}>
      <span className="h-9 w-1 shrink-0 rounded-full bg-[rgb(var(--fc,var(--c-borde)))]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{e.regla.source}</p>
        <p className={`cifra text-[11px] ${atrasado ? "font-semibold text-acento" : e.fecha === hoy ? "font-semibold text-tinta" : "text-muted"}`}>
          {atrasado ? "no ha llegado · " : ""}
          {fechaRelativa(e.fecha, hoy)} · {pesos(e.centavos)}
        </p>
      </div>
      <BotonCobro reglaId={e.regla.id} fecha={e.fecha} monto={(e.centavos / 100).toString()} cuentas={cuentas} />
    </li>
  );
}
