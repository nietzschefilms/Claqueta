import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { marcarTodasLeidas } from "./acciones";
import { Encabezado } from "@/components/Encabezado";

export const metadata: Metadata = { title: "Avisos" };

const fecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

export default async function Notificaciones() {
  await requerirSesion();
  // Con el cliente de sesión: RLS solo deja ver las propias.
  const supabase = await createClient();
  const { data } = await supabase
    .from("notificaciones")
    .select("id, titulo, cuerpo, href, leido, creado_en")
    .order("creado_en", { ascending: false })
    .limit(100);
  const lista = data ?? [];
  const hayNoLeidas = lista.some((n) => !n.leido);

  return (
    <div className="space-y-5">
      <Encabezado etiqueta="Bandeja" titulo="Avisos">
        {hayNoLeidas && (
          <form action={marcarTodasLeidas}>
            <button className="btn-secundario">Marcar todo como leído</button>
          </form>
        )}
      </Encabezado>

      {lista.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-tinta/[0.06] text-muted" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
          </span>
          <p className="font-semibold">Todo en calma</p>
          <p className="max-w-xs text-sm text-muted">Aquí aparecerá todo lo que te avisemos: lo urgente, lo que vence y el resumen del día.</p>
        </div>
      ) : (
        <ul className="tarjeta divide-y divide-borde/60 overflow-hidden p-0">
          {lista.map((n) => {
            const contenido = (
              <div className="flex gap-3 px-5 py-4">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.leido ? "bg-tinta/10" : "bg-acento shadow-[0_0_0_4px_rgb(var(--c-acento)/0.15)]"}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className={`text-sm ${n.leido ? "" : "font-semibold"}`}>{n.titulo}</p>
                  {n.cuerpo && <p className="text-sm text-muted">{n.cuerpo}</p>}
                  <p className="cifra mt-1 text-[11px] text-muted">{fecha.format(new Date(n.creado_en))}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.href ? <Link href={n.href} className="block transition hover:bg-tinta/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rojo">{contenido}</Link> : contenido}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
