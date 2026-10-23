"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { notificar } from "@/lib/notificaciones";
import { esFechaISO } from "@/lib/claqueta/fechas";
import { AVANCE_BASE, esPuesto, nombrePuesto } from "@/lib/claqueta/puestos";
import type { Resultado } from "../../acciones";

// Equipo del proyecto: puestos, avance, plan minuto a minuto, documentos y
// llamados. Todo con el cliente de sesión: RLS (0017) decide quién puede qué.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const tocar = (id: string) => revalidatePath(`/app/estudio/proyectos/${id}`);
const sinPermiso = "Eso solo lo puede hacer el productor o dirección del proyecto.";

async function nombreProyecto(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("proyectos").select("nombre").eq("id", id).maybeSingle();
  return (data?.nombre as string) ?? "el proyecto";
}

// ─── Puestos ─────────────────────────────────────────────────────────────
export async function asignarPuesto(proyectoId: string, userId: string, puesto: string): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(userId)) return { ok: false, error: "Persona no válida." };
  if (!esPuesto(puesto)) return { ok: false, error: "Elige el puesto." };
  const supabase = await createClient();
  const { data: ya } = await supabase.from("proyecto_miembros").select("id, archivado_at").eq("proyecto_id", proyectoId).eq("user_id", userId).eq("puesto", puesto).maybeSingle();
  const { error } = ya
    ? await supabase.from("proyecto_miembros").update({ archivado_at: null }).eq("id", ya.id)
    : await supabase.from("proyecto_miembros").insert({ proyecto_id: proyectoId, user_id: userId, puesto, creado_por: s.userId });
  if (error) return { ok: false, error: "Solo el productor reparte los puestos." };
  if (userId !== s.userId && (!ya || ya.archivado_at)) {
    const nombre = await nombreProyecto(supabase, proyectoId);
    await notificar(userId, { titulo: `Estás en ${nombre}`, cuerpo: `${s.nombre.split(" ")[0] || "Producción"} te puso como ${nombrePuesto(puesto)}.`, href: `/app/estudio/proyectos/${proyectoId}`, categoria: "operativo" }).catch(() => {});
  }
  tocar(proyectoId);
  return { ok: true };
}

export async function quitarPuesto(proyectoId: string, miembroId: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(miembroId)) return { ok: false, error: "Puesto no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("proyecto_miembros").update({ archivado_at: new Date().toISOString() }).eq("id", miembroId).eq("proyecto_id", proyectoId).select("id");
  if (error || !data?.length) return { ok: false, error: "Solo el productor reparte los puestos." };
  tocar(proyectoId);
  return { ok: true };
}

// ─── Avance ──────────────────────────────────────────────────────────────
export async function cargarAvanceBase(proyectoId: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  const supabase = await createClient();
  const { count } = await supabase.from("proyecto_avance").select("id", { count: "exact", head: true }).eq("proyecto_id", proyectoId).is("archivado_at", null);
  if (count) return { ok: true };
  const { error } = await supabase.from("proyecto_avance").insert(AVANCE_BASE.map((titulo, i) => ({ proyecto_id: proyectoId, titulo, orden: (i + 1) * 10 })));
  if (error) return { ok: false, error: "No se cargó la lista." };
  tocar(proyectoId);
  return { ok: true };
}

