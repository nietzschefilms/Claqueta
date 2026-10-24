// PERFIL FILMMAKER · ayudas compartidas (servidor y cliente).

export const COLORES_PERFIL = ["#FF0000", "#E8590C", "#F2B705", "#2E7D50", "#2B8A9E", "#486888", "#765EB4", "#C2185B", "#EBE7E0", "#6C665E"];

export function urlAvatar(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatares/${ruta}`;
}

// "https://open.spotify.com/playlist/ID?si=..." → embed oficial (sin llave).
export function embedSpotify(url: string | null | undefined): string | null {
  const m = url?.match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

// Instagram: acepta @usuario, usuario o la liga completa.
export function limpiarInstagram(t: string): string | null {
  const u = t.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(u) ? u : null;
}

// Letterboxd: acepta usuario o la liga del perfil.
export function limpiarLetterboxd(t: string): string | null {
  const u = t.trim().replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, "").replace(/\/.*$/, "");
  return /^[A-Za-z0-9_]{1,30}$/.test(u) ? u : null;
}

export type PeliculaVista = { titulo: string; ano: string | null; estrellas: number | null; liga: string };

// Las últimas películas del diario de Letterboxd (RSS público del perfil).
export function leerRssLetterboxd(xml: string, max = 6): PeliculaVista[] {
  const items = xml.split("<item>").slice(1, max + 1);
  const tag = (s: string, t: string) => s.match(new RegExp(`<${t}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${t}>`))?.[1]?.trim() ?? null;
  return items
    .map((it) => ({
      titulo: tag(it, "letterboxd:filmTitle") ?? tag(it, "title") ?? "",
      ano: tag(it, "letterboxd:filmYear"),
      estrellas: tag(it, "letterboxd:memberRating") ? Number(tag(it, "letterboxd:memberRating")) : null,
      liga: tag(it, "link") ?? "https://letterboxd.com"
    }))
    .filter((p) => p.titulo);
}

export const estrellasTexto = (n: number | null) => (n === null ? "" : "★".repeat(Math.floor(n)) + (n % 1 ? "½" : ""));
