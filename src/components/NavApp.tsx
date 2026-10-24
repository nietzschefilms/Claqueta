"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MARCA } from "@/config/marca";
import { BotonTema } from "@/components/Tema";
import { Logo } from "@/components/claqueta/Logo";
import { ICONO_MENU, IconoHoy, IconoMas } from "@/components/Iconos";
import { abrirCaptura } from "@/components/claqueta/Captura";

type Item = { href: string; label: string };

// Menú de la app.
// Escritorio: columna de vidrio fija a la izquierda, con la captura arriba.
// Celular: barra flotante abajo con lo de diario (Hoy, Estudio, Semana) y
// "Más" para el resto; el punto rojo a su lado.
const PRINCIPALES = ["/app", "/app/estudio", "/app/semana"];

export function NavApp({ items, noLeidas, usuario }: { items: Item[]; noLeidas: number; usuario: string }) {
  const ruta = usePathname();
  const [mas, setMas] = useState(false);
  useEffect(() => setMas(false), [ruta]);
  const principales = PRINCIPALES.map((h) => items.find((i) => i.href === h)).filter((i): i is Item => !!i);
  const resto = items.filter((i) => !PRINCIPALES.includes(i.href));
  const activo = (href: string) => (href === "/app" ? ruta === "/app" : !!ruta?.startsWith(href));
  const masActivo = resto.some((i) => activo(i.href));
  const icono = (href: string) => ICONO_MENU[href] ?? IconoHoy;

  const globo = (href: string, flotante = false) =>
    href === "/app/notificaciones" && noLeidas > 0 ? (
      <span
        className={`${flotante ? "absolute -right-2 -top-1" : "ml-auto"} min-w-5 rounded-full bg-acento px-1.5 text-center text-[10px] font-bold leading-5 text-white`}
        aria-label={`${noLeidas} sin leer`}
      >
        {noLeidas > 99 ? "99+" : noLeidas}
      </span>
    ) : null;

  return (
    <>
      {/* ── Escritorio ── */}
      <aside className="hidden md:block">
        <div className="vidrio sticky top-4 flex h-[calc(100dvh-2rem)] flex-col rounded-[1.75rem] p-4">
          <Link href="/app" className="flex items-center gap-2.5 rounded-full px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo">
            <Logo className="h-8 w-8" />
            <span className="titulo text-2xl">{MARCA.nombreCorto}</span>
          </Link>

          <button type="button" onClick={abrirCaptura} className="btn-rojo mt-6 w-full justify-between pl-4 pr-2">
            <span className="flex items-center gap-2">
              <IconoMas className="h-4 w-4" />
              Nueva toma
            </span>
            <kbd className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px]">N</kbd>
          </button>

          <nav aria-label="Menú" className="mt-6">
            <ul className="flex flex-col gap-1">
              {items.map((i) => {
                const Icono = icono(i.href);
                const on = activo(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={on ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
                        on ? "bg-tinta text-fondo shadow-[0_8px_20px_-12px_rgb(0_0_0/0.6)]" : "text-muted hover:bg-tinta/5 hover:text-tinta"
                      }`}
                    >
                      <Icono activo={on} className="h-5 w-5" />
                      {i.label}
                      {globo(i.href)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-borde/70 pt-4">
            <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-wider text-muted">{usuario}</p>
            <BotonTema />
          </div>
        </div>
      </aside>

      {/* ── Celular ── */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end gap-2.5 px-3 md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      >
        <nav aria-label="Menú" className="vidrio-fuerte pointer-events-auto flex-1 rounded-full p-1.5">
          <ul className="flex">
            {principales.map((i) => {
              const Icono = icono(i.href);
              const on = activo(i.href);
              return (
                <li key={i.href} className="flex-1">
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rojo ${
                      on ? "bg-tinta/[0.08] text-tinta" : "text-muted"
                    }`}
                  >
                    <span className="relative">
                      <Icono activo={on} className="h-[22px] w-[22px]" />
                      {globo(i.href, true)}
                    </span>
                    {i.label}
                  </Link>
                </li>
              );
            })}
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMas((m) => !m)}
                aria-expanded={mas}
                aria-controls="menu-mas"
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rojo ${
                  mas || masActivo ? "bg-tinta/[0.08] text-tinta" : "text-muted"
                }`}
              >
                <span className="relative">
                  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                  {noLeidas > 0 && <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-acento ring-2 ring-fondo" aria-label={`${noLeidas} avisos sin leer`} />}
                </span>
                Más
              </button>
            </li>
          </ul>
        </nav>
        <button
          type="button"
          onClick={abrirCaptura}
          aria-label="Capturar tarea"
          className="pointer-events-auto grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full bg-rojo text-white shadow-[0_12px_30px_-8px_rgb(255_0_0/0.65),inset_0_1px_0_rgb(255_255_255/0.35)] transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta"
        >
          <IconoMas className="h-7 w-7" />
        </button>
      </div>

      {/* ── Celular: hoja de "Más" ── */}
      {mas && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] md:hidden" onClick={() => setMas(false)} aria-hidden="true" />
      )}
      {mas && (
        <div
          id="menu-mas"
          className="vidrio-fuerte aparecer fixed inset-x-3 z-40 rounded-[1.75rem] p-3 md:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
        >
          <ul className="grid grid-cols-3 gap-2">
            {resto.map((i) => {
              const Icono = icono(i.href);
              const on = activo(i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={on ? "page" : undefined}
                    className={`relative flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
                      on ? "bg-tinta text-fondo" : "bg-tinta/[0.05] text-tinta"
                    }`}
                  >
                    <span className="relative">
                      <Icono activo={on} className="h-6 w-6" />
                      {globo(i.href, true)}
                    </span>
                    {i.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link href="/app/tutorial" className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-tinta/[0.05] text-xs font-semibold text-tinta transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-current text-[11px] font-bold" aria-hidden="true">?</span>
                Recorrido
              </Link>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
