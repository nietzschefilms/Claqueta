"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// En el iPhone (sobre todo en modo app), al cerrar el teclado la vista se
// queda corrida respecto a la página: la barra de abajo flota a media
// pantalla y el encabezado se esconde, y así sigue en las demás páginas.
// Si la vista quedó desfasada y ya no hay nada escribiéndose, se re-alinea
// sin mover lo que la persona está viendo.
const escribiendo = () => {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName));
};

export function ViewportFijo() {
  const ruta = usePathname();

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const realinear = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (escribiendo() || vv.scale > 1.01) return;
        const desfase = vv.offsetTop;
        if (Math.abs(desfase) > 1) window.scrollTo(window.scrollX, window.scrollY + desfase);
      }, 120);
    };
    vv.addEventListener("resize", realinear);
    vv.addEventListener("scroll", realinear);
    document.addEventListener("focusout", realinear);
    window.addEventListener("pageshow", realinear);
    realinear();
    return () => {
      clearTimeout(t);
      vv.removeEventListener("resize", realinear);
      vv.removeEventListener("scroll", realinear);
      document.removeEventListener("focusout", realinear);
      window.removeEventListener("pageshow", realinear);
    };
  }, [ruta]);

  return null;
}
