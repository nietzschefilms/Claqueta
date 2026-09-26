import "server-only"; // candado: si alguien lo importa en cliente, truena el build
import "@/lib/supabase/ws-polyfill";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Cliente con permisos de servicio. SOLO se usa en el servidor.
// Sirve para crear cuentas, mandar push y tareas de servidor que saltan RLS.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
