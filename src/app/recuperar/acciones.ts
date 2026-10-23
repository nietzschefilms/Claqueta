"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { notificar } from "@/lib/notificaciones";
import { identificadorDeAcceso } from "@/lib/acceso";

// "Olvidé mi contraseña": no manda correo (los correos de Supabase no llegan a
// todos). Deja la solicitud y le avisa a soporte, que resetea y manda el acceso
// por WhatsApp. Siempre responde lo mismo, exista o no la cuenta.
export async function pedirAcceso(texto: string): Promise<{ ok: boolean; error?: string }> {
  const usuario = identificadorDeAcceso(texto);
  if (!usuario) return { ok: false, error: "Escribe tu correo o tu celular a 10 dígitos." };
  const admin = createAdminClient();
  const { data: p } = await admin.from("perfiles").select("id, nombre, activo").eq("correo", usuario).maybeSingle();
  if (!p || p.activo === false) return { ok: true };
  // Una por hora por persona: si pica muchas veces no se llena la bandeja de soporte.
  const haceUnaHora = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from("solicitudes_acceso").select("id", { count: "exact", head: true }).eq("user_id", p.id).gte("creado_en", haceUnaHora);
  if (count) return { ok: true };
  await admin.from("solicitudes_acceso").insert({ user_id: p.id });
  const { data: soporte } = await admin.from("perfiles").select("id").eq("es_soporte", true).eq("activo", true);
  for (const s of soporte ?? []) {
    await notificar(s.id as string, {
      titulo: `${(p.nombre as string)?.split(" ")[0] || "Alguien"} pide acceso`,
      cuerpo: "Olvidó su contraseña. Resetéala y mándale el acceso.",
      href: "/app/soporte",
      categoria: "operativo",
      urgente: true
    }).catch(() => {});
  }
  return { ok: true };
}
