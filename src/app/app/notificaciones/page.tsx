import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { marcarTodasLeidas } from "./acciones";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Avisos</h1>
        {hayNoLeidas && (
          <form action={marcarTodasLeidas}>
            <button className="btn-secundario">Marcar todo como leído</button>
          </form>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="tarjeta text-sm text-muted">No tienes avisos todavía. Aquí aparecerá todo lo que te notifiquemos.</p>
      ) : (
        <ul className="tarjeta divide-y divide-borde p-0">
          {lista.map((n) => {
            const contenido = (
              <div className="flex gap-3 px-5 py-4">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.leido ? "bg-transparent" : "bg-acento"}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className={`text-sm ${n.leido ? "" : "font-semibold"}`}>{n.titulo}</p>
                  {n.cuerpo && <p className="text-sm text-muted">{n.cuerpo}</p>}
                  <p className="mt-1 text-xs text-muted">{fecha.format(new Date(n.creado_en))}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.href ? <Link href={n.href} className="block hover:bg-fondo">{contenido}</Link> : contenido}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
