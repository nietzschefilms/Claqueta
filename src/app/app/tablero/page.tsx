import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarTareas } from "@/lib/claqueta/datos";
import { fechaCDMX, fechaRelativa } from "@/lib/claqueta/fechas";
import { LISTA_FRENTES } from "@/lib/claqueta/frentes";
import { ordenarPorPuntaje, puntaje } from "@/lib/claqueta/prioridad";
import { CheckTarea } from "@/components/claqueta/CheckTarea";
import { BotonQuitar, SelectorEstado } from "@/components/claqueta/AccionesTarea";
import { AgregarEnColumna } from "@/components/claqueta/AgregarEnColumna";
import { EtiquetaPrioridad, estiloFrente } from "@/components/claqueta/frente-ui";

export const metadata: Metadata = { title: "Tablero" };

// TABLERO · una columna por frente, de lo más urgente a lo menos.
export default async function Tablero() {
  await requerirSesion();
  const hoy = fechaCDMX();
  const tareas = await cargarTareas(hoy);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 border-b border-tinta pb-2">
        <h1 className="titulo text-5xl">Tablero</h1>
        <p className="etiqueta hidden sm:block">Por frente · por puntaje</p>
      </header>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 xl:grid xl:grid-cols-3 xl:overflow-visible">
        {LISTA_FRENTES.map((f) => {
          const abiertas = ordenarPorPuntaje(tareas.filter((t) => t.area === f.id && t.status !== "hecho"), hoy);
          const hechas = tareas.filter((t) => t.area === f.id && t.status === "hecho" && t.done_at && fechaCDMX(t.done_at) === hoy);
          const minutos = abiertas.reduce((a, t) => a + t.est_minutes, 0);
          return (
            <section key={f.id} style={estiloFrente(f.id)} aria-label={f.nombre} className="flex w-[85%] shrink-0 snap-start flex-col border-t-4 border-[rgb(var(--fc))] bg-superficie sm:w-80 xl:w-auto">
              <header className="flex items-baseline justify-between gap-2 border-b border-borde px-3 py-2.5">
                <h2 className="font-display text-lg font-bold uppercase tracking-tight">{f.nombre}</h2>
                <span className="cifra text-[11px] text-muted">
                  {abiertas.length} · {Math.round(minutos / 6) / 10} h · ×{f.peso}
                </span>
              </header>

              <ul className="flex-1 divide-y divide-borde">
                {abiertas.length === 0 && <li className="px-3 py-4 text-sm text-muted">Sin pendientes aquí.</li>}
                {abiertas.map((t) => {
                  const p = puntaje(t, hoy);
                  const vencida = t.due_date !== null && t.due_date < hoy;
                  return (
                    <li key={t.id} className="space-y-2 px-3 py-3">
                      <div className="flex items-start gap-2.5">
                        <CheckTarea id={t.id} hecha={false} titulo={t.title} />
                        <p className="flex-1 pt-0.5 text-sm font-medium leading-snug">{t.title}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-8">
                        <EtiquetaPrioridad puntaje={p} />
                        <span className={`cifra text-[11px] ${vencida ? "font-semibold text-acento" : "text-muted"}`}>
                          {t.due_date ? `${vencida ? "venció " : ""}${fechaRelativa(t.due_date, hoy)}` : "sin fecha"} · {t.est_minutes} min
                          {t.repeat === "weekly" && " · ↻"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-8">
                        <SelectorEstado id={t.id} estado={t.status} />
                        <BotonQuitar id={t.id} />
                      </div>
                    </li>
                  );
                })}
                {hechas.map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5 px-3 py-2.5">
                    <CheckTarea id={t.id} hecha titulo={t.title} />
                    <p className="flex-1 pt-0.5 text-sm text-muted line-through decoration-rojo decoration-2">{t.title}</p>
                  </li>
                ))}
              </ul>

              <div className="border-t border-borde p-3">
                <AgregarEnColumna area={f.id} nombre={f.nombre} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
