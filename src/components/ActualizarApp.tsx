"use client";

import { useEffect } from "react";

// Mantiene la app al día SIN molestar: revisa si hay versión nueva y prepara el
// service worker nuevo en segundo plano, para que entre solo en el próximo
// arranque. No muestra popup ni banner al entrar, y no recarga de golpe (eso
// interrumpe). Si alguien quiere traer lo último al instante, está el botón
// "Actualizar la app" en Ajustes.
export function ActualizarApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;

    const prepararSiguiente = (sw: ServiceWorker | null) => {
      // Deja listo el worker nuevo para que tome control en el próximo arranque,
      // sin recargar la sesión actual.
      if (sw) sw.postMessage({ type: "SKIP_WAITING" });
    };

    navigator.serviceWorker.getRegistration().then((r) => {
      reg = r || null;
      if (!reg) return;
      if (reg.waiting) prepararSiguiente(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nuevo = reg!.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed") prepararSiguiente(nuevo);
        });
      });
    });

    const revisar = () => {
      if (reg) reg.update().catch(() => {});
    };
    const iv = setInterval(revisar, 60000);
    const alFoco = () => {
      if (document.visibilityState === "visible") revisar();
    };
    document.addEventListener("visibilitychange", alFoco);
    window.addEventListener("focus", revisar);

    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", alFoco);
      window.removeEventListener("focus", revisar);
    };
  }, []);

  return null;
}
