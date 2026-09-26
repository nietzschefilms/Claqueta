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
import { IconoAjustes, IconoAvisos } from "@/components/Iconos";
import { EnVivo, type BloqueHoy } from "@/components/claqueta/EnVivo";
import { cargarRutina } from "@/lib/claqueta/datos";
import { diaSemana, fechaCDMX, horaAMinutos } from "@/lib/claqueta/fechas";
import { lugarClase } from "@/lib/claqueta/tipos";
import { prefsDe } from "@/lib/notif-prefs";
import { createClient } from "@/lib/supabase/server";

// Cascarón de la zona privada.
// Celular: barra superior de vidrio y pestañas flotantes abajo.
// Escritorio: columna de vidrio a la izquierda y el contenido con aire.
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await requerirSesion();
  const menu = menuPara(s.rol, s.esSoporte);
  const hoy = fechaCDMX();
  const [noLeidas, rutina, { data: perfil }] = await Promise.all([
    contarNoLeidas(s.userId),
    cargarRutina(),
    (await createClient()).from("perfiles").select("notif_prefs").eq("id", s.userId).maybeSingle()
  ]);
  const prefs = prefsDe(perfil?.notif_prefs);
  const bloquesHoy: BloqueHoy[] = rutina
    .filter((b) => b.weekday === diaSemana(hoy))
    .map((b) => ({ id: b.id, inicio: horaAMinutos(b.start_time), fin: horaAMinutos(b.end_time), label: b.label, lugar: lugarClase(b) }));

  return (
    <div className="min-h-screen">
      <header className="vidrio-fuerte zona-arriba sticky top-0 z-30 rounded-none border-x-0 border-t-0 md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/app" className="flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rojo">
            <Logo className="h-7 w-7" />
            <span className="titulo text-xl">{MARCA.nombreCorto}</span>
          </Link>
          <div className="flex items-center gap-2">
            <BotonTema />
            <Link href="/app/notificaciones" aria-label={noLeidas ? `Avisos, ${noLeidas} sin leer` : "Avisos"} className="vidrio relative grid h-10 w-10 place-items-center rounded-full text-tinta transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
              <IconoAvisos className="h-5 w-5" />
              {noLeidas > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-acento ring-2 ring-fondo" aria-hidden="true" />}
            </Link>
            <Link href="/app/ajustes" aria-label="Ajustes" className="vidrio grid h-10 w-10 place-items-center rounded-full text-tinta transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
              <IconoAjustes className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] md:grid md:grid-cols-[236px_minmax(0,1fr)] md:gap-8 md:px-4 lg:gap-10 lg:pr-8">
        <NavApp items={menu.map(({ href, label }) => ({ href, label }))} noLeidas={noLeidas} usuario={s.nombre || s.email || ""} />
        <main className="min-w-0 px-4 pb-36 pt-5 md:px-0 md:pb-16 md:pt-8">
          <EnVivo hoy={hoy} bloques={bloquesHoy} sonidoAhora={prefs.sonido_ahora} sonidoPrevio={prefs.sonido_previo} sonidoEntrada={prefs.sonido_entrada} />
          {children}
        </main>
      </div>

      <Captura />
      {!s.contrasenaPropia && <ContrasenaObligatoria />}
    </div>
  );
}