export async function agregarAvance(proyectoId: string, titulo: string): Promise<Resultado> {
  await requerirSesion();
  const t = titulo.trim();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  if (!t || t.length > 100) return { ok: false, error: "Escribe qué falta, ej. Conseguir dron." };
  const supabase = await createClient();
  const { data: ult } = await supabase.from("proyecto_avance").select("orden").eq("proyecto_id", proyectoId).order("orden", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("proyecto_avance").insert({ proyecto_id: proyectoId, titulo: t, orden: ((ult?.orden as number) ?? 0) + 10 });
  if (error) return { ok: false, error: "No se agregó." };
  tocar(proyectoId);
  return { ok: true };
}

export async function editarAvance(
  proyectoId: string,
  id: string,
  c: { estado?: string; responsable?: string | null; fecha_limite?: string | null; nota?: string; titulo?: string }
): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Pendiente no válido." };
  const d: Record<string, unknown> = { actualizado_por: s.userId, actualizado_en: new Date().toISOString() };
  if (c.estado !== undefined) {
    if (!["falta", "en_proceso", "listo"].includes(c.estado)) return { ok: false, error: "Estado no válido." };
    d.estado = c.estado;
  }
  if (c.responsable !== undefined) {
    if (c.responsable && !UUID.test(c.responsable)) return { ok: false, error: "Persona no válida." };
    d.responsable = c.responsable || null;
  }
  if (c.fecha_limite !== undefined) {
    if (c.fecha_limite && !esFechaISO(c.fecha_limite)) return { ok: false, error: "Fecha no válida." };
    d.fecha_limite = c.fecha_limite || null;
  }
  if (c.nota !== undefined) {
    if (c.nota.length > 300) return { ok: false, error: "La nota es muy larga (máx. 300)." };
    d.nota = c.nota.trim() || null;
  }
  if (c.titulo !== undefined) {
    const t = c.titulo.trim();
    if (!t || t.length > 100) return { ok: false, error: "El nombre va de 1 a 100 letras." };
    d.titulo = t;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("proyecto_avance").update(d).eq("id", id).eq("proyecto_id", proyectoId).select("titulo, responsable").maybeSingle();
  if (error || !data) return { ok: false, error: "No se guardó." };
  if (c.responsable && c.responsable !== s.userId) {
    const nombre = await nombreProyecto(supabase, proyectoId);
    await notificar(c.responsable, { titulo: `Te toca: ${data.titulo}`, cuerpo: `${nombre} · te lo pasó ${s.nombre.split(" ")[0] || "tu equipo"}`, href: `/app/estudio/proyectos/${proyectoId}`, categoria: "operativo" }).catch(() => {});
  }
  tocar(proyectoId);
  return { ok: true };
}

export async function archivarAvance(proyectoId: string, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Pendiente no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("proyecto_avance").update({ archivado_at: new Date().toISOString() }).eq("id", id).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, error: "No se pudo quitar." };
  tocar(proyectoId);
  return { ok: true };
}

// ─── Plan minuto a minuto ────────────────────────────────────────────────
const TIPOS_BLOQUE = ["llamado", "montaje", "ensayo", "toma", "comida", "traslado", "cierre", "otro"];

export async function agregarBloque(proyectoId: string, c: { fecha: string; inicio: string; minutos: number; titulo: string; tipo: string; plano_id?: string | null }): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  if (!esFechaISO(c.fecha)) return { ok: false, error: "Elige el día de rodaje." };
  if (!HORA.test(c.inicio)) return { ok: false, error: "Escribe la hora de inicio, ej. 07:00." };
  if (!Number.isInteger(c.minutos) || c.minutos < 1 || c.minutos > 720) return { ok: false, error: "La duración va de 1 a 720 minutos." };
  const titulo = c.titulo.trim();
  if (!titulo || titulo.length > 120) return { ok: false, error: "Escribe qué se hace, ej. Plano 1A o Comida." };
  if (!TIPOS_BLOQUE.includes(c.tipo)) return { ok: false, error: "Elige el tipo." };
  if (c.plano_id && !UUID.test(c.plano_id)) return { ok: false, error: "Plano no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("plan_dia").insert({ proyecto_id: proyectoId, fecha: c.fecha, inicio: c.inicio, minutos: c.minutos, titulo, tipo: c.tipo, plano_id: c.plano_id || null });
  if (error) return { ok: false, error: sinPermiso };
  tocar(proyectoId);
  return { ok: true };
}

export async function editarBloque(proyectoId: string, id: string, c: { inicio?: string; minutos?: number; titulo?: string }): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Bloque no válido." };
  const d: Record<string, unknown> = {};
  if (c.inicio !== undefined) {
    if (!HORA.test(c.inicio)) return { ok: false, error: "Hora no válida." };
    d.inicio = c.inicio;
  }
  if (c.minutos !== undefined) {
    if (!Number.isInteger(c.minutos) || c.minutos < 1 || c.minutos > 720) return { ok: false, error: "La duración va de 1 a 720 minutos." };
    d.minutos = c.minutos;
  }
  if (c.titulo !== undefined) {
    const t = c.titulo.trim();
    if (!t || t.length > 120) return { ok: false, error: "Escribe qué se hace." };
    d.titulo = t;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_dia").update(d).eq("id", id).eq("proyecto_id", proyectoId).select("id");
  if (error || !data?.length) return { ok: false, error: sinPermiso };
  tocar(proyectoId);
  return { ok: true };
}

