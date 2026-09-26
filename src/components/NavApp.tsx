"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

// Menú de la app. Escritorio: columna lateral. Celular: barra fija abajo.
export function NavApp({ items, noLeidas }: { items: Item[]; noLeidas: number }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/app" ? ruta === "/app" : ruta?.startsWith(href));

  const globo = (href: string) =>
    href === "/app/notificaciones" && noLeidas > 0 ? (
      <span className="ml-auto rounded-full bg-acento px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${noLeidas} sin leer`}>
        {noLeidas > 99 ? "99+" : noLeidas}
      </span>
    ) : null;

  return (
    <>
      <nav aria-label="Menú" className="hidden md:block">
        <ul className="sticky top-20 flex flex-col gap-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={activo(i.href) ? "page" : undefined}
                className={`flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium transition ${
                  activo(i.href) ? "bg-primario text-primario-texto" : "text-tinta hover:bg-superficie"
                }`}
              >
                {i.label}
                {globo(i.href)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav
        aria-label="Menú"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="flex">
          {items.slice(0, 5).map((i) => (
            <li key={i.href} className="flex-1">
              <Link
                href={i.href}
                aria-current={activo(i.href) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold ${
                  activo(i.href) ? "text-primario" : "text-muted"
                }`}
              >
                <span className="flex items-center gap-1">{i.label}{globo(i.href)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
