import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { embedSpotify, estrellasTexto, leerRssLetterboxd, type PeliculaVista } from "@/lib/perfil";

export const metadata: Metadata = { title: "Perfil" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ultimasDeLetterboxd(usuario: string): Promise<PeliculaVista[]> {
  try {
    const r = await fetch(`https://letterboxd.com/${encodeURIComponent(usuario)}/rss/`, { next: { revalidate: 3600 }, headers: { "User-Agent": "Mozilla/5.0 (Claqueta)" } });
    if (!r.ok) return [];
    return leerRssLetterboxd(await r.text(), 6);
  } catch {
    return [];
  }
}

// PERFIL · lo que cada quien quiso compartir con el equipo.
export default async function Perfil({ params }: { params: Promise<{ id: string }> }) {
  const s = await requerirSesion();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data } = await (await createClient()).rpc("perfil_publico", { p_id: id }).maybeSingle();
  if (!data) notFound();
  const p = data as { nombre: string; color: string | null; avatar: string | null; bio: string | null; instagram: string | null; sitio: string | null; reel: string | null; spotify: string | null; letterboxd: string | null };
  const pelis = p.letterboxd ? await ultimasDeLetterboxd(p.letterboxd) : [];
  const spotify = embedSpotify(p.spotify);
  const ligas = [
    p.instagram && { t: `@${p.instagram}`, href: `https://instagram.com/${p.instagram}` },
    p.reel && { t: "Reel", href: p.reel },
    p.sitio && { t: "Sitio", href: p.sitio },
    p.letterboxd && { t: "Letterboxd", href: `https://letterboxd.com/${p.letterboxd}/` }
  ].filter(Boolean) as { t: string; href: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/app/equipo" className="enlace-mono">← Equipo</Link>
      <header className="tarjeta relative flex flex-wrap items-center gap-5 overflow-hidden">
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ backgroundColor: p.color ?? "#486888" }} aria-hidden="true" />
        <Avatar nombre={p.nombre} color={p.color} avatar={p.avatar} tam="h-24 w-24 text-4xl" />
        <div className="relative min-w-0 flex-1">
          <h1 className="titulo text-5xl leading-none">{p.nombre}</h1>
          {p.bio && <p className="mt-2 text-sm">{p.bio}</p>}
          {ligas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ligas.map((l) => (
                <a key={l.t} href={l.href} target="_blank" rel="noopener noreferrer" className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs font-semibold hover:bg-tinta/[0.1]">
                  {l.t} ↗
                </a>
              ))}
            </div>
          )}
        </div>
        {id === s.userId && (
          <Link href="/app/ajustes" className="btn-secundario relative">Editar</Link>
        )}
      </header>
      {spotify && (
        <section className="tarjeta space-y-2 p-4">
          <h2 className="etiqueta">Lo que está escuchando</h2>
          <iframe src={spotify} title={`Playlist de ${p.nombre}`} width="100%" height="352" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" className="rounded-2xl border-0" />
        </section>
      )}
      {pelis.length > 0 && (
        <section className="tarjeta space-y-2">
          <h2 className="etiqueta">Lo último que vio</h2>
          <ul className="divide-y divide-borde/60">
            {pelis.map((f, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                <a href={f.liga} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-semibold hover:underline">
                  {f.titulo} {f.ano && <span className="cifra text-xs font-normal text-muted">{f.ano}</span>}
                </a>
                <span className="shrink-0 text-sm text-rojo" aria-label={f.estrellas ? `${f.estrellas} estrellas` : undefined}>{estrellasTexto(f.estrellas)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!spotify && !pelis.length && !ligas.length && !p.bio && (
        <p className="tarjeta text-sm text-muted">{id === s.userId ? "Tu perfil está vacío. Llénalo en Ajustes: foto, color, Instagram, reel, playlist y Letterboxd." : "Todavía no arma su perfil."}</p>
      )}
    </div>
  );
}