// Empezar / terminar / regresar a pendiente. Al empezar uno, el que corría se termina.
export async function marcarBloque(proyectoId: string, id: string, estado: "pendiente" | "en_curso" | "hecho"): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id) || !["pendiente", "en_curso", "hecho"].includes(estado)) return { ok: false, error: "Bloque no válido." };
  const supabase = await createClient();
  const ahora = new Date().toISOString();
  const { data: b } = await supabase.from("plan_dia").select("fecha, empezo_en").eq("id", id).eq("proyecto_id", proyectoId).maybeSingle();
  if (!b) return { ok: false, error: "Ese bloque ya no existe." };
  if (estado === "en_curso") {
    await supabase.from("plan_dia").update({ estado: "hecho", termino_en: ahora, actualizado_por: s.userId }).eq("proyecto_id", proyectoId).eq("fecha", b.fecha).eq("estado", "en_curso").neq("id", id);
  }
  const d =
    estado === "en_curso"
      ? { estado, empezo_en: ahora, termino_en: null }
      : estado === "hecho"
        ? { estado, termino_en: ahora, empezo_en: b.empezo_en ?? ahora }
        : { estado, empezo_en: null, termino_en: null };
  const { data, error } = await supabase.from("plan_dia").update({ ...d, actualizado_por: s.userId }).eq("id", id).eq("proyecto_id", proyectoId).select("id");
  if (error || !data?.length) return { ok: false, error: sinPermiso };
  tocar(proyectoId);
  return { ok: true };
}

export async function archivarBloque(proyectoId: string, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Bloque no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_dia").update({ archivado_at: new Date().toISOString() }).eq("id", id).eq("proyecto_id", proyectoId).select("id");
  if (error || !data?.length) return { ok: false, error: sinPermiso };
  tocar(proyectoId);
  return { ok: true };
}

// Arma el día desde la lista de planos de las escenas de esa fecha:
// llamado, montaje, cada plano con sus minutos, comida a media jornada y cierre.
export async function armarPlanDesdePlanos(proyectoId: string, fecha: string, llamado: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !esFechaISO(fecha)) return { ok: false, error: "Elige el día de rodaje." };
  if (!HORA.test(llamado)) return { ok: false, error: "Escribe la hora del llamado, ej. 07:00." };
  const supabase = await createClient();
  const { count } = await supabase.from("plan_dia").select("id", { count: "exact", head: true }).eq("proyecto_id", proyectoId).eq("fecha", fecha).is("archivado_at", null);
  if (count) return { ok: false, error: "Ese día ya tiene plan. Ajusta los bloques a mano." };
  const [{ data: rod }, { data: pl }, { data: es }] = await Promise.all([
    supabase.from("rodaje_escenas").select("escena_id, orden").eq("proyecto_id", proyectoId).eq("dia", fecha),
    supabase.from("planos").select("id, escena_id, numero, descripcion, minutos, orden").eq("proyecto_id", proyectoId).is("archivado_at", null),
    supabase.from("guion_lineas").select("id, texto").eq("proyecto_id", proyectoId).eq("tipo", "escena").is("borrado_at", null).order("orden")
  ]);
  const ordenEscena = new Map((rod ?? []).map((r) => [r.escena_id as string, r.orden as number]));
  const numEscena = new Map((es ?? []).map((e, i) => [e.id as string, i + 1]));
  const planos = (pl ?? [])
    .filter((p) => ordenEscena.has(p.escena_id as string))
    .sort((a, b) => (ordenEscena.get(a.escena_id as string)! - ordenEscena.get(b.escena_id as string)!) || (a.orden as number) - (b.orden as number));
  if (!planos.length) return { ok: false, error: "Ese día no tiene escenas con planos. Asigna escenas en Plan de rodaje y agrega planos." };

  let t = Number(llamado.slice(0, 2)) * 60 + Number(llamado.slice(3));
  const hh = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const filas: Record<string, unknown>[] = [];
  const poner = (titulo: string, tipo: string, minutos: number, plano_id: string | null = null) => {
    filas.push({ proyecto_id: proyectoId, fecha, inicio: hh(t), minutos, titulo, tipo, plano_id });
    t += minutos;
  };
  poner("Llamado general y desayuno", "llamado", 30);
  poner("Montaje de cámara, luz y sonido", "montaje", 45);
  const total = planos.reduce((a, p) => a + (p.minutos as number), 0);
  let llevamos = 0;
  let comida = false;
  for (const p of planos) {
    const n = numEscena.get(p.escena_id as string) ?? 0;
    const letra = String.fromCharCode(64 + Math.min(p.numero as number, 26));
    poner(`Plano ${n}${letra}${p.descripcion ? ` · ${String(p.descripcion).slice(0, 80)}` : ""}`, "toma", p.minutos as number, p.id as string);
    llevamos += p.minutos as number;
    if (!comida && llevamos >= total / 2 && planos.length > 1) {
      poner("Comida", "comida", 60);
      comida = true;
    }
  }
  poner("Cierre, desmontaje y respaldo de material", "cierre", 45);
  const { error } = await supabase.from("plan_dia").insert(filas);
  if (error) return { ok: false, error: sinPermiso };
  tocar(proyectoId);
  return { ok: true, mensaje: `Listo: ${filas.length} bloques. Ajusta horas y duraciones si hace falta.` };
}

