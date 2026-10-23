"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requerirSoporte } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROL_POR_DEFECTO, esRol } from "@/config/marca";
import { comoSeEntra, esCorreoDeCelular, identificadorDeAcceso } from "@/lib/acceso";

// Página de soporte: poder total sobre cuentas. TODA acción revisa primero
// que quien la llama tenga perfiles.es_soporte = true.

export type Cuenta = {
  id: string;
  correo: string | null;
  nombre: string | null;
  rol: string;
  activo: boolean;
  esSoporte: boolean;
  // Equipos a los que pertenece (ids). Sin equipo no ve Estudio ni proyectos.
  equipos: string[];
};

export type EquipoSoporte = { id: string; nombre: string };

export async function listarEquipos(): Promise<EquipoSoporte[]> {
  await requerirSoporte();
  const { data } = await createAdminClient().from("equipos").select("id, nombre").order("creado_en");
  return (data ?? []) as EquipoSoporte[];
}

// Contraseña temporal legible y distinta cada vez (en RT era una fija; aquí no,
// para que nadie pueda adivinar la de otra persona). Sin 0/O ni 1/l.
// Siempre trae minúscula, mayúscula y número para cumplir la regla de Supabase.
function contrasenaTemporal() {
  const grupos = ["ABCDEFGHJKMNPQRSTUVWXYZ", "abcdefghjkmnpqrstuvwxyz", "23456789"];
  const abc = grupos.join("");
  const letras = grupos.map((g) => g[randomInt(g.length)]);
  while (letras.length < 14) letras.push(abc[randomInt(abc.length)]);
  for (let i = letras.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join("");
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
  const ids = (data ?? []).map((p) => p.id as string);
  const { data: m } = ids.length
    ? await createAdminClient().from("equipo_miembros").select("user_id, equipo_id").in("user_id", ids)
    : { data: [] };
  const equiposDe = (uid: string) => (m ?? []).filter((x) => x.user_id === uid).map((x) => x.equipo_id as string);
  return {
    ok: true,
    cuentas: (data ?? []).map((p) => ({
      id: p.id as string,
      correo: p.correo ? comoSeEntra(p.correo as string) : null,
      nombre: p.nombre as string | null,
      rol: p.rol as string,
      activo: p.activo !== false,
      esSoporte: p.es_soporte === true,
      equipos: equiposDe(p.id as string)
    }))
  };
}

// Crea una cuenta con correo confirmado y contraseña temporal. La persona
// debe cambiarla al primer ingreso (pwd_set: false activa el popup).
// La base solo deja nacer cuentas con invitación (el registro está cerrado
// desde que la página web comparte el proyecto), así que primero se prepara
// la invitación con su equipo; el trigger la aplica al crear el perfil.
export async function crearCuenta(input: { correo: string; nombre: string; rol: string; equipoId?: string | null }) {
  await requerirSoporte();
  // Correo o celular: con celular la cuenta vive en un correo interno y la persona entra con su número.
  const correo = identificadorDeAcceso(input.correo);
  const nombre = input.nombre.trim();
  const rol = esRol(input.rol) ? input.rol : ROL_POR_DEFECTO;
  if (!correo) return { ok: false as const, error: "Escribe un correo válido o su celular a 10 dígitos." };
  const porCelular = esCorreoDeCelular(correo);
  if (!nombre) return { ok: false as const, error: "Escribe el nombre." };

  const admin = createAdminClient();
  const yaTiene = porCelular ? "Ese celular ya tiene cuenta. Búscalo abajo y usa Resetear acceso." : "Ese correo ya tiene cuenta. Búscalo abajo y usa Resetear acceso.";
  const { data: perfil } = await admin.from("perfiles").select("id").eq("correo", correo).maybeSingle();
  if (perfil) return { ok: false as const, error: yaTiene };
  const { data: clienteWeb } = porCelular ? { data: null } : await admin.from("clientes_web").select("id").eq("correo", correo).maybeSingle();
  if (clienteWeb)
    return { ok: false as const, error: "Ese correo ya entró como cliente en la página web con Google. Usa otro correo para su cuenta del equipo." };

  let equipo: { id: string; nombre: string } | null = null;
  if (input.equipoId) {
    const { data: e } = await admin.from("equipos").select("id, nombre").eq("id", input.equipoId).maybeSingle();
    if (!e) return { ok: false as const, error: "Ese equipo ya no existe. Recarga la página." };
    equipo = e as { id: string; nombre: string };
  }

  // Si ya había una invitación preparada (horario, frentes, bienvenida), se respeta.
  const { data: inv } = await admin.from("invitaciones").select("id, equipo_id").eq("correo", correo).maybeSingle();
  const bienvenida = equipo ? `Ya estás en ${equipo.nombre}. En Estudio ves la agenda, el Radar y los proyectos del equipo.` : null;
  const { error: errInv } = inv
    ? await admin.from("invitaciones").update({ aplicada_en: null, equipo_id: inv.equipo_id ?? equipo?.id ?? null }).eq("id", inv.id)
    : await admin.from("invitaciones").insert({ correo, nombre, equipo_id: equipo?.id ?? null, mensaje: bienvenida });
  if (errInv) return { ok: false as const, error: "No se pudo preparar la invitación. Inténtalo de nuevo." };

  const pass = contrasenaTemporal();
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
        ? yaTiene
        : "No se pudo crear la cuenta. Revisa el correo e inténtalo de nuevo."
    };
  }
  // El trigger ya creó el perfil; aseguramos rol y nombre por si acaso.
  await admin
    .from("perfiles")
    .update({ rol, nombre, correo, ...(porCelular ? { telefono: comoSeEntra(correo) } : {}) })
    .eq("id", data.user.id);
  revalidatePath("/app/soporte");
  return { ok: true as const, correo: comoSeEntra(correo), contrasena: pass };
}

