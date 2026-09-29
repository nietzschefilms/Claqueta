import { requerirSesion } from "@/lib/sesion";
import { cargarPerfil } from "@/lib/claqueta/datos";
import { Pestanas } from "./Pestanas";

// ESTUDIO · lo que comparte el equipo Nietzsche: agenda, Radar y proyectos.
export default async function LayoutEstudio({ children }: { children: React.ReactNode }) {
  const s = await requerirSesion();
  const perfil = await cargarPerfil(s.userId);
  const equipo = perfil.equipos.find((e) => e.frente === "nietzsche") ?? perfil.equipos[0];

  if (!equipo)
    return (
      <div className="tarjeta aparecer mx-auto max-w-lg text-center">
        <h1 className="titulo text-4xl">Estudio</h1>
        <p className="mt-3 text-sm text-muted">Aún no estás en un equipo. Pídele a soporte que te agregue a Nietzsche Studios.</p>
      </div>
    );

  const personas = [{ id: s.userId, nombre: perfil.nombre || s.nombre || "Tú" }, ...perfil.companeros.filter((c) => c.equipo_id === equipo.id)];
  return (
    <div className="space-y-6">
      <header className="aparecer flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="etiqueta flex items-center gap-2 text-tinta">
            <span className="h-1.5 w-1.5 rounded-full bg-rojo" aria-hidden="true" />
            {equipo.nombre}
          </p>
          <h1 className="titulo mt-1 text-6xl md:text-7xl">Estudio</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <span className="flex -space-x-2" aria-hidden="true">
              {personas.map((p, i) => (
                <span key={p.id} className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ring-2 ring-fondo ${i === 0 ? "bg-tinta text-fondo" : "bg-f-nietzsche text-white"}`}>
                  {p.nombre.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </span>
            {personas.map((p, i) => (i === 0 ? "Tú" : p.nombre.split(" ")[0])).join(" y ")}
          </p>
        </div>
        <Pestanas />
      </header>
      {children}
    </div>
  );
}
