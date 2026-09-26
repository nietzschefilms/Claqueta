import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Autoriza la llamada de un cron. Acepta el Bearer si coincide con CRON_SECRET
// (crons de Vercel) o si es válido contra el secreto del Vault de Supabase
// (crons con pg_cron + pg_net). Patrón heredado de Rompiendo Tabúes.
export async function cronAutorizado(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;
  const secret = process.env.CRON_SECRET;
  if (secret && token === secret) return true;
  try {
    const { data } = await createAdminClient().rpc("cron_token_valido", { p_token: token });
    return data === true;
  } catch {
    return false;
  }
}
