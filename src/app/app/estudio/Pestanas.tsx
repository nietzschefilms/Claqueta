"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/app/estudio", t: "Agenda" },
  { href: "/app/estudio/radar", t: "Radar" },
  { href: "/app/estudio/proyectos", t: "Proyectos" }
];

export function Pestanas() {
  const ruta = usePathname();
  return (
    <nav aria-label="Estudio" className="vidrio inline-flex rounded-full p-1">
      {PESTANAS.map((p) => {
        const on = p.href === "/app/estudio" ? ruta === p.href : ruta.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${on ? "bg-tinta text-fondo" : "text-muted hover:text-tinta"}`}
          >
            {p.t}
          </Link>
        );
      })}
    </nav>
  );
}
