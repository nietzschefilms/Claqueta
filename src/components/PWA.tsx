"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MARCA } from "@/config/marca";

// Registra el service worker y ofrece instalar la app (una sola vez).
// Heredado de Rompiendo Tabúes: detecta iPhone, Android y escritorio, y avisa
// si en iPhone están fuera de Safari (ahí no se puede instalar).

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferido: BIPEvent | null = null;

const CLAVE_VISTO = "instalar_visto";
// Rutas donde no conviene interrumpir con el aviso.
const SIN_AVISO = ["/entrar", "/recuperar", "/restablecer"];

function esStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function dispositivo(): "ios" | "android" | "escritorio" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "escritorio";
}

function iosFueraDeSafari() {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && /crios|fxios|edgios|gsa|instagram|fban|fbav|line/.test(ua);
}

export function InstalarApp() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [puedeNativo, setPuedeNativo] = useState(false);
  const [disp, setDisp] = useState<"ios" | "android" | "escritorio">("escritorio");
  const [iosOtro, setIosOtro] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (esStandalone()) return;
    setDisp(dispositivo());
    setIosOtro(iosFueraDeSafari());

    const onBIP = (e: Event) => {
      e.preventDefault();
      deferido = e as BIPEvent;
      setPuedeNativo(true);
    };
    const onInstalada = () => {
      setAbierto(false);
      deferido = null;
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalada);

    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!localStorage.getItem(CLAVE_VISTO)) t = setTimeout(() => setAbierto(true), 4000);
    } catch {
      /* sin almacenamiento: no insistimos */
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalada);
      if (t) clearTimeout(t);
    };
  }, []);

  function cerrar() {
    setAbierto(false);
    try {
      localStorage.setItem(CLAVE_VISTO, "1");
    } catch {
      /* noop */
    }
  }

  async function instalar() {
    if (deferido) {
      await deferido.prompt();
      await deferido.userChoice;
      deferido = null;
    }
    cerrar();
  }

  if (!abierto || SIN_AVISO.some((r) => pathname?.startsWith(r))) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="instalar-titulo">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={cerrar} aria-hidden="true" />
      <div className="vidrio-fuerte aparecer relative w-full max-w-md rounded-[2rem] p-6">
        <h2 id="instalar-titulo" className="titulo text-3xl">Instala {MARCA.nombreCorto}</h2>
        <p className="mt-1 text-sm text-muted">Entra con un toque desde tu pantalla de inicio y recibe avisos.</p>
        <div className="mt-4 space-y-2 rounded-2xl bg-tinta/[0.05] p-4 text-sm">
          {disp === "ios" && iosOtro && (
            <>
              <p className="font-semibold">En iPhone solo se instala desde Safari:</p>
              <p>1. Toca el menú y elige <b>Abrir en Safari</b>.</p>
              <p>2. Toca <b>Compartir</b> y luego <b>Agregar a inicio</b>.</p>
            </>
          )}
          {disp === "ios" && !iosOtro && (
            <>
              <p>1. Toca <b>Compartir</b> (el cuadro con la flecha hacia arriba).</p>
              <p>2. Baja y toca <b>Agregar a inicio</b>.</p>
              <p>3. Confirma con <b>Agregar</b>.</p>
            </>
          )}
          {disp !== "ios" && <p>Usa <b>Instalar app</b> aquí abajo o el ícono de instalar del navegador.</p>}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {puedeNativo && (
            <button onClick={instalar} className="btn-primario w-full">Instalar app</button>
          )}
          <button onClick={cerrar} className="btn-secundario w-full">Ahora no</button>
        </div>
      </div>
    </div>
  );
}
