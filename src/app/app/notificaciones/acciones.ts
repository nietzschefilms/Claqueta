"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export async function marcarTodasLeidas() {
  const s = await requerirSesion();
  const supabase = await createClient();
  await supabase.from("notificaciones").update({ leido: true }).eq("usuario_id", s.userId).eq("leido", false);
  revalidatePath("/app", "layout");
}
