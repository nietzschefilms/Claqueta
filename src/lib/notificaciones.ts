import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush } from "@/lib/push/enviar";
import { CATEGORIAS, prefsDe, type Categoria } from "@/lib/notif-prefs";

// Avisa a una persona: deja la notificación en su bandeja (/app/notificaciones)
// y, si tiene esa categoría encendida, le manda push al celular.
// Nunca truena: una notificación fallida no debe romper la acción que la causó.
export async function notificar(
  usuarioId: string,
  n: { titulo: string; cuerpo?: string; href?: string; categoria?: Categoria; tag?: string }
): Promise<void> {
  const categoria = n.categoria ?? "operativo";
  const admin = createAdminClient();
  try {
    await admin.from("notificaciones").insert({
      usuario_id: usuarioId,
      titulo: n.titulo,
      cuerpo: n.cuerpo ?? null,
      href: n.href ?? null,
      categoria
    });
  } catch {
    /* sin bandeja no pasa nada grave */
  }

  try {
    const { data } = await admin.from("perfiles").select("notif_prefs").eq("id", usuarioId).maybeSingle();
    const prefs = prefsDe(data?.notif_prefs);
    const obligatoria = CATEGORIAS.find((c) => c.clave === categoria)?.obligatoria;
    if (!obligatoria && prefs[categoria] === false) return;
    await enviarPush(usuarioId, { titulo: n.titulo, cuerpo: n.cuerpo, url: n.href ?? "/app", tag: n.tag ?? categoria });
  } catch {
    /* silencioso */
  }
}

// Avisa a todas las personas con alguno de estos roles.
export async function notificarRoles(roles: string[], n: Parameters<typeof notificar>[1]): Promise<number> {
  const { data } = await createAdminClient().from("perfiles").select("id").in("rol", roles).eq("activo", true);
  const ids = (data ?? []).map((p) => p.id as string);
  for (const id of ids) await notificar(id, n);
  return ids.length;
}

export async function contarNoLeidas(userId: string): Promise<number> {
  try {
    const { count } = await createAdminClient()
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", userId)
      .eq("leido", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}
