import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarTareas } from "@/lib/claqueta/datos";
import { fechaCDMX, fechaRelativa } from "@/lib/claqueta/fechas";
import { LISTA_FRENTES } from "@/lib/claqueta/frentes";
import { ordenarPorPuntaje, puntaje } from "@/lib/claqueta/prioridad";
import { CheckTarea } from "@/components/claqueta/CheckTarea";
import { TituloEditable } from "@/components/claqueta/EditarTarea";
import { BotonQuitar, SelectorEstado } from "@/components/claqueta/AccionesTarea";
import { AgregarEnColumna } from "@/components/claqueta/AgregarEnColumna";
import { EtiquetaPrioridad, estiloFrente } from "@/components/claqueta/frente-ui";

export const metadata: Metadata = { title: "Tablero" };

// TABLERO · una columna por frente, de lo más urgente a lo menos.
// Celular: carrusel con pastillas para saltar de frente. Escritorio: cuadrícula.
export default async function Tablero() {
  await requerirSesion();
  const hoy = fechaCDMX();
  const tareas = await cargarTareas(hoy);

  const columnas = LISTA_FRENTES.map((f) => {
    const abiertas = ordenarPorPuntaje(tareas.filter((t) => t.area === f.id && t.status !== "hecho"), hoy);
    const hechas = tareas.filter((t) => t.area === f.id && t.status === "hecho" && t.done_at && fechaCDMX(t.done_at) === hoy);
    return { f, abiertas, hechas, minutos: abiertas.reduce((a, t) => a + t.est_minutes, 0) };
  });

  return (
    <div className="space-y-5">
      <header className="aparecer flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta">Por frente · por puntaje</p>
          <h1 className="titulo mt-1 text-6xl md:text-7xl">Tablero</h1>
        </div>
        <p className="cifra text-sm text-muted">
          {columnas.reduce((a, c) => a + c.abiertas.length, 0)} abiertas · {columnas.reduce((a, c) => a + c.hechas.length, 0)} hechas hoy
        </p>
      </header>

      {/* Saltos rápidos entre frentes (celular y tableta). */}
      <nav aria-label="Ir a frente" className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4 xl:hidden">
        {columnas.map(({ f, abiertas }) => (
          <a key={f.id} href={`#col-${f.id}`} style={estiloFrente(f.id)} className="pastilla shrink-0 normal-case tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--fc))]" aria-hidden="true" />
            <span className="font-sans text-xs font-semibold">{f.corto}</span>
            <span className="cifra text-muted">{abiertas.length}</span>
          </a>
        ))}
      </nav>

      <div className="sin-barra -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3">
        {columnas.map(({ f, abiertas, hechas, minutos }) => (
          <section
            key={f.id}
            id={`col-${f.id}`}
            style={estiloFrente(f.id)}
            aria-label={f.nombre}
            className="vidrio relative flex w-[86%] shrink-0 snap-start scroll-mt-24 flex-col overflow-hidden rounded-tarjeta sm:w-[340px] md:w-auto"
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[rgb(var(--fc)/0.2)] to-transparent" aria-hidden="true" />
            <header className="relative flex items-center justify-between gap-2 px-4 pb-3 pt-4">
              <h2 className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[rgb(var(--fc))] ring-4 ring-[rgb(var(--fc)/0.2)]" aria-hidden="true" />
                <span className="titulo text-2xl">{f.nombre}</span>
              </h2>
              <span className="cifra rounded-full bg-superficie/70 px-2.5 py-1 text-[11px] text-muted">
                {abiertas.length} · {Math.round(minutos / 6) / 10} h · ×{f.peso}
              </span>
            </header>

            <ul className="relative flex-1 space-y-2 px-3">
              {abiertas.length === 0 && hechas.length === 0 && <li className="px-1 py-6 text-center text-sm text-muted">Sin pendientes aquí.</li>}
              {abiertas.map((t) => {
                const vencida = t.due_date !== null && t.due_date < hoy;
                return (
                  <li key={t.id} className="space-y-2.5 rounded-2xl bg-superficie/70 p-3 shadow-[0_1px_0_rgb(255_255_255/0.4)_inset,0_4px_14px_-10px_rgb(0_0_0/0.35)]">
                    <div className="flex items-start gap-3">
                      <CheckTarea id={t.id} hecha={false} titulo={t.title} />
                      <TituloEditable t={t} className="flex-1 pt-1 text-sm font-semibold leading-snug" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-10">
                      <EtiquetaPrioridad puntaje={puntaje(t, hoy)} />
                      <span className={`cifra text-[11px] ${vencida ? "font-semibold text-acento" : "text-muted"}`}>
                        {t.due_date ? `${vencida ? "venció " : ""}${fechaRelativa(t.due_date, hoy)}` : "sin fecha"} · {t.est_minutes} min
                        {t.repeat === "weekly" && " · ↻ semanal"}{t.repeat === "daily" && " · ↻ diaria"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-10">
                      <SelectorEstado id={t.id} estado={t.status} />
                      <BotonQuitar id={t.id} />
                    </div>
                  </li>
                );
              })}
              {hechas.map((t) => (
                <li key={t.id} className="flex items-start gap-3 rounded-2xl px-3 py-2">
                  <CheckTarea id={t.id} hecha titulo={t.title} />
                  <p className="flex-1 pt-1 text-sm text-muted line-through decoration-rojo decoration-2">{t.title}</p>
                </li>
              ))}
            </ul>

            <div className="relative p-3">
              <AgregarEnColumna area={f.id} nombre={f.nombre} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
