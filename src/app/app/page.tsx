import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarHitos, cargarRutina, cargarTareas } from "@/lib/claqueta/datos";
import { diaSemana, fechaCDMX, fechaRelativa, minutosAHora, minutosAhoraCDMX } from "@/lib/claqueta/fechas";
import { lasTresDeHoy, planearDia } from "@/lib/claqueta/planeador";
import { puntaje } from "@/lib/claqueta/prioridad";
import { riesgoEK, EK_SEMANAS } from "@/lib/claqueta/ek";
import { FRENTES } from "@/lib/claqueta/frentes";
import type { Tarea } from "@/lib/claqueta/tipos";
import { CheckTarea } from "@/components/claqueta/CheckTarea";
import { BotonMoverManana } from "@/components/claqueta/AccionesTarea";
import { ChipFrente, EtiquetaPrioridad, estiloFrente } from "@/components/claqueta/frente-ui";

export const metadata: Metadata = { title: "Hoy" };

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function duracion(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

const SEMAFORO = { "en-tiempo": "bg-ok", "atras-1": "bg-aviso", "atras-2": "bg-rojo" } as const;

// HOY · la hoja de llamado del día.
export default async function Hoy() {
  await requerirSesion();
  const hoy = fechaCDMX();
  const ahora = minutosAhoraCDMX();
  const [tareas, rutina, hitos] = await Promise.all([cargarTareas(hoy), cargarRutina(), cargarHitos("ek")]);

  const plan = planearDia(rutina.filter((b) => b.weekday === diaSemana(hoy)), tareas, hoy);
  const tres = lasTresDeHoy(tareas, hoy);
  const ek = riesgoEK(hitos, hoy);
  const [, mes, dia] = hoy.split("-").map(Number);
  const hechasHoy = tareas.filter((t) => t.status === "hecho" && t.done_at && fechaCDMX(t.done_at) === hoy).length;
  const minutosPlan = plan.bloques.reduce((a, b) => a + b.usados, 0);

  return (
    <div className="space-y-10">
      {/* ── Encabezado de la hoja ── */}
      <header className="space-y-5">
        <div className="flex items-baseline justify-between gap-3 border-b border-tinta pb-2">
          <p className="etiqueta text-tinta">Hoja de llamado</p>
          <p className="cifra text-xs text-muted">{hoy.split("-").reverse().join(".")}</p>
        </div>
        <h1 className="titulo text-[clamp(3.5rem,17vw,7rem)]">
          {DIAS[diaSemana(hoy)]}
          <span className="block text-[0.42em] leading-tight text-muted">
            {dia} de {MESES[mes - 1]}
          </span>
        </h1>

        <dl className="grid grid-cols-3 divide-x divide-borde border-y border-borde">
          <div className="py-3 pr-3">
            <dt className="etiqueta">Hechas</dt>
            <dd className="cifra mt-1 text-2xl">{hechasHoy}</dd>
          </div>
          <div className="px-3 py-3">
            <dt className="etiqueta">Plan</dt>
            <dd className="cifra mt-1 text-2xl">{duracion(minutosPlan)}</dd>
          </div>
          <div className="py-3 pl-3">
            <dt className="etiqueta">No cupo</dt>
            <dd className={`cifra mt-1 text-2xl ${plan.noCupo.length ? "text-acento" : ""}`}>{plan.noCupo.length}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-sm border border-borde px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider">
            <span className={`h-2 w-2 rounded-full ${SEMAFORO[ek.semaforo]}`} aria-hidden="true" />
            EK Bars · Sem {Math.min(ek.semana, EK_SEMANAS)}/{EK_SEMANAS} · {ek.texto}
          </span>
          <span className="inline-flex items-center gap-2 rounded-sm border border-dashed border-borde px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
            $ Cobros de hoy · llega en la fase 2
          </span>
        </div>
      </header>

      {/* ── Las 3 de hoy ── */}
      <section aria-labelledby="tres">
        <h2 id="tres" className="etiqueta mb-3 text-tinta">Las 3 de hoy</h2>
        {tres.length === 0 ? (
          <p className="text-sm text-muted">Nada pendiente. Captura algo con el botón rojo.</p>
        ) : (
          <ol className="divide-y divide-borde border-y border-borde">
            {tres.map((t, i) => (
              <li key={t.id} className="flex items-start gap-4 py-4">
                <span className="cifra w-8 shrink-0 pt-0.5 text-2xl leading-none text-muted/60">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold leading-snug">{t.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ChipFrente id={t.area} corto />
                    <MetaTarea t={t} hoy={hoy} />
                    <EtiquetaPrioridad puntaje={puntaje(t, hoy)} />
                  </div>
                </div>
                <CheckTarea id={t.id} hecha={false} titulo={t.title} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── No cupo hoy ── */}
      {plan.noCupo.length > 0 && (
        <section aria-labelledby="nocupo" className="border-l-2 border-rojo pl-4">
          <h2 id="nocupo" className="etiqueta mb-1 text-acento">No cupo hoy</h2>
          <p className="mb-3 text-sm text-muted">Vence hoy o ya venció y no entra en ningún bloque. Hazlo aparte o pásalo a mañana.</p>
          <ul className="space-y-3">
            {plan.noCupo.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                <CheckTarea id={t.id} hecha={false} titulo={t.title} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
                    <ChipFrente id={t.area} corto />
                    <MetaTarea t={t} hoy={hoy} />
                  </div>
                </div>
                <BotonMoverManana id={t.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Línea de tiempo ── */}
      <section aria-labelledby="linea">
        <h2 id="linea" className="etiqueta mb-4 text-tinta">Línea de tiempo</h2>
        {plan.bloques.length === 0 ? (
          <p className="text-sm text-muted">Hoy no hay rutina. Día libre.</p>
        ) : (
          <ol className="relative">
            {plan.bloques.map((bp) => {
              const enCurso = ahora >= bp.inicio && ahora < bp.fin;
              const pasado = ahora >= bp.fin;
              const frente = bp.bloque.areas[0];
              const fijo = bp.bloque.kind === "fixed";
              return (
                <li key={bp.bloque.id} className="grid grid-cols-[3.25rem_1fr] gap-3" style={frente ? estiloFrente(frente) : undefined}>
                  <div className="pt-0.5 text-right">
                    <span className={`cifra text-xs ${enCurso ? "font-semibold text-acento" : pasado ? "text-muted/60" : "text-muted"}`}>
                      {minutosAHora(bp.inicio)}
                    </span>
                  </div>
                  <div className={`relative pb-5 pl-4 ${fijo ? "border-l border-borde" : "border-l-2 border-[rgb(var(--fc,var(--c-tinta)))]"}`}>
                    <span
                      className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${enCurso ? "bg-rojo ring-4 ring-rojo/20" : fijo ? "bg-borde" : "bg-[rgb(var(--fc,var(--c-tinta)))]"}`}
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`${fijo ? "text-sm text-muted" : "font-display text-lg font-bold uppercase tracking-tight"} ${pasado && !enCurso ? "opacity-60" : ""}`}>
                        {bp.bloque.label}
                        {enCurso && <span className="ml-2 align-middle font-mono text-[10px] font-semibold tracking-wider text-acento">AHORA</span>}
                      </p>
                      {!fijo && (
                        <span className="cifra shrink-0 text-[11px] text-muted">
                          {bp.usados}/{bp.capacidad} min{bp.flex ? " · libre" : ""}
                        </span>
                      )}
                    </div>
                    {!fijo && bp.tareas.length === 0 && (
                      <p className="mt-1 text-sm text-muted">
                        {bp.flex ? "Libre. Nada pendiente que acomodar." : `Sin pendientes de ${bp.bloque.areas.map((a) => FRENTES[a].corto).join(" y ")}. Adelanta algo o descansa.`}
                      </p>
                    )}
                    {bp.tareas.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {bp.tareas.map((t) => (
                          <FilaTarea key={t.id} t={t} hoy={hoy} />
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {plan.hechasFuera.length > 0 && (
          <div className="mt-2 border-t border-borde pt-4">
            <p className="etiqueta mb-2">También hecho hoy</p>
            <ul className="space-y-2">
              {plan.hechasFuera.map((t) => (
                <FilaTarea key={t.id} t={t} hoy={hoy} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function MetaTarea({ t, hoy }: { t: Tarea; hoy: string }) {
  const vencida = t.due_date !== null && t.due_date < hoy && t.status !== "hecho";
  return (
    <span className="cifra text-[11px] text-muted">
      {t.due_date && <span className={vencida ? "font-semibold text-acento" : ""}>{vencida ? "venció " : ""}{fechaRelativa(t.due_date, hoy)} · </span>}
      {duracion(t.est_minutes)}
      {t.repeat === "weekly" && " · semanal"}
    </span>
  );
}

function FilaTarea({ t, hoy }: { t: Tarea; hoy: string }) {
  const hecha = t.status === "hecho";
  return (
    <li className="flex items-start gap-3">
      <CheckTarea id={t.id} hecha={hecha} titulo={t.title} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={`text-sm leading-snug ${hecha ? "text-muted line-through decoration-rojo decoration-2" : "font-medium"}`}>{t.title}</p>
        {!hecha && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
            <ChipFrente id={t.area} corto />
            <MetaTarea t={t} hoy={hoy} />
            {t.status === "haciendo" && <span className="font-mono text-[10px] uppercase tracking-wider text-acento">En curso</span>}
          </div>
        )}
      </div>
    </li>
  );
}
