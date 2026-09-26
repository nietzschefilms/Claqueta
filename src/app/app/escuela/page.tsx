import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarRutina, cargarTareas } from "@/lib/claqueta/datos";
import { diaSemana, fechaCDMX, fechaRelativa, horaAMinutos, sumarDias } from "@/lib/claqueta/fechas";
import { ordenarPorPuntaje, puntaje } from "@/lib/claqueta/prioridad";
import { CheckTarea } from "@/components/claqueta/CheckTarea";
import { TituloEditable } from "@/components/claqueta/EditarTarea";
import { BotonQuitar } from "@/components/claqueta/AccionesTarea";
import { EtiquetaPrioridad, estiloFrente } from "@/components/claqueta/frente-ui";
import { Encabezado } from "@/components/Encabezado";
import { FormEscuela } from "./FormEscuela";
import { EditarPiso } from "./EditarPiso";
import { esClase } from "@/lib/claqueta/tipos";
import { minutosAHora } from "@/lib/claqueta/fechas";

export const metadata: Metadata = { title: "Escuela" };

const NOMBRE_DIF = { 1: "Fácil", 2: "Media", 3: "Difícil" } as const;
const horas = (min: number) => (min < 60 ? `${min} min` : `${Math.round(min / 6) / 10} h`);

// ESCUELA · tareas de clase con materia, dificultad y fecha. El orden lo decide Claqueta.
export default async function Escuela() {
  await requerirSesion();
  const hoy = fechaCDMX();
  const [tareas, rutina] = await Promise.all([cargarTareas(hoy), cargarRutina()]);

  // Materias: salen del horario (bloques de clase).
  const clases = rutina.filter(esClase).sort((a, b) => a.weekday - b.weekday || horaAMinutos(a.start_time) - horaAMinutos(b.start_time));
  const materias = [...new Set(clases.map((b) => b.label))];
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const diasConClase = [...new Set(clases.map((c) => c.weekday))];
  const hoyDia = diaSemana(hoy);
  const escuela = tareas.filter((t) => t.area === "escuela");
  const pendientes = ordenarPorPuntaje(escuela.filter((t) => t.status !== "hecho"), hoy);
  const hechas = escuela.filter((t) => t.status === "hecho");

  // ¿Cabe? Minutos de bloques de escuela en los próximos 7 días vs. lo pendiente para esos días.
  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i));
  const tiempoTarea = semana.reduce(
    (a, d) =>
      a +
      rutina
        .filter((b) => b.weekday === diaSemana(d) && b.kind === "focus" && b.areas.includes("escuela"))
        .reduce((x, b) => x + horaAMinutos(b.end_time) - horaAMinutos(b.start_time), 0),
    0
  );
  const cargaSemana = pendientes.filter((t) => t.due_date && t.due_date <= semana[6]).reduce((a, t) => a + t.est_minutes, 0);
  const cabe = cargaSemana <= tiempoTarea;

  return (
    <div className="space-y-6" style={estiloFrente("escuela")}>
      <Encabezado etiqueta="Escuela Superior de Cine · 18ª-2" titulo="Escuela" />

      <section aria-label="Carga de la semana" className="vidrio aparecer relative overflow-hidden rounded-tarjeta p-5 md:p-6">
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[rgb(var(--fc)/0.25)] blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-4 sm:grid-cols-3">
          <div>
            <p className="etiqueta">Pendientes</p>
            <p className="cifra mt-1 text-3xl font-semibold">{pendientes.length}</p>
          </div>
          <div>
            <p className="etiqueta">Para esta semana</p>
            <p className="cifra mt-1 text-3xl font-semibold">{horas(cargaSemana)}</p>
          </div>
          <div>
            <p className="etiqueta">Tiempo de tarea en tu rutina</p>
            <p className={`cifra mt-1 text-3xl font-semibold ${cabe ? "" : "text-acento"}`}>{horas(tiempoTarea)}</p>
          </div>
        </div>
        <p className="relative mt-3 text-sm text-muted">
          {cabe
            ? "Te alcanza con tus bloques de Tarea. Claqueta acomoda primero lo que vence antes y lo más difícil."
            : "No te alcanza con tus bloques de Tarea: usa las mañanas libres (miércoles y viernes) o los huecos entre clases."}
        </p>
      </section>

      {/* ── Horario de clases ── */}
      {clases.length > 0 && (
        <section aria-labelledby="horario" className="tarjeta aparecer p-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-5">
            <h2 id="horario" className="titulo text-2xl">Horario de clases</h2>
            <span className="etiqueta">1er trimestre · 28 sep – 4 dic</span>
          </div>
          <div className="grid gap-px bg-borde/40 sm:grid-cols-2 xl:grid-cols-5">
            {diasConClase.map((d) => (
              <div key={d} className={`bg-superficie/60 p-4 ${d === hoyDia ? "ring-2 ring-inset ring-rojo/40" : ""}`}>
                <p className="flex items-center gap-2">
                  {d === hoyDia && <span className="h-2 w-2 rounded-full bg-rojo" aria-label="Hoy" />}
                  <span className="titulo text-xl">{DIAS[d]}</span>
                </p>
                <ul className="mt-3 space-y-3">
                  {clases
                    .filter((c) => c.weekday === d)
                    .map((c) => (
                      <li key={c.id} className="rounded-2xl border border-[rgb(var(--fc)/0.25)] bg-[rgb(var(--fc)/0.07)] p-3">
                        <p className="cifra text-[11px] text-muted">
                          {minutosAHora(horaAMinutos(c.start_time))} – {minutosAHora(horaAMinutos(c.end_time))}
                          {c.clave ? ` · ${c.clave}` : ""}
                        </p>
                        <p className="mt-0.5 font-semibold leading-snug">{c.label}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-[rgb(var(--fc))]">{c.salon}</span>
                          <EditarPiso salon={c.salon!} piso={c.piso ?? null} />
                        </div>
                        {c.profesor && <p className="mt-1 text-xs text-muted">{c.profesor}</p>}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="px-5 py-3 text-xs text-muted">Te llega un aviso 5 minutos antes de cada clase con el salón y el piso, y otro cuando empieza.</p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <section aria-labelledby="nueva" className="tarjeta aparecer min-w-0 lg:col-span-5">
          <h2 id="nueva" className="titulo mb-4 text-2xl">Nueva tarea</h2>
          <FormEscuela materias={materias.length ? materias : ["General"]} />
        </section>

        <section aria-labelledby="lista" className="tarjeta aparecer min-w-0 p-0 lg:col-span-7">
          <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
            <h2 id="lista" className="titulo text-2xl">En este orden</h2>
            <span className="etiqueta">Prioridad automática</span>
          </div>
          {pendientes.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Nada pendiente de la escuela. Agrega lo que te dejen.</p>
          ) : (
            <ol className="divide-y divide-borde/60">
              {pendientes.map((t, i) => {
                const vencida = t.due_date !== null && t.due_date < hoy;
                return (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-4">
                    <span className="cifra w-6 shrink-0 pt-1 text-lg font-medium leading-none text-muted/40">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <TituloEditable t={t} className="block font-semibold leading-snug" />
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {t.materia && <span className="rounded-full bg-[rgb(var(--fc)/0.14)] px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--fc))]">{t.materia}</span>}
                        {t.dificultad && <span className="rounded-full bg-tinta/[0.06] px-2 py-0.5 text-[11px] font-medium">{NOMBRE_DIF[t.dificultad]}</span>}
                        <EtiquetaPrioridad puntaje={puntaje(t, hoy)} />
                        <span className={`cifra text-[11px] ${vencida ? "font-semibold text-acento" : "text-muted"}`}>
                          {t.due_date ? `${vencida ? "venció " : "entrega "}${fechaRelativa(t.due_date, hoy)}` : "sin fecha"} · {horas(t.est_minutes)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <CheckTarea id={t.id} hecha={false} titulo={t.title} />
                      <BotonQuitar id={t.id} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {hechas.length > 0 && (
            <ul className="border-t border-borde/60 px-5 py-3">
              {hechas.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-1.5">
                  <CheckTarea id={t.id} hecha titulo={t.title} />
                  <span className="text-sm text-muted line-through decoration-rojo decoration-2">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
