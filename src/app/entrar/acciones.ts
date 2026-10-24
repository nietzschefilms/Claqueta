"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esCorreoDeCelular, identificadorDeAcceso } from "@/lib/acceso";

const soloDigitos = (t: string) => t.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");

// Con celular: la cuenta puede vivir en el correo interno o, si ya puso su
// correo, en ese; se busca por el teléfono del perfil. Se hace aquí (servidor)
// para no revelar a quién pertenece un número.
async function correoDeLaCuenta(texto: string): Promise<string | null> {
  const usuario = identificadorDeAcceso(texto);
  if (!usuario || !esCorreoDeCelular(usuario)) return usuario;
  const cel = soloDigitos(texto);
  const { data } = await createAdminClient().from("perfiles").select("correo, telefono").not("telefono", "is", null).eq("activo", true);
  const encontrados = (data ?? []).filter((p) => p.telefono && soloDigitos(p.telefono as string) === cel && p.correo);
  return encontrados.length === 1 ? (encontrados[0].correo as string) : usuario;
}

export async function entrar(texto: string, contrasena: string): Promise<{ ok: boolean; error?: string }> {
  const correo = await correoDeLaCuenta(texto);
  if (!correo) return { ok: false, error: "Escribe tu correo o tu celular a 10 dígitos." };
  const { error } = await (await createClient()).auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) {
    return {
      ok: false,
      error: /confirm/i.test(error.message) ? "Tu cuenta aún no está confirmada. Escríbenos para activarla." : "Usuario o contraseña incorrectos. Revisa y vuelve a intentar."
    };
  }
  return { ok: true };
}
