import Link from "next/link";
import { requerirSesion } from "@/lib/sesion";
import { menuPara } from "@/lib/menu";
import { contarNoLeidas } from "@/lib/notificaciones";
import { MARCA } from "@/config/marca";
import { BotonTema } from "@/components/Tema";
import { NavApp } from "@/components/NavApp";
import { ContrasenaObligatoria } from "@/components/ContrasenaObligatoria";
import { Logo } from "@/components/claqueta/Logo";
import { Captura } from "@/components/claqueta/Captura";
import { IconoAjustes } from "@/components/Iconos";

// Cascarón de la zona privada.
// Celular: barra superior de vidrio y pestañas flotantes abajo.
// Escritorio: columna de vidrio a la izquierda y el contenido con aire.
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await requerirSesion();
  const menu = menuPara(s.rol, s.esSoporte);
  const noLeidas = await contarNoLeidas(s.userId);

  return (
    <div className="min-h-screen">
      <header className="vidrio-fuerte sticky top-0 z-30 rounded-none border-x-0 border-t-0 md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/app" className="flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rojo">
            <Logo className="h-7 w-7" />
            <span className="titulo text-xl">{MARCA.nombreCorto}</span>
          </Link>
          <div className="flex items-center gap-2">
            <BotonTema />
            <Link href="/app/ajustes" aria-label="Ajustes" className="vidrio grid h-10 w-10 place-items-center rounded-full text-tinta transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
              <IconoAjustes className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] md:grid md:grid-cols-[236px_minmax(0,1fr)] md:gap-8 md:px-4 lg:gap-10 lg:pr-8">
        <NavApp items={menu.map(({ href, label }) => ({ href, label }))} noLeidas={noLeidas} usuario={s.nombre || s.email || ""} />
        <main className="min-w-0 px-4 pb-36 pt-5 md:px-0 md:pb-16 md:pt-8">{children}</main>
      </div>

      <Captura />
      {!s.contrasenaPropia && <ContrasenaObligatoria />}
    </div>
  );
}
