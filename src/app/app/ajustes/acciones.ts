"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { enviarPush } from "@/lib/push/enviar";
import { prefsDe } from "@/lib/notif-prefs";
import { MARCA } from "@/config/marca";
import { createAdminClient } from "@/lib/supabase/admin";
import { esCorreoDeCelular } from "@/lib/acceso";
import { embedSpotify, limpiarInstagram, limpiarLetterboxd } from "@/lib/perfil";

export async function guardarPerfil(datos: { nombre: string; telefono: string }) {
  await requerirSesion();
  const nombre = datos.nombre.trim().slice(0, 80);
  const telefono = datos.telefono.replace(/[^\d+ ]/g, "").slice(0, 20);
  if (!nombre) return { ok: false, error: "Escribe tu nombre." };
  // Con el cliente de la sesión: RLS garantiza que solo edite su propio perfil.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from("perfiles").update({ nombre, telefono: telefono || null }).eq("id", data.user!.id);
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function guardarPrefsNotif(raw: Record<string, boolean>) {
  const s = await requerirSesion();
  const supabase = await createClient();
  const { error } = await supabase.from("perfiles").update({ notif_prefs: prefsDe(raw) }).eq("id", s.userId);
  return error ? { ok: false, error: "No se pudo guardar." } : { ok: true };
}

export async function enviarPushPrueba() {
  const s = await requerirSesion();
  const r = await enviarPush(s.userId, { titulo: MARCA.nombreCorto, cuerpo: "Así se ven tus avisos.", url: "/app/ajustes", tag: "prueba" }, { urgente: true, ttlSegundos: 600 });
  return { enviadas: r.enviadas };
}

// La bienvenida se ve una vez: al terminarla se marca en el perfil.
export async function marcarBienvenida() {
  const s = await requerirSesion();
  const supabase = await createClient();
  const { error } = await supabase.from("perfiles").update({ bienvenida_vista: true }).eq("id", s.userId);
  revalidatePath("/app", "layout");
  return error ? { ok: false } : { ok: true };
}

// Quien entró con su celular puede poner su correo real. Se cambia directo
// (sin correo de confirmación, que no siempre llega) y sigue pudiendo entrar
// con el correo nuevo.
export async function ponerMiCorreo(texto: string) {
  const s = await requerirSesion();
  const correo = texto.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { ok: false, error: "Ese correo no es válido. Ej. ana@gmail.com" };
  if (esCorreoDeCelular(correo)) return { ok: false, error: "Usa tu correo personal." };
  const admin = createAdminClient();
  const { data: ya } = await admin.from("perfiles").select("id").eq("correo", correo).neq("id", s.userId).maybeSingle();
  if (ya) return { ok: false, error: "Ese correo ya lo usa otra cuenta." };
  const { error } = await admin.auth.admin.updateUserById(s.userId, { email: correo, email_confirm: true });
  if (error) return { ok: false, error: /already|exists|registered/i.test(error.message) ? "Ese correo ya lo usa otra cuenta." : "No se pudo guardar el correo." };
  await admin.from("perfiles").update({ correo }).eq("id", s.userId);
  revalidatePath("/app", "layout");
  return { ok: true };
}

// Perfil filmmaker: lo que ve tu equipo (nunca teléfono ni correo).
export async function guardarPerfilFilmmaker(d: { color: string; bio: string; instagram: string; sitio: string; reel: string; spotify: string; letterboxd: string }) {
  const s = await requerirSesion();
  const color = /^#[0-9A-Fa-f]{6}$/.test(d.color) ? d.color : null;
  const bio = d.bio.trim().slice(0, 160) || null;
  const instagram = d.instagram.trim() ? limpiarInstagram(d.instagram) : null;
  if (d.instagram.trim() && !instagram) return { ok: false, error: "Ese Instagram no es válido. Escribe tu usuario, ej. @nietzschefilms." };
  const liga = (t: string, que: string) => {
    const u = t.trim();
    if (!u) return { v: null as string | null };
    const v = /^https?:\/\//i.test(u) ? u.replace(/^http:/i, "https:") : `https://${u}`;
    return /^https:\/\/\S+\.\S+$/.test(v) && v.length <= 200 ? { v } : { error: `${que} no es válido. Pega la liga completa.` };
  };
  const sitio = liga(d.sitio, "El sitio");
  const reel = liga(d.reel, "El reel");
  if ("error" in sitio) return { ok: false, error: sitio.error };
  if ("error" in reel) return { ok: false, error: reel.error };
  const spotify = d.spotify.trim() ? (embedSpotify(d.spotify.trim()) ? d.spotify.trim().split("?")[0] : null) : null;
  if (d.spotify.trim() && !spotify) return { ok: false, error: "Pega la liga de una playlist, álbum o canción de Spotify (Compartir → Copiar enlace)." };
  const letterboxd = d.letterboxd.trim() ? limpiarLetterboxd(d.letterboxd) : null;
  if (d.letterboxd.trim() && !letterboxd) return { ok: false, error: "Escribe tu usuario de Letterboxd, ej. jamez." };
  const supabase = await createClient();
  const { error } = await supabase.from("perfiles").update({ color, bio, instagram, sitio: sitio.v, reel: reel.v, spotify, letterboxd }).eq("id", s.userId);
  if (error) return { ok: false, error: "No se guardó tu perfil." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function ponerAvatar(ruta: string | null) {
  const s = await requerirSesion();
  if (ruta && !new RegExp(`^${s.userId}/[0-9]{1,16}\\.(jpg|png|webp)$`).test(ruta)) return { ok: false, error: "Foto no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("perfiles").update({ avatar: ruta }).eq("id", s.userId);
  if (error) return { ok: false, error: "No se guardó la foto." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
