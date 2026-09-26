import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROL_POR_DEFECTO, esRol, type Rol } from "@/config/marca";

export type Sesion = {
  userId: string;
  email: string | null;
  rol: Rol;
  esAdmin: boolean;
  esSoporte: boolean;
  nombre: string;
  // false = entró con contraseña temporal y debe cambiarla (popup obligatorio).
  contrasenaPropia: boolean;
};

// Lee la sesión y el perfil. Sin sesión, manda a /entrar.
// El rol sale de la BASE (perfiles.rol), nunca de listas de correos.
export async function requerirSesion(): Promise<Sesion> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: p } = await createAdminClient()
    .from("perfiles")
    .select("rol, nombre, es_soporte, activo, roles(es_admin)")
    .eq("id", user.id)
    .maybeSingle();

  // Cuenta dada de baja: fuera.
  if (p && p.activo === false) redirect("/entrar?estado=baja");

  const rol: Rol = esRol(p?.rol) ? p.rol : ROL_POR_DEFECTO;
  const rolInfo = (p?.roles ?? null) as { es_admin?: boolean } | { es_admin?: boolean }[] | null;
  const esAdmin = Array.isArray(rolInfo) ? !!rolInfo[0]?.es_admin : !!rolInfo?.es_admin;

  return {
    userId: user.id,
    email: user.email ?? null,
    rol,
    esAdmin,
    esSoporte: p?.es_soporte === true,
    nombre: (p?.nombre as string) || (user.user_metadata?.nombre as string) || "",
    contrasenaPropia: user.user_metadata?.pwd_set !== false
  };
}

// Solo deja pasar a los roles indicados. Los demás regresan al inicio.
export async function requerirRol(...roles: Rol[]): Promise<Sesion> {
  const s = await requerirSesion();
  if (!roles.includes(s.rol)) redirect("/app");
  return s;
}

// Página de soporte (crear cuentas, resetear accesos). Poder total.
export async function requerirSoporte(): Promise<Sesion> {
  const s = await requerirSesion();
  if (!s.esSoporte) redirect("/app");
  return s;
}
