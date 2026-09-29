import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarPerfil } from "@/lib/claqueta/datos";
import { cargarProspectos, cargarProyectos } from "@/lib/claqueta/datos-estudio";
import { NuevoProyecto } from "./NuevoProyecto";

export const metadata: Metadata = { title: "Proyectos" };

const ESTADO: Record<string, string> = { idea: "Idea", preproduccion: "Preproducción", rodaje: "Rodaje", post: "Post", entregado: "Entregado" };

// PROYECTOS · cada spot, corto o videoclip con su guion, desglose, plan y hoja de llamado.
export default async function Proyectos() {
  const s = await requerirSesion();
  const perfil = await cargarPerfil(s.userId);
  const equipo = perfil.equipos.find((e) => e.frente === "nietzsche") ?? perfil.equipos[0];
  if (!equipo) return null;
  const [proyectos, prospectos] = await Promise.all([cargarProyectos(), cargarProspectos()]);
  const delRadar = prospectos.filter((p) => ["respondio", "reunion", "cotizado", "cerrado"].includes(p.estado)).map((p) => ({ id: p.id, nombre: p.nombre }));

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
      <section aria-label="Proyectos" className="space-y-3 lg:col-span-8">
        {proyectos.length === 0 ? (
          <div className="tarjeta aparecer">
            <h2 className="titulo text-2xl">Sin proyectos aún</h2>
            <p className="mt-2 text-sm text-muted">Crea el primero: se abre el guion en vivo para escribir juntos. Del guion salen solos el desglose, el plan de rodaje y la hoja de llamado.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {proyectos.map((p) => (
              <li key={p.id}>
                <Link href={`/app/estudio/proyectos/${p.id}`} className="vidrio aparecer block rounded-tarjeta p-5 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                  <span className="flex items-center justify-between gap-2">
                    <span className="etiqueta">{p.tipo}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p.estado === "rodaje" ? "bg-rojo text-white" : "bg-tinta/[0.06] text-muted"}`}>{ESTADO[p.estado] ?? p.estado}</span>
                  </span>
                  <span className="titulo mt-2 block text-3xl leading-tight">{p.nombre}</span>
                  {p.cliente && <span className="mt-1 block text-sm text-muted">{p.cliente}</span>}
                  {p.logline && <span className="mt-2 line-clamp-2 block text-sm">{p.logline}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="nuevo" className="tarjeta aparecer lg:col-span-4">
        <h2 id="nuevo" className="titulo text-2xl">Nuevo proyecto</h2>
        <div className="mt-4">
          <NuevoProyecto equipoId={equipo.id} prospectos={delRadar} />
        </div>
      </section>
    </div>
  );
}