// ─── Documentos ──────────────────────────────────────────────────────────
export async function agregarDocumento(proyectoId: string, titulo: string, url: string, soloDireccion: boolean): Promise<Resultado> {
  await requerirSesion();
  const t = titulo.trim();
  const u = url.trim();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  if (!t || t.length > 100) return { ok: false, error: "Ponle nombre, ej. Guion v3 PDF o Moodboard." };
  if (!/^https:\/\/\S+$/.test(u) || u.length > 600) return { ok: false, error: "Pega el link completo, empieza con https:// (Drive, Dropbox, Frame.io)." };
  const supabase = await createClient();
  const { error } = await supabase.from("proyecto_documentos").insert({ proyecto_id: proyectoId, titulo: t, url: u, solo_direccion: soloDireccion });
  if (error) return { ok: false, error: soloDireccion ? "Solo dirección puede subir documentos privados." : "No se guardó el documento." };
  tocar(proyectoId);
  return { ok: true };
}

export async function archivarDocumento(proyectoId: string, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Documento no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("proyecto_documentos").update({ archivado_at: new Date().toISOString() }).eq("id", id).eq("proyecto_id", proyectoId).select("id");
  if (error || !data?.length) return { ok: false, error: "Solo quien lo subió o dirección lo quita." };
  tocar(proyectoId);
  return { ok: true };
}

