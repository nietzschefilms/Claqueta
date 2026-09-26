"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

// Pone el piso de un salón en todas las clases que se dan ahí (RLS: solo las propias).
export async function guardarPiso(salon: string, piso: string): Promise<{ ok: boolean; error?: string }> {
  await requerirSesion();
  const s = salon.trim();
  const p = piso.trim();
  if (!s || s.length > 60) return { ok: false, error: "Salón no válido." };
  if (p.length > 20) return { ok: false, error: "Escribe el piso corto. Ej. 2, PB o Sótano." };
  const supabase = await createClient();
  const { error } = await supabase.from("routine_blocks").update({ piso: p || null }).eq("salon", s);
  if (error) return { ok: false, error: "No se guardó. Inténtalo de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
