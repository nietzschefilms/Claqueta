"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fechaCDMX, minutosAhoraCDMX } from "@/lib/claqueta/fechas";
import { desbloquearAudio, sonarClaqueta, sonarEnSilencio, sonarEntrada, sonarPrevio } from "@/lib/sonido";
import { LogoCargando } from "./Cargando";
import { confirmarSuscripcion, esAppInstalada, pushSoportado, suscribir } from "@/lib/push/cliente";

export type BloqueHoy = { id: string; inicio: number; fin: number; label: string; lugar: string };

const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function yaSono(clave: string) {
  try {
    if (sessionStorage.getItem(clave)) return true;
    sessionStorage.setItem(clave, "1");
  } catch {
    /* sin almacenamiento: puede repetirse, no pasa nada grave */
  }
  return false;
}

function yaMarcado(clave: string) {
  try {
    return !!sessionStorage.getItem(clave);
  } catch {
    return false;
  }
}

// iPhone y iPad (los iPad nuevos dicen ser Mac, pero tienen pantalla táctil).
const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

type Portada = "decidiendo" | "tocar" | "saliendo" | null;

// Con la app abierta: al cambiar de bloque suena la claqueta y aparece el aviso
// arriba; 5 min antes, un aviso suave. Además vigila que las notificaciones de
// este dispositivo estén activas y, si no, ofrece activarlas.
export function EnVivo({ hoy, bloques, sonidoAhora, sonidoPrevio, sonidoEntrada, enSilencio }: { hoy: string; bloques: BloqueHoy[]; sonidoAhora: boolean; sonidoPrevio: boolean; sonidoEntrada: boolean; enSilencio: boolean }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<{ titulo: string; cuerpo: string; ahora: boolean } | null>(null);
  const [faltaPush, setFaltaPush] = useState(false);
  const [activando, setActivando] = useState(false);
  const cierre = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Portada de entrada: en iPhone el sonido necesita un toque, así que la app
  // abre con el logo y "Toca para entrar". En la Mac suena sola al cargar.
  const [portada, setPortada] = useState<Portada>(sonidoEntrada ? "decidiendo" : null);
  const portadaActiva = useRef(sonidoEntrada);

  useEffect(() => sonarEnSilencio(enSilencio), [enSilencio]);

  const quitarPortada = () => {
    setPortada("saliendo");
    setTimeout(() => {
      portadaActiva.current = false;
      setPortada(null);
    }, 550);
  };

  useEffect(() => {
    if (!sonidoEntrada || yaMarcado("envivo:entrada")) {
      portadaActiva.current = false;
      setPortada(null);
      return;
    }
    if (esIOS()) {
      setPortada("tocar");
      return;
    }
    // Mac y demás: intenta sonar sola. Si el navegador no deja, no suena (nunca
    // al tocar un botón).
    yaSono("envivo:entrada");
    sonarEntrada();
    quitarPortada();
    // Solo al abrir la app.
  }, []);

  const entrar = () => {
    if (portada !== "tocar") return;
    yaSono("envivo:entrada");
    sonarEntrada();
    desbloquearAudio("entrada");
    quitarPortada();
  };

  // iOS: el audio se habilita con el primer toque. Ese toque "abre" los sonidos
  // en silencio para que luego suenen solos (cambio de bloque, toma guardada).
  useEffect(() => {
    // iOS solo habilita el audio al TERMINAR el toque (touchend/click), no al empezarlo.
    let hecho = false;
    const una = () => {
      if (hecho || portadaActiva.current) return;
      hecho = true;
      desbloquearAudio();
    };
    window.addEventListener("touchend", una, { passive: true });
    window.addEventListener("click", una);
    window.addEventListener("keydown", una);
    return () => {
      window.removeEventListener("touchend", una);
      window.removeEventListener("click", una);
      window.removeEventListener("keydown", una);
    };
  }, []);

  // ¿Este dispositivo recibe avisos? Si la app está instalada y no, se ofrece activarlos.
  useEffect(() => {
    if (!pushSoportado() || !esAppInstalada()) return;
    confirmarSuscripcion()
      .then((ok) => setFaltaPush(!ok && Notification.permission !== "denied"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const revisar = () => {
      if (fechaCDMX() !== hoy) return router.refresh();
      const ahora = minutosAhoraCDMX();
      for (const b of bloques) {
        const faltan = b.inicio - ahora;
        if (faltan > 0 && faltan <= 5 && !yaSono(`envivo:${hoy}:${b.id}:antes`)) {
          if (sonidoPrevio) sonarPrevio();
          mostrar({ titulo: `En ${faltan} min: ${b.label}`, cuerpo: [b.lugar, `${hora(b.inicio)} a ${hora(b.fin)}`].filter(Boolean).join(" · "), ahora: false });
        }
        if (faltan <= 0 && faltan > -2 && !yaSono(`envivo:${hoy}:${b.id}:ahora`)) {
          if (sonidoAhora) sonarClaqueta();
          mostrar({ titulo: `Ahora: ${b.label}`, cuerpo: [b.lugar, `Hasta las ${hora(b.fin)}`].filter(Boolean).join(" · "), ahora: true });
          router.refresh();
        }
      }
    };
    const mostrar = (a: { titulo: string; cuerpo: string; ahora: boolean }) => {
      setAviso(a);
      if (cierre.current) clearTimeout(cierre.current);
      cierre.current = setTimeout(() => setAviso(null), 8000);
    };
    revisar();
    const iv = setInterval(revisar, 10_000);
    return () => clearInterval(iv);
  }, [hoy, bloques, sonidoAhora, sonidoPrevio, router]);

  return (
    <>
      {portada && (
        <button
          type="button"
          onClick={entrar}
          autoFocus
          aria-label="Entrar a Claqueta"
          className={`portada fixed inset-0 z-[100] grid place-items-center bg-fondo text-tinta outline-none ${portada === "saliendo" ? "portada-sale" : ""}`}
        >
          <span className="flex flex-col items-center gap-5">
            {portada === "decidiendo" ? (
              <LogoCargando />
            ) : (
              <svg viewBox="0 0 100 100" className="h-16 w-16" aria-hidden="true">
                <path d="M50 12 A 38 38 0 1 0 81.1 28.2" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
                <circle className="portada-punto" cx="64.7" cy="19.3" r="7.2" fill="rgb(var(--c-rojo))" />
              </svg>
            )}
            <span className="titulo text-4xl">
              Claqueta<span className="text-rojo">.</span>
            </span>
            <span className={`etiqueta ${portada === "tocar" ? "portada-toca" : "invisible"}`}>Toca para entrar</span>
          </span>
        </button>
      )}

      {aviso && (
        <button
          type="button"
          onClick={() => setAviso(null)}
          role="status"
          aria-live="assertive"
          className="vidrio-fuerte aparecer fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-3xl px-4 py-3 text-left md:right-6 md:left-auto md:mx-0"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <span className={`h-3 w-3 shrink-0 rounded-full ${aviso.ahora ? "latido bg-rojo" : "bg-tinta/30"}`} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{aviso.titulo}</span>
            {aviso.cuerpo && <span className="cifra block truncate text-xs text-muted">{aviso.cuerpo}</span>}
          </span>
        </button>
      )}

      {faltaPush && (
        <div className="vidrio aparecer mb-5 flex items-center gap-3 rounded-3xl p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rojo/15 text-acento" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Tus avisos están apagados en este iPhone</p>
            <p className="text-xs text-muted">Actívalos para que te lleguen clases, bloques y cobros.</p>
          </div>
          <button
            type="button"
            disabled={activando}
            onClick={async () => {
              setActivando(true);
              try {
                const r = await suscribir();
                setFaltaPush(r !== "activo");
              } catch {
                /* se queda el aviso para reintentar */
              } finally {
                setActivando(false);
              }
            }}
            className="btn-rojo shrink-0 px-4"
          >
            {activando ? "…" : "Activar"}
          </button>
        </div>
      )}
    </>
  );
}
