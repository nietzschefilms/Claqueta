import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Claqueta es privada: no hay portada. Con sesión va a la app; sin sesión, a entrar.
export default async function Portada() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  redirect(user ? "/app" : "/entrar");
}
