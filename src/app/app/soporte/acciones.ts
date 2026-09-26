"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requerirSoporte } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROL_POR_DEFECTO, esRol } from "@/config/marca";

// Página de soporte: poder total sobre cuentas. TODA acción revisa primero
// que quien la llama tenga perfiles.es_soporte = true.

export type Cuenta = {
  id: string;
  correo: string | null;
  nombre: string | null;
  rol: string;
  activo: boolean;
  esSoporte: boolean;
};

// Contraseña temporal legible y distinta cada vez (en RT era una fija; aquí no,
// para que nadie pueda adivinar la de otra persona). Sin 0/O ni 1/l.
function contrasenaTemporal() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += abc[randomInt(abc.length)];
  return s;
}

const limpiar = (q: string) => q.replace(/[%_,()]/g, "").trim();

export async function buscarCuentas(q: string): Promise<{ ok: boolean; cuentas: Cuenta[] }> {
  await requerirSoporte();
  const texto = limpiar(q);
  let consulta = createAdminClient()
    .from("perfiles")
    .select("id, correo, nombre, rol, activo, es_soporte")
    .order("creado_en", { ascending: false })
    .limit(40);
  if (texto.length >= 2) consulta = consulta.or(`correo.ilike.%${texto}%,nombre.ilike.%${texto}%`);
  const { data, error } = await consulta;
  if (error) return { ok: false, cuentas: [] };
  return {
    ok: true,
    cuentas: (data ?? []).map((p) => ({
      id: p.id as string,
      correo: p.correo as string | null,
      nombre: p.nombre as string | null,
      rol: p.rol as string,
      activo: p.activo !== false,
      esSoporte: p.es_soporte === true
    }))
  };
}

// Crea una cuenta con correo confirmado y contraseña temporal. La persona
// debe cambiarla al primer ingreso (pwd_set: false activa el popup).
export async function crearCuenta(input: { correo: string; nombre: string; rol: string }) {
  await requerirSoporte();
  const correo = input.correo.trim().toLowerCase();
  const nombre = input.nombre.trim();
  const rol = esRol(input.rol) ? input.rol : ROL_POR_DEFECTO;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { ok: false as const, error: "Ese correo no es válido." };
  if (!nombre) return { ok: false as const, error: "Escribe el nombre." };

  const pass = contrasenaTemporal();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: pass,
    email_confirm: true,
    user_metadata: { nombre, rol, pwd_set: false }
  });
  if (error || !data.user) {
    return {
      ok: false as const,
      error: /already|registered|exists/i.test(error?.message ?? "")
        ? "Ese correo ya tiene cuenta. Búscalo abajo y usa Resetear acceso."
        : "No se pudo crear la cuenta."
    };
  }
  // El trigger ya creó el perfil; aseguramos rol y nombre por si acaso.
  await admin.from("perfiles").update({ rol, nombre, correo }).eq("id", data.user.id);
  revalidatePath("/app/soporte");
  return { ok: true as const, correo, contrasena: pass };
}

// Nueva contraseña temporal (la persona la cambia al entrar).
export async function resetearAcceso(uid: string) {
  await requerirSoporte();
  const pass = contrasenaTemporal();
  const { data, error } = await createAdminClient().auth.admin.updateUserById(uid, {
    password: pass,
    email_confirm: true,
    user_metadata: { pwd_set: false }
  });
  if (error) return { ok: false as const, error: "No se pudo resetear." };
  return { ok: true as const, correo: data.user?.email ?? "", contrasena: pass };
}

export async function cambiarRol(uid: string, rol: string) {
  const s = await requerirSoporte();
  if (!esRol(rol)) return { ok: false, error: "Rol inválido." };
  if (uid === s.userId && rol !== s.rol) return { ok: false, error: "No puedes cambiar tu propio rol." };
  const { error } = await createAdminClient().from("perfiles").update({ rol }).eq("id", uid);
  revalidatePath("/app/soporte");
  return error ? { ok: false, error: "No se pudo cambiar." } : { ok: true };
}

// Baja / alta lógica. Nunca se borra a nadie en duro desde la app.
export async function cambiarActivo(uid: string, activo: boolean) {
  const s = await requerirSoporte();
  if (uid === s.userId) return { ok: false, error: "No puedes desactivarte a ti mismo." };
  const { error } = await createAdminClient().from("perfiles").update({ activo }).eq("id", uid);
  revalidatePath("/app/soporte");
  return error ? { ok: false, error: "No se pudo." } : { ok: true };
}

export async function cambiarSoporte(uid: string, esSoporte: boolean) {
  const s = await requerirSoporte();
  if (uid === s.userId && !esSoporte) return { ok: false, error: "No puedes quitarte soporte a ti mismo." };
  const { error } = await createAdminClient().from("perfiles").update({ es_soporte: esSoporte }).eq("id", uid);
  revalidatePath("/app/soporte");
  return error ? { ok: false, error: "No se pudo." } : { ok: true };
}
