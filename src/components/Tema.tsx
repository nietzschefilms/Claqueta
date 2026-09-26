"use client";

import { useEffect, useState } from "react";

const CLAVE = "tema";

// Script que corre ANTES de pintar para que no parpadee el tema equivocado.
// Va en el <head> del layout raíz.
export const scriptTema = `try{var t=localStorage.getItem("${CLAVE}");if(t==="oscuro"||t==="claro")document.documentElement.setAttribute("data-tema",t)}catch(e){}`;

// Botón claro / oscuro. Si nunca eligen, se respeta el sistema.
export function BotonTema({ className = "" }: { className?: string }) {
  const [oscuro, setOscuro] = useState<boolean | null>(null);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-tema");
    setOscuro(attr ? attr === "oscuro" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  function alternar() {
    const nuevo = oscuro ? "claro" : "oscuro";
    document.documentElement.setAttribute("data-tema", nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      /* navegador sin almacenamiento: solo dura esta visita */
    }
    setOscuro(!oscuro);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`grid h-10 w-10 place-items-center rounded-full border border-borde bg-superficie text-tinta transition hover:bg-fondo ${className}`}
    >
      {oscuro ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
