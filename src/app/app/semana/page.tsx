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

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-tinta pb-3">
        <div className="flex items-end justify-between gap-3">
          <h1 className="titulo text-5xl">Semana</h1>
          <p className="etiqueta">Plan de rodaje</p>
        </div>
        <nav aria-label="Cambiar semana" className="flex items-center justify-between gap-2">
          <Link href={`/app/semana?s=${sumarDias(lunes, -7)}`} className="rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
            ← Anterior
          </Link>
          <span className="cifra whitespace-nowrap text-sm">{rango(dias[0], dias[6])}</span>
          <div className="flex items-center gap-1">
            {!esEstaSemana && (
              <Link href="/app/semana" className="rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-wider text-acento focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                Hoy
              </Link>
            )}
            <Link href={`/app/semana?s=${sumarDias(lunes, 7)}`} className="rounded-sm px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
              Siguiente →
            </Link>
          </div>
        </nav>
      </header>

      {esEstaSemana && vencidas.length > 0 && (
        <p className="border-l-2 border-rojo pl-3 text-sm">
          <span className="font-semibold text-acento">{vencidas.length} vencida{vencidas.length === 1 ? "" : "s"}</span>
          <span className="text-muted"> · {vencidas.slice(0, 3).map((t) => t.title).join(", ")}{vencidas.length > 3 ? "…" : ""}</span>
        </p>
      )}

      <ol className="grid gap-3 lg:grid-cols-7 lg:gap-2">
        {dias.map((d) => {
          const bloques = rutina
            .filter((b) => b.weekday === diaSemana(d))
            .sort((a, b) => horaAMinutos(a.start_time) - horaAMinutos(b.start_time));
          const focus = bloques.filter((b) => b.kind === "focus");
          const minutosFoco = focus.reduce((a, b) => a + horaAMinutos(b.end_time) - horaAMinutos(b.start_time), 0);
          const vencen = ordenarPorPuntaje(abiertas.filter((t) => t.due_date === d), hoy);
          const esHoy = d === hoy;
          const pasado = d < hoy;
          return (
            <li key={d} className={`border bg-superficie ${esHoy ? "border-tinta" : "border-borde"} ${pasado ? "opacity-60" : ""}`}>
              <div className="flex items-baseline justify-between gap-2 border-b border-borde px-3 py-2">
                <p className="flex items-baseline gap-2">
                  {esHoy && <span className="h-2 w-2 self-center rounded-full bg-rojo" aria-label="Hoy" />}
                  <span className="font-display text-xl font-bold uppercase tracking-tight">{DIAS[diaSemana(d)]}</span>
                  <span className="cifra text-sm text-muted">{Number(d.slice(8))}</span>
                </p>
                <span className="cifra text-[11px] text-muted">{Math.round(minutosFoco / 6) / 10} h foco</span>
              </div>

              <div className="space-y-3 p-3">
                {focus.length === 0 ? (
                  <p className="text-xs text-muted">Sin bloques de foco.</p>
                ) : (
                  <ul className="space-y-1">
                    {focus.map((b) => {
                      const f = b.areas[0];
                      return (
                        <li key={b.id} style={f ? estiloFrente(f) : undefined} className="flex items-baseline gap-2 text-xs">
                          <span className="cifra w-10 shrink-0 text-muted">{minutosAHora(horaAMinutos(b.start_time))}</span>
                          <span className={`h-3 w-0.5 shrink-0 self-center ${f ? "bg-[rgb(var(--fc))]" : "bg-borde"}`} aria-hidden="true" />
                          <span className="min-w-0 truncate">
                            {b.label}
                            {b.areas.length === 0 && <span className="text-muted"> · libre</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {vencen.length > 0 && (
                  <div className="border-t border-dashed border-borde pt-2">
                    <p className="etiqueta mb-1.5">Vence</p>
                    <ul className="space-y-1.5">
                      {vencen.map((t) => (
                        <li key={t.id} className="text-sm leading-snug">
                          <span className="font-medium">{t.title}</span>
                          <span className="block"><ChipFrente id={t.area} corto /></span>
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
