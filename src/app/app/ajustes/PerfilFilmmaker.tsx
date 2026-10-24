"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { COLORES_PERFIL } from "@/lib/perfil";
import { guardarPerfilFilmmaker, ponerAvatar } from "./acciones";

type Datos = { nombre: string; color: string | null; avatar: string | null; bio: string | null; instagram: string | null; sitio: string | null; reel: string | null; spotify: string | null; letterboxd: string | null };

// Tu perfil filmmaker: lo que ve tu equipo en "Equipo".
export function PerfilFilmmaker({ yo, inicial }: { yo: string; inicial: Datos }) {
  const [d, setD] = useState({
    color: inicial.color ?? "#486888",
    bio: inicial.bio ?? "",
    instagram: inicial.instagram ? `@${inicial.instagram}` : "",
    sitio: inicial.sitio ?? "",
    reel: inicial.reel ?? "",
    spotify: inicial.spotify ?? "",
    letterboxd: inicial.letterboxd ?? ""
  });
  const [avatar, setAvatar] = useState(inicial.avatar);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const campo = (k: keyof typeof d, etiqueta: string, ph: string, tipo = "text") => (
    <label className="block">
      <span className="etiqueta">{etiqueta}</span>
      <input type={tipo} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} placeholder={ph} className="campo mt-1" />
    </label>
  );

  const subir = async (f: File) => {
    if (f.size > 2 * 1024 * 1024) return setMsg({ ok: false, t: "La foto pesa más de 2 MB." });
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const ruta = `${yo}/${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from("avatares").upload(ruta, f, { contentType: f.type, upsert: false });
    if (error) return setMsg({ ok: false, t: "No se subió la foto. Usa JPG o PNG de menos de 2 MB." });
    iniciar(async () => {
      const r = await ponerAvatar(ruta);
      if (r.ok) setAvatar(ruta);
      setMsg(r.ok ? { ok: true, t: "Foto lista." } : { ok: false, t: r.error ?? "No se pudo." });
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await guardarPerfilFilmmaker(d);
          setMsg(r.ok ? { ok: true, t: "Perfil guardado. Así te ve tu equipo en Equipo." } : { ok: false, t: r.error ?? "No se pudo." });
        });
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <Avatar nombre={inicial.nombre} color={d.color} avatar={avatar} tam="h-20 w-20 text-3xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="btn-secundario cursor-pointer px-4 py-2 text-sm">
              Subir foto
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
            </label>
            {avatar && (
              <button type="button" onClick={() => iniciar(async () => { const r = await ponerAvatar(null); if (r.ok) setAvatar(null); })} className="btn-secundario px-4 py-2 text-sm">
                Usar solo inicial
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tu color">
            {COLORES_PERFIL.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={d.color === c} aria-label={`Color ${c}`} onClick={() => setD({ ...d, color: c })} className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-superficie ${d.color === c ? "ring-2 ring-tinta" : ""}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
      <label className="block">
        <span className="etiqueta">Una frase sobre ti</span>
        <input value={d.bio} maxLength={160} onChange={(e) => setD({ ...d, bio: e.target.value })} placeholder="Ej. Fotógrafo. Me obsesiona la luz de Tarkovski." className="campo mt-1" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("instagram", "Instagram", "@tuusuario")}
        {campo("letterboxd", "Letterboxd", "tu usuario")}
        {campo("sitio", "Sitio o portafolio", "https://…", "url")}
        {campo("reel", "Reel (Vimeo, YouTube, Drive)", "https://vimeo.com/…", "url")}
      </div>
      {campo("spotify", "Playlist de Spotify", "Compartir → Copiar enlace", "url")}
      {msg && <p className={msg.ok ? "alerta-ok" : "alerta-error"} role={msg.ok ? "status" : "alert"}>{msg.t}</p>}
      <button type="submit" disabled={pendiente} className="btn-primario">{pendiente ? "Guardando…" : "Guardar perfil"}</button>
    </form>
  );
}
