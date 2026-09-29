"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { enviarPush } from "@/lib/push/enviar";
import { prefsDe } from "@/lib/notif-prefs";
import { MARCA } from "@/config/marca";

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