// Mete a una cuenta existente a un equipo (para que vea Estudio y proyectos).
export async function agregarAEquipo(uid: string, equipoId: string) {
  await requerirSoporte();
  const admin = createAdminClient();
  const { data: e } = await admin.from("equipos").select("id").eq("id", equipoId).maybeSingle();
  if (!e) return { ok: false, error: "Ese equipo ya no existe. Recarga la página." };
  const { error } = await admin.from("equipo_miembros").upsert({ equipo_id: equipoId, user_id: uid }, { onConflict: "equipo_id,user_id", ignoreDuplicates: true });
  revalidatePath("/app/soporte");
  return error ? { ok: false, error: "No se pudo meter al equipo." } : { ok: true };
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
  // Si había pedido ayuda desde "Olvidé mi contraseña", ya quedó atendido.
  await createAdminClient().from("solicitudes_acceso").update({ atendida_en: new Date().toISOString() }).eq("user_id", uid).is("atendida_en", null);
  revalidatePath("/app/soporte");
  return { ok: true as const, correo: comoSeEntra(data.user?.email ?? ""), contrasena: pass };
}

export type Solicitud = { id: string; uid: string; nombre: string; usuario: string; creado_en: string };

// Quién pidió ayuda para entrar y no ha sido atendido.
export async function listarSolicitudes(): Promise<Solicitud[]> {
  await requerirSoporte();
  const admin = createAdminClient();
  const { data } = await admin.from("solicitudes_acceso").select("id, user_id, creado_en").is("atendida_en", null).order("creado_en");
  const ids = [...new Set((data ?? []).map((x) => x.user_id as string))];
  if (!ids.length) return [];
  const { data: p } = await admin.from("perfiles").select("id, nombre, correo").in("id", ids);
  const vistos = new Set<string>();
  return (data ?? [])
    .filter((x) => !vistos.has(x.user_id as string) && vistos.add(x.user_id as string))
    .map((x) => {
      const per = (p ?? []).find((y) => y.id === x.user_id);
      return { id: x.id as string, uid: x.user_id as string, nombre: (per?.nombre as string) || "Sin nombre", usuario: comoSeEntra((per?.correo as string) ?? ""), creado_en: x.creado_en as string };
    });
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
