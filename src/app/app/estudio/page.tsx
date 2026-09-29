import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarPerfil, cargarTareas } from "@/lib/claqueta/datos";
import { cargarEventos, cargarOcupado, cargarProspectos } from "@/lib/claqueta/datos-estudio";
import { fechaCDMX, fechaRelativa, minutosAhoraCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { AgendaEquipo } from "./Agenda";

export const metadata: Metadata = { title: "Estudio" };

export default async function Estudio() {
  const s = await requerirSesion();
  const hoy = fechaCDMX();
  const perfil = await cargarPerfil(s.userId);
  const equipo = perfil.equipos.find((e) => e.frente === "nietzsche") ?? perfil.equipos[0];
  if (!equipo) return null;
  const [eventos, ocupados, prospectos, tareas] = await Promise.all([
    cargarEventos(hoy, sumarDias(hoy, 45)),
    cargarOcupado(equipo.id, hoy, 7),
    cargarProspectos(),
    cargarTareas(hoy)
  ]);
  const miembros = [{ id: s.userId, nombre: perfil.nombre || s.nombre || "Tú" }, ...perfil.companeros.filter((c) => c.equipo_id === equipo.id)];
  const nombre = (id: string | null) => (id === s.userId ? "Tú" : miembros.find((m) => m.id === id)?.nombre.split(" ")[0] ?? "Los dos");

  const seguimientos = prospectos.filter((p) => p.siguiente_fecha && p.siguiente_fecha <= sumarDias(hoy, 2) && !["cerrado", "descartado"].includes(p.estado));
  const enJuego = prospectos.filter((p) => ["contactado", "respondio", "reunion", "cotizado"].includes(p.estado)).length;
  const cerrados = prospectos.filter((p) => p.estado === "cerrado").length;
  const delEquipo = tareas.filter((t) => t.equipo_id === equipo.id && t.status !== "hecho").slice(0, 8);

  return (
    <div className="space-y-6">
      <AgendaEquipo equipoId={equipo.id} eventos={eventos.filter((e) => e.equipo_id === equipo.id)} ocupados={ocupados} miembros={miembros} yo={s.userId} hoy={hoy} ahora={minutosAhoraCDMX()} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="radar-res" className="tarjeta aparecer">
          <div className="flex items-baseline justify-between">
            <h2 id="radar-res" className="titulo text-2xl">Radar</h2>
            <Link href="/app/estudio/radar" className="enlace-mono">Abrir →</Link>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-tinta/[0.05] p-3"><dt className="etiqueta">Prospectos</dt><dd className="cifra mt-1 text-2xl font-semibold">{prospectos.length}</dd></div>
            <div className="rounded-2xl bg-aviso/10 p-3"><dt className="etiqueta">En juego</dt><dd className="cifra mt-1 text-2xl font-semibold">{enJuego}</dd></div>
            <div className="rounded-2xl bg-ok/10 p-3"><dt className="etiqueta">Cerrados</dt><dd className="cifra mt-1 text-2xl font-semibold">{cerrados}</dd></div>
          </dl>
          {seguimientos.length > 0 && (
            <ul className="mt-4 space-y-2">
              {seguimientos.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate"><span className="font-semibold">{p.nombre}</span> · {p.siguiente_paso ?? "seguimiento"}</span>
                  <span className={`cifra shrink-0 text-xs ${p.siguiente_fecha! <= hoy ? "font-semibold text-acento" : "text-muted"}`}>{fechaRelativa(p.siguiente_fecha!, hoy)} · {nombre(p.responsable)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="tareas-eq" className="tarjeta aparecer">
          <div className="flex items-baseline justify-between">
            <h2 id="tareas-eq" className="titulo text-2xl">Tareas del equipo</h2>
            <Link href="/app/tablero#col-nietzsche" className="enlace-mono">Tablero →</Link>
          </div>
          {delEquipo.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nada pendiente. Captura con el punto rojo en Nietzsche y elige para quién.</p>
          ) : (
            <ul className="mt-3 divide-y divide-borde/60">
              {delEquipo.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="cifra shrink-0 text-xs text-muted">{nombre(t.asignada_a ?? null)}{t.due_date ? ` · ${fechaRelativa(t.due_date, hoy)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
