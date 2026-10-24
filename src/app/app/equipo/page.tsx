import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Encabezado } from "@/components/Encabezado";
import { Avatar } from "@/components/Avatar";
import { nombrePuesto } from "@/lib/claqueta/puestos";

export const metadata: Metadata = { title: "Equipo" };

// EQUIPO · quién es quién en Nietzsche Studios.
export default async function Equipo() {
  const s = await requerirSesion();
  const { data } = await (await createClient()).rpc("directorio_equipo");
  const gente = (data ?? []) as { id: string; nombre: string; color: string | null; avatar: string | null; bio: string | null; puestos: string[] }[];
  return (
    <div className="space-y-5">
      <Encabezado etiqueta="Nietzsche Studios" titulo="Equipo" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {gente.map((p) => (
          <li key={p.id}>
            <Link href={`/app/equipo/${p.id}`} className="tarjeta aparecer flex h-full items-start gap-4 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
              <Avatar nombre={p.nombre} color={p.color} avatar={p.avatar} tam="h-14 w-14 text-xl" />
              <span className="min-w-0">
                <span className="titulo block text-2xl leading-tight">{p.nombre}{p.id === s.userId ? " (tú)" : ""}</span>
                {p.puestos.length > 0 && <span className="block text-xs font-semibold text-muted">{p.puestos.map(nombrePuesto).join(" · ")}</span>}
                {p.bio && <span className="mt-1 line-clamp-2 block text-sm">{p.bio}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Arma el tuyo en <Link href="/app/ajustes" className="underline underline-offset-2">Ajustes → Tu perfil filmmaker</Link>.
      </p>
    </div>
  );
}
