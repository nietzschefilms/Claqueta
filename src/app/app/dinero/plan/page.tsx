import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarDinero } from "@/lib/claqueta/datos";
import { fechaCDMX, fechaCorta } from "@/lib/claqueta/fechas";
import { fechasTarjeta, pesos, saldosCuentas } from "@/lib/claqueta/dinero";
import { consejosFiscales, estimadoMes } from "@/lib/claqueta/impuestos";
import { CAMINO_NU, USO_CREDITO_IDEAL, USO_CREDITO_SANO, consejosDinero, ingresoFijoMensual, limiteCredito, repartoMensual } from "@/lib/claqueta/plan";
import { Encabezado } from "@/components/Encabezado";

export const metadata: Metadata = { title: "Plan y contador" };

const NIVEL = {
  alerta: "border-rojo/40 bg-rojo/[0.07]",
  ojo: "border-aviso/40 bg-aviso/[0.08]",
  bien: "border-ok/40 bg-ok/[0.08]"
} as const;

// PLAN Y CONTADOR · cómo repartir lo que entra, cómo crecer tu crédito y cómo pagar menos impuestos (legal).
export default async function Plan() {
  await requerirSesion();
  const hoy = fechaCDMX();
  const mes = hoy.slice(0, 7);
  const { reglas, pagos, gastos, cuentas, transferencias, fijos } = await cargarDinero();

  const saldos = saldosCuentas(cuentas, pagos, gastos, transferencias);
  const tarjetas = cuentas
    .filter((c) => c.tipo === "credito")
    .map((c) => ({ c, deuda: saldos.porCuenta.get(c.id) ?? 0, limite: limiteCredito(c, saldos.porCuenta), fechas: fechasTarjeta(c, hoy) }));
  const limiteTotal = tarjetas.reduce((a, t) => a + (t.limite ?? 0), 0);
  const deudaConLimite = tarjetas.filter((t) => t.limite).reduce((a, t) => a + Math.max(0, t.deuda), 0);
  const usoCredito = limiteTotal > 0 ? deudaConLimite / limiteTotal : null;

  const ingreso = ingresoFijoMensual(reglas);
  const r = repartoMensual(ingreso, fijos, limiteTotal);
  const consejos = consejosDinero({ usoCredito, disponible: saldos.disponible, deuda: saldos.deuda, ingresoFijo: ingreso, ahorrado: saldos.apartado });
  const fiscal = estimadoMes(pagos, mes);
  const tips = consejosFiscales(fiscal, { facturasEmitidas: pagos.filter((p) => p.factura).length });

  const filas = [
    { t: "Impuestos (RESICO)", v: r.impuestos, d: "Apártalo el día que cobras.", color: "bg-tinta/70" },
    { t: "Suscripciones", v: r.suscripciones, d: fijos.map((f) => f.nombre).join(", ") || "Ninguna", color: "bg-f-nietzsche" },
    { t: "Ahorro · colchón", v: r.ahorro, d: "15%. Primero, antes de gastar.", color: "bg-ok" },
    { t: "Fondo de equipo", v: r.equipo, d: "10%. Para cámara, lentes, discos.", color: "bg-f-topmart" },
    { t: "Para vivir", v: r.vivir, d: "Comida, transporte, salidas.", color: "bg-f-escuela" }
  ];

  return (
    <div className="space-y-6">
      <Encabezado etiqueta="Tu dinero, con cabeza" titulo="Plan">
        <Link href="/app/dinero" className="btn-secundario">
          <span aria-hidden="true">←</span> Dinero
        </Link>
      </Encabezado>

      {/* ── Consejos del momento ── */}
      {consejos.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {consejos.map((c) => (
            <div key={c.titulo} className={`aparecer rounded-tarjeta border p-4 backdrop-blur ${NIVEL[c.nivel]}`}>
              <p className="font-semibold">{c.titulo}</p>
              <p className="mt-1 text-sm text-muted">{c.texto}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* ── Reparto del ingreso fijo ── */}
        <section aria-labelledby="reparto" className="tarjeta aparecer min-w-0 lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="reparto" className="titulo text-2xl">Cómo repartir cada mes</h2>
            <span className="etiqueta">Ingreso fijo</span>
          </div>
          <p className="cifra mt-2 text-4xl font-semibold">{pesos(r.ingreso)}</p>
          <p className="text-sm text-muted">Top Mart 2 quincenas + clínica 4 viernes. Comisiones, EK y meses de 5 viernes son extra.</p>

          <div className="mt-5 flex h-4 overflow-hidden rounded-full" aria-hidden="true">
            {filas.map((f) => (
              <span key={f.t} className={f.color} style={{ width: `${r.ingreso ? (f.v / r.ingreso) * 100 : 0}%` }} />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-borde/60">
            {filas.map((f) => (
              <li key={f.t} className="flex items-center gap-3 py-3">
                <span className={`h-3 w-3 shrink-0 rounded-full ${f.color}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{f.t}</p>
                  <p className="truncate text-xs text-muted">{f.d}</p>
                </div>
                <span className="cifra shrink-0 font-semibold">{pesos(f.v)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-tinta/[0.05] p-4">
              <p className="etiqueta">Tope en tarjeta al mes</p>
              <p className="cifra mt-1 text-2xl font-semibold">{pesos(r.topeCredito)}</p>
              <p className="mt-1 text-xs text-muted">30% de tu límite. Solo cosas que ya tienes para pagar, y pagas el total.</p>
            </div>
            <div className="rounded-2xl bg-tinta/[0.05] p-4">
              <p className="etiqueta">Meta de colchón</p>
              <p className="cifra mt-1 text-2xl font-semibold">{pesos(r.colchonMeta)}</p>
              <p className="mt-1 text-xs text-muted">3 meses de fijos + vida. Con 15% al mes llegas en {r.ahorro ? Math.ceil(r.colchonMeta / r.ahorro) : "—"} meses.</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-borde/70 p-4">
            <p className="font-semibold">¿Cuándo comprar equipo?</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>Cuando tu colchón ya tenga al menos un mes de ingresos.</li>
              <li>Con el fondo de equipo: compra cuando cubra el precio completo. Así no pagas intereses.</li>
              <li>Si lo necesitas para un proyecto pagado (ej. EK), usa ese pago y pide factura: el IVA se te regresa cuando cobres con IVA.</li>
              <li>Meses sin intereses solo si la mensualidad cabe en tu tope de tarjeta y lo tienes en el fondo.</li>
            </ol>
          </div>
        </section>

        {/* ── Crédito ── */}
        <section aria-labelledby="credito" className="tarjeta aparecer min-w-0 lg:col-span-5">
          <h2 id="credito" className="titulo text-2xl">Tu crédito</h2>
          <ul className="mt-4 space-y-4">
            {tarjetas.map(({ c, deuda, limite, fechas }) => {
              const uso = limite ? Math.max(0, deuda) / limite : null;
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="cifra text-sm">{limite ? `${pesos(Math.max(0, deuda))} de ${pesos(limite)}` : deuda > 0 ? `Debes ${pesos(deuda)}` : "Al corriente"}</p>
                  </div>
                  {uso !== null && (
                    <>
                      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-tinta/10" role="progressbar" aria-label={`Uso de ${c.nombre}`} aria-valuenow={Math.round(uso * 100)} aria-valuemin={0} aria-valuemax={100}>
                        <div className={`h-full rounded-full ${uso > USO_CREDITO_SANO ? "bg-rojo" : "bg-ok"}`} style={{ width: `${Math.min(100, uso * 100)}%` }} />
                        <span className="absolute inset-y-0 w-px bg-tinta/50" style={{ left: `${USO_CREDITO_SANO * 100}%` }} aria-hidden="true" />
                        <span className="absolute inset-y-0 w-px bg-tinta/30" style={{ left: `${USO_CREDITO_IDEAL * 100}%` }} aria-hidden="true" />
                      </div>
                      <p className="cifra mt-1 text-[11px] text-muted">
                        {Math.round(uso * 100)}% usado · te quedan {pesos(Math.max(0, (limite ?? 0) - Math.max(0, deuda)))} · ideal abajo de 10%, máximo 30%
                      </p>
                    </>
                  )}
                  {fechas && deuda > 0 && <p className="cifra mt-1 text-[11px] font-semibold text-acento">Paga el total antes del {fechaCorta(fechas.limite)}</p>}
                </li>
              );
            })}
          </ul>

          <h3 className="titulo mt-6 text-xl">Camino para crecer tu historial con Nu</h3>
          <ol className="mt-3 space-y-3">
            {CAMINO_NU.map((p, i) => (
              <li key={p.paso} className="flex gap-3">
                <span className="cifra grid h-7 w-7 shrink-0 place-items-center rounded-full bg-tinta text-xs font-semibold text-fondo">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold">{p.paso}</p>
                  <p className="text-sm text-muted">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ── Contador ── */}
      <section aria-labelledby="contador" className="tarjeta aparecer">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="contador" className="titulo text-2xl">Tu contador</h2>
          <span className="etiqueta">Pagar menos, 100% legal</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Este mes llevas {pesos(fiscal.base)} de tu trabajo: aparta {pesos(fiscal.apartar)} de impuestos{fiscal.ivaPorAclarar > 0 ? ` (${pesos(fiscal.ivaPorAclarar)} son IVA por aclarar de cobros sin factura)` : ""}, antes del {fechaCorta(fiscal.limite)}.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {tips
            .filter((t) => t.aplica !== false)
            .map((t) => (
              <li key={t.titulo} className="rounded-2xl bg-tinta/[0.04] p-4">
                <p className="font-semibold">{t.titulo}</p>
                <p className="mt-1 text-sm text-muted">{t.texto}</p>
              </li>
            ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Son reglas generales para planear. Antes de decisiones grandes confírmalo con un contador.</p>
      </section>
    </div>
  );
}
