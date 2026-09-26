import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarRutina, cargarTareas } from "@/lib/claqueta/datos";
import { diaSemana, esFechaISO, fechaCDMX, horaAMinutos, lunesDe, minutosAHora, sumarDias } from "@/lib/claqueta/fechas";
import { ordenarPorPuntaje } from "@/lib/claqueta/prioridad";
import { ChipFrente, estiloFrente } from "@/components/claqueta/frente-ui";

export const metadata: Metadata = { title: "Semana" };

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "21 – 27 sep" o "28 sep – 4 oct"
function rango(a: string, b: string) {
  const [ma, da] = [Number(a.slice(5, 7)), Number(a.slice(8))];
  const [mb, db] = [Number(b.slice(5, 7)), Number(b.slice(8))];
  return ma === mb ? `${da} – ${db} ${MESES[mb - 1]}` : `${da} ${MESES[ma - 1]} – ${db} ${MESES[mb - 1]}`;
}

const horas = (min: number) => Math.round(min / 6) / 10;

// SEMANA · plan de rodaje: 7 días con bloques y vencimientos.
export default async function Semana({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requerirSesion();
  const hoy = fechaCDMX();
  const { s } = await searchParams;
  const lunes = lunesDe(esFechaISO(s) ? s : hoy);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const [tareas, rutina] = await Promise.all([cargarTareas(hoy), cargarRutina()]);

  const abiertas = tareas.filter((t) => t.status !== "hecho");
  const vencidas = ordenarPorPuntaje(abiertas.filter((t) => t.due_date && t.due_date < hoy), hoy);
  const esEstaSemana = lunes === lunesDe(hoy);

  const resumen = dias.map((d) => {
    const bloques = rutina
      .filter((b) => b.weekday === diaSemana(d))
      .sort((a, b) => horaAMinutos(a.start_time) - horaAMinutos(b.start_time));
    const focus = bloques.filter((b) => b.kind === "focus");
    return {
      d,
      focus,
      minutosFoco: focus.reduce((a, b) => a + horaAMinutos(b.end_time) - horaAMinutos(b.start_time), 0),
      vencen: ordenarPorPuntaje(abiertas.filter((t) => t.due_date === d), hoy)
    };
  });
  const maxFoco = Math.max(60, ...resumen.map((r) => r.minutosFoco));
  const totalFoco = resumen.reduce((a, r) => a + r.minutosFoco, 0);
  const totalVencen = resumen.reduce((a, r) => a + r.vencen.length, 0);

  return (
    <div className="space-y-6">
      <header className="aparecer flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiqueta">Plan de rodaje</p>
          <h1 className="titulo mt-1 text-6xl md:text-7xl">Semana</h1>
        </div>
        <nav aria-label="Cambiar semana" className="vidrio flex items-center gap-1 rounded-full p-1">
          <Link href={`/app/semana?s=${sumarDias(lunes, -7)}`} aria-label="Semana anterior" className="enlace-mono grid h-9 w-9 place-items-center p-0">←</Link>
          <span className="cifra whitespace-nowrap px-2 text-sm font-medium">{rango(dias[0], dias[6])}</span>
          <Link href={`/app/semana?s=${sumarDias(lunes, 7)}`} aria-label="Semana siguiente" className="enlace-mono grid h-9 w-9 place-items-center p-0">→</Link>
          {!esEstaSemana && (
            <Link href="/app/semana" className="enlace-mono bg-rojo/10 text-acento">Hoy</Link>
          )}
        </nav>
      </header>

      {/* ── Resumen: horas de foco por día ── */}
      <section aria-label="Resumen de la semana" className="tarjeta aparecer grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-end md:gap-8">
        <dl className="flex gap-6 md:flex-col md:gap-3">
          <div>
            <dt className="etiqueta">Foco</dt>
            <dd className="cifra text-3xl font-semibold">{horas(totalFoco)} h</dd>
          </div>
          <div>
            <dt className="etiqueta">Vencen</dt>
            <dd className="cifra text-3xl font-semibold">{totalVencen}</dd>
          </div>
          {esEstaSemana && vencidas.length > 0 && (
            <div>
              <dt className="etiqueta text-acento">Vencidas</dt>
              <dd className="cifra text-3xl font-semibold text-acento">{vencidas.length}</dd>
            </div>
          )}
        </dl>
        <ol className="grid h-32 grid-cols-7 items-end gap-2" aria-hidden="true">
          {resumen.map((r) => {
            const esHoy = r.d === hoy;
            return (
              <li key={r.d} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className="cifra text-[10px] text-muted">{r.minutosFoco ? horas(r.minutosFoco) : ""}</span>
                <span
                  className={`w-full max-w-10 rounded-t-lg rounded-b-sm ${esHoy ? "bg-rojo" : r.d < hoy ? "bg-tinta/20" : "bg-tinta/70"}`}
                  style={{ height: `${Math.max(4, (r.minutosFoco / maxFoco) * 100)}%` }}
                />
                <span className={`font-mono text-[10px] uppercase ${esHoy ? "font-semibold text-acento" : "text-muted"}`}>{DIAS[diaSemana(r.d)]}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {esEstaSemana && vencidas.length > 0 && (
        <p className="tarjeta relative overflow-hidden py-3.5 text-sm">
          <span className="absolute inset-y-0 left-0 w-1 bg-rojo" aria-hidden="true" />
          <span className="font-semibold text-acento">{vencidas.length} vencida{vencidas.length === 1 ? "" : "s"}</span>
          <span className="text-muted"> · {vencidas.slice(0, 3).map((t) => t.title).join(", ")}{vencidas.length > 3 ? "…" : ""}</span>
        </p>
      )}

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {resumen.map(({ d, focus, minutosFoco, vencen }) => {
          const esHoy = d === hoy;
          const pasado = d < hoy;
          return (
            <li
              key={d}
              className={`vidrio aparecer flex flex-col rounded-tarjeta ${esHoy ? "ring-2 ring-rojo/50" : ""} ${pasado ? "opacity-55" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <p className="flex items-baseline gap-2">
                  <span className="titulo text-2xl">{DIAS[diaSemana(d)]}</span>
                  <span className={`cifra grid h-7 min-w-7 place-items-center rounded-full px-1 text-sm ${esHoy ? "bg-rojo font-semibold text-white" : "text-muted"}`}>
                    {Number(d.slice(8))}
                  </span>
                </p>
                <span className="cifra rounded-full bg-tinta/[0.06] px-2 py-0.5 text-[11px] text-muted">{horas(minutosFoco)} h</span>
              </div>

              <div className="flex-1 space-y-3 px-4 pb-4">
                {focus.length === 0 ? (
                  <p className="text-xs text-muted">Sin bloques de foco.</p>
                ) : (
                  <ul className="space-y-1">
                    {focus.map((b) => {
                      const f = b.areas[0];
                      return (
                        <li
                          key={b.id}
                          style={f ? estiloFrente(f) : undefined}
                          className="flex items-center gap-2 rounded-xl bg-[rgb(var(--fc,var(--c-tinta))/0.07)] px-2 py-1.5 text-xs"
                        >
                          <span className="h-4 w-1 shrink-0 rounded-full bg-[rgb(var(--fc,var(--c-borde)))]" aria-hidden="true" />
                          <span className="cifra w-10 shrink-0 text-muted">{minutosAHora(horaAMinutos(b.start_time))}</span>
                          <span className="min-w-0 truncate font-medium">
                            {b.label}
                            {b.areas.length === 0 && <span className="font-normal text-muted"> · libre</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {vencen.length > 0 && (
                  <div className="border-t border-borde/60 pt-3">
                    <p className="etiqueta mb-2">Vence</p>
                    <ul className="space-y-2">
                      {vencen.map((t) => (
                        <li key={t.id} className="text-sm leading-snug">
                          <span className="font-semibold">{t.title}</span>
                          <span className="mt-1 block"><ChipFrente id={t.area} corto /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
