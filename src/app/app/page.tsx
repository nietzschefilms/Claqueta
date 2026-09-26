import Link from "next/link";
import { requerirSesion } from "@/lib/sesion";
import { ROLES } from "@/config/marca";

// Inicio de la app. Cada cliente lo reemplaza con su pantalla principal
// (ej. EK Bars: próximas clases; un admin: el resumen del día).
export default async function Inicio() {
  const s = await requerirSesion();
  const nombre = s.nombre.split(" ")[0] || "hola";

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta">{ROLES[s.rol].label}</p>
        <h1 className="mt-1 text-balance font-display text-3xl font-bold">Hola, {nombre}</h1>
      </div>

      <section className="tarjeta">
        <h2 className="font-display text-lg font-semibold">Plantilla lista</h2>
        <p className="mt-1 text-sm text-muted">
          Esta es la pantalla de inicio de la base. Aquí va lo primero que cada rol necesita ver al abrir la app.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/app/ajustes" className="btn-secundario">Activar notificaciones</Link>
          {s.esSoporte && <Link href="/app/soporte" className="btn-secundario">Crear cuentas</Link>}
        </div>
      </section>
    </div>
  );
}
