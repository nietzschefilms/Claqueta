"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { confirmarMiLlamado, editarAvance } from "./estudio/proyectos/[id]/acciones-equipo";

export type MiLlamado = { id: string; proyecto_id: string; proyecto: string; rol: string; fecha: string; llamado: string | null; confirmacion: string };
export type MiPendiente = { id: string; proyecto_id: string; proyecto: string; titulo: string; estado: "falta" | "en_proceso"; fecha_limite: string | null };

const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// HOY · lo de los proyectos que es tuyo: tu próximo llamado y lo que te toca.
export function DeProduccion({ llamados, pendientes, hoy }: { llamados: MiLlamado[]; pendientes: MiPendiente[]; hoy: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await f();
      if (!r.ok) setError(r.error ?? "No se pudo.");
    });
  if (!llamados.length && !pendientes.length) return null;
  const l = llamados[0];

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {error && <p className="alerta-error lg:col-span-12" role="alert">{error}</p>}
      {l && (
        <section className="relative overflow-hidden rounded-tarjeta bg-tinta p-5 text-fondo lg:col-span-5" aria-labelledby="mi-llamado">
          <span className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-rojo/30 blur-3xl" aria-hidden="true" />
          <p id="mi-llamado" className="etiqueta relative flex items-center gap-2 text-fondo/70">
            <span className="h-1.5 w-1.5 rounded-full bg-rojo" aria-hidden="true" /> Tu próximo llamado
          </p>
          <p className="cifra relative mt-2 text-5xl font-semibold leading-none">{l.llamado?.slice(0, 5) ?? "--:--"}</p>
          <p className="titulo relative mt-2 text-3xl leading-none">{l.proyecto}</p>
          <p className="relative mt-1 text-sm capitalize text-fondo/70">
            {l.fecha === hoy ? "Hoy" : fechaCorta(l.fecha)} · {l.rol}
          </p>
          <div className="relative mt-4 flex flex-wrap gap-2">
            {l.confirmacion === "confirmado" ? (
              <span className="rounded-full bg-ok px-4 py-2.5 text-sm font-semibold text-white">✓ Confirmado</span>
            ) : (
              <>
                <button type="button" disabled={pendiente} onClick={() => correr(() => confirmarMiLlamado(l.proyecto_id, l.id, "confirmado"))} className="rounded-full bg-rojo px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95">
                  Confirmo
                </button>
                <button type="button" disabled={pendiente} onClick={() => correr(() => confirmarMiLlamado(l.proyecto_id, l.id, "no_puede"))} className="rounded-full bg-fondo/10 px-4 py-2.5 text-sm font-semibold transition active:scale-95">
                  No puedo
                </button>
              </>
            )}
            <Link href={`/app/estudio/proyectos/${l.proyecto_id}?v=llamado`} className="rounded-full bg-fondo/10 px-4 py-2.5 text-sm font-semibold">
              Hoja de llamado
            </Link>
          </div>
          {llamados.length > 1 && <p className="relative mt-3 text-xs text-fondo/60">Y {llamados.length - 1} llamado{llamados.length > 2 ? "s" : ""} más después.</p>}
        </section>
      )}
      {pendientes.length > 0 && (
        <section className={`tarjeta p-0 ${l ? "lg:col-span-7" : "lg:col-span-12"}`} aria-labelledby="te-toca">
          <header className="flex items-baseline justify-between px-5 pb-1 pt-5">
            <h2 id="te-toca" className="titulo text-2xl">Te toca en producción</h2>
            <span className="cifra text-xs text-muted">{pendientes.length}</span>
          </header>
          <p className="px-5 text-xs text-muted">Toca el círculo para avanzar: Falta → En proceso → Listo.</p>
          <ul className="mt-1 divide-y divide-borde/60">
            {pendientes.slice(0, 6).map((p) => {
              const sig = p.estado === "falta" ? "en_proceso" : "listo";
              const vencido = p.fecha_limite && p.fecha_limite < hoy;
              return (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => correr(() => editarAvance(p.proyecto_id, p.id, { estado: sig }))}
                    aria-label={`${p.titulo}: ${p.estado === "falta" ? "Falta" : "En proceso"}. Toca para avanzar.`}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo ${p.estado === "en_proceso" ? "border-aviso" : "border-rojo"}`}
                  >
                    {p.estado === "en_proceso" && <span className="h-3.5 w-3.5 rounded-full bg-aviso" />}
                  </button>
                  <Link href={`/app/estudio/proyectos/${p.proyecto_id}`} className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                    <span className="block truncate font-semibold leading-tight">{p.titulo}</span>
                    <span className="block truncate text-xs text-muted">{p.proyecto}</span>
                  </Link>
                  {p.fecha_limite && <span className={`cifra shrink-0 text-xs capitalize ${vencido ? "font-semibold text-rojo" : "text-muted"}`}>{vencido ? "Vencido" : fechaCorta(p.fecha_limite)}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