// ─── Llamados (crew call y casting) ──────────────────────────────────────
export async function guardarLlamado(
  proyectoId: string,
  id: string | null,
  c: { tipo?: "reparto" | "crew"; nombre?: string; rol?: string; user_id?: string | null; fecha?: string | null; llamado?: string | null; telefono?: string; confirmacion?: string }
): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || (id && !UUID.test(id))) return { ok: false, error: "Llamado no válido." };
  const d: Record<string, unknown> = {};
  if (!id || c.tipo !== undefined) {
    if (c.tipo !== "reparto" && c.tipo !== "crew") return { ok: false, error: "¿Es crew o reparto?" };
    d.tipo = c.tipo;
  }
  if (!id || c.nombre !== undefined) {
    const t = (c.nombre ?? "").trim();
    if (!t || t.length > 80) return { ok: false, error: c.tipo === "reparto" ? "Escribe el nombre, o Por definir si aún no hay." : "Escribe el nombre." };
    d.nombre = t;
  }
  if (!id || c.rol !== undefined) {
    const t = (c.rol ?? "").trim();
    if (!t || t.length > 80) return { ok: false, error: c.tipo === "reparto" ? "¿Qué personaje hace?" : "¿Qué puesto tiene?" };
    d.rol = d.tipo === "reparto" || c.tipo === "reparto" ? t.toUpperCase() : t;
  }
  if (c.user_id !== undefined) {
    if (c.user_id && !UUID.test(c.user_id)) return { ok: false, error: "Persona no válida." };
    d.user_id = c.user_id || null;
  }
  if (c.fecha !== undefined) {
    if (c.fecha && !esFechaISO(c.fecha)) return { ok: false, error: "Fecha no válida." };
    d.fecha = c.fecha || null;
  }
  if (c.llamado !== undefined) {
    if (c.llamado && !HORA.test(c.llamado)) return { ok: false, error: "Hora de llamado no válida." };
    d.llamado = c.llamado || null;
  }
  if (c.telefono !== undefined) {
    const t = c.telefono.trim();
    if (t && !/^[+\d\s()-]{7,40}$/.test(t)) return { ok: false, error: "El teléfono no es válido. Ej. 55 1234 5678." };
    d.telefono = t || null;
  }
  if (c.confirmacion !== undefined) {
    if (!["falta", "pendiente", "confirmado", "no_puede"].includes(c.confirmacion)) return { ok: false, error: "Estado no válido." };
    d.confirmacion = c.confirmacion;
    d.confirmado_en = c.confirmacion === "confirmado" || c.confirmacion === "no_puede" ? new Date().toISOString() : null;
  }
  // Cambió la hora o el día: hay que volver a confirmar.
  if (id && (c.fecha !== undefined || c.llamado !== undefined) && c.confirmacion === undefined) {
    d.confirmacion = "pendiente";
    d.confirmado_en = null;
  }
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("personas_proyecto").update(d).eq("id", id).eq("proyecto_id", proyectoId).select("id, user_id, fecha, llamado, rol").maybeSingle()
    : await supabase.from("personas_proyecto").insert({ proyecto_id: proyectoId, ...d }).select("id, user_id, fecha, llamado, rol").maybeSingle();
  if (error || !data) return { ok: false, error: sinPermiso };
  // Al compañero ligado le llega su llamado para confirmar.
  const avisar = data.user_id && data.user_id !== s.userId && (c.user_id !== undefined || c.fecha !== undefined || c.llamado !== undefined);
  if (avisar && data.fecha && data.llamado) {
    const nombre = await nombreProyecto(supabase, proyectoId);
    await notificar(data.user_id as string, {
      titulo: `Llamado: ${nombre}`,
      cuerpo: `${String(data.fecha).split("-").reverse().join("/")} a las ${String(data.llamado).slice(0, 5)} · ${data.rol}. Confírmalo en la app.`,
      href: `/app/estudio/proyectos/${proyectoId}?v=llamados`,
      categoria: "operativo"
    }).catch(() => {});
  }
  tocar(proyectoId);
  return { ok: true, id: data.id as string };
}

export async function confirmarMiLlamado(proyectoId: string, id: string, valor: "confirmado" | "no_puede"): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id) || !["confirmado", "no_puede"].includes(valor)) return { ok: false, error: "Llamado no válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_llamado", { p_id: id, p_valor: valor });
  if (error) return { ok: false, error: "Ese llamado no es tuyo." };
  // Le avisamos a producción y dirección.
  const { data: jefes } = await supabase.from("proyecto_miembros").select("user_id").eq("proyecto_id", proyectoId).in("puesto", ["productor", "director", "asistente_direccion"]).is("archivado_at", null);
  const nombre = await nombreProyecto(supabase, proyectoId);
  const quien = s.nombre.split(" ")[0] || "Alguien";
  for (const u of new Set((jefes ?? []).map((j) => j.user_id as string).filter((u) => u !== s.userId))) {
    await notificar(u, { titulo: valor === "confirmado" ? `${quien} confirmó su llamado` : `${quien} NO puede ir`, cuerpo: nombre, href: `/app/estudio/proyectos/${proyectoId}?v=llamados`, categoria: "operativo", urgente: valor === "no_puede" }).catch(() => {});
  }
  tocar(proyectoId);
  return { ok: true };
}
