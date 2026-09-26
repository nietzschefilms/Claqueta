import Link from "next/link";
import { requerirSesion } from "@/lib/sesion";
import { menuPara } from "@/lib/menu";
import { contarNoLeidas } from "@/lib/notificaciones";
import { MARCA, ROLES } from "@/config/marca";
import { BotonTema } from "@/components/Tema";
import { NavApp } from "@/components/NavApp";
import { ContrasenaObligatoria } from "@/components/ContrasenaObligatoria";

// Cascarón de la zona privada: barra superior, menú por rol y contenido.
// En celular el menú va abajo (como app); en escritorio, a la izquierda.
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await requerirSesion();
  const menu = menuPara(s.rol, s.esSoporte);
  const noLeidas = await contarNoLeidas(s.userId);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-borde bg-fondo/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/app" className="font-display text-lg font-bold">{MARCA.nombreCorto}</Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline">
              {s.nombre || s.email} · {ROLES[s.rol].label}
            </span>
            <BotonTema />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-28 pt-6 md:grid-cols-[200px_minmax(0,1fr)] md:pb-10">
        <NavApp items={menu.map(({ href, label }) => ({ href, label }))} noLeidas={noLeidas} />
        <main className="min-w-0">{children}</main>
      </div>

      {!s.contrasenaPropia && <ContrasenaObligatoria />}
    </div>
  );
}
