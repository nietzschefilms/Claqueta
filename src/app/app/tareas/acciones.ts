"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { esFrente } from "@/lib/claqueta/frentes";
import { esFechaISO, fechaCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { siguienteRepeticion } from "@/lib/claqueta/recurrentes";
import type { Estado, Tarea } from "@/lib/claqueta/tipos";
import { notificar } from "@/lib/notificaciones";

// Todo con el cliente de sesión: RLS garantiza que solo se toca lo propio.

export type Resultado = { ok: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS: Estado[] = ["pendiente", "haciendo", "hecho"];

function refrescar() {
  revalidatePath("/app", "layout");
}

// Tarea de equipo: "yo", "dos" (sin asignar), "privada" o el id de un compañero.
// RLS revisa que el equipo sea mío y que el compañero sea del equipo.
function leerPara(form: FormData, userId: string): { equipo_id: string | null; asignada_a: string | null } | null {
  const equipo = String(form.get("equipo_id") ?? "");
  const para = String(form.get("para") ?? "");
  if (!equipo || !para || para === "privada") return { equipo_id: null, asignada_a: null };
  if (!UUID.test(equipo)) return null;
  if (para === "yo") return { equipo_id: equipo, asignada_a: userId };
  if (para === "dos") return { equipo_id: equipo, asignada_a: null };
  if (UUID.test(para)) return { equipo_id: equipo, asignada_a: para };
  return null;
}

// Si le pasas una tarea a tu compañero, le llega el aviso.
async function avisarAsignada(de: string, a: string | null, yo: string, titulo: string) {
  if (!a || a === yo) return;
  await notificar(a, { titulo: `${de.split(" ")[0] || "Tu equipo"} te pasó una tarea`, cuerpo: titulo, href: "/app/tablero", categoria: "operativo" }).catch(() => {});
}

export async function crearTarea(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const title = String(form.get("title") ?? "").trim();
  const area = String(form.get("area") ?? "");
  const due = String(form.get("due_date") ?? "").trim();
  const est = Number(form.get("est_minutes") ?? 30);
  const impact = Number(form.get("impact") ?? 2);
  const repeticion = String(form.get("repeat") ?? "none");
  const semanal = repeticion === "weekly" || repeticion === "daily"; // se repite
  const materia = String(form.get("materia") ?? "").trim();
  const dificultad = Number(form.get("dificultad") ?? 0);

  if (!title) return { ok: false, error: "Escribe qué hay que hacer." };
  if (title.length > 200) return { ok: false, error: "El título es muy largo. Déjalo en menos de 200 letras." };
  if (!esFrente(area)) return { ok: false, error: "Elige a qué frente pertenece." };
  if (due && !esFechaISO(due)) return { ok: false, error: "La fecha no es válida. Elige una del calendario." };
  if (semanal && !due) return { ok: false, error: "Una tarea que se repite necesita fecha para saber desde cuándo." };
  if (!Number.isInteger(est) || est < 5 || est > 720) return { ok: false, error: "El tiempo debe estar entre 5 minutos y 12 horas." };
  if (![1, 2, 3].includes(impact)) return { ok: false, error: "El impacto va de 1 a 3." };
  if (materia.length > 60) return { ok: false, error: "El nombre de la materia es muy largo." };
  if (dificultad && ![1, 2, 3].includes(dificultad)) return { ok: false, error: "La dificultad va de fácil a difícil." };
  const equipo = leerPara(form, s.userId);
  if (!equipo) return { ok: false, error: "No entendí para quién es. Elige una opción de nuevo." };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    user_id: s.userId,
    ...equipo,
    title,
    area,
    due_date: due || null,
    est_minutes: est,
    impact,
    repeat: repeticion === "daily" ? "daily" : repeticion === "weekly" ? "weekly" : "none",
    materia: materia || null,
    dificultad: dificultad || null
  });
  if (error) return { ok: false, error: "No se guardó. Revisa tu conexión e inténtalo de nuevo." };
  await avisarAsignada(s.nombre, equipo.asignada_a, s.userId, title);
  refrescar();
  return { ok: true };
}

// Marca hecho con fecha, o regresa a pendiente. Al completar una semanal nace la siguiente.
async function aplicarEstado(id: string, estado: Estado): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(id) || !ESTADOS.includes(estado)) return { ok: false, error: "Tarea no válida." };
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tasks")
    .select("id, title, area, due_date, est_minutes, impact, status, done_at, repeat, notes, milestone_id, equipo_id, asignada_a")
    .eq("id", id)
    .maybeSingle<Tarea>();
  if (!t) return { ok: false, error: "No encontré esa tarea." };
  if (t.status === estado) return { ok: true };

  const { error } = await supabase
    .from("tasks")
    .update({ status: estado, done_at: estado === "hecho" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: "No se guardó el cambio. Inténtalo de nuevo." };

  if (estado === "hecho") {
    const sig = siguienteRepeticion(t, fechaCDMX());
    if (sig) {
      // Si ya existe (se desmarcó y volvió a marcar), no se duplica.
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("title", sig.title)
        .eq("area", sig.area)
        .eq("due_date", sig.due_date)
        .is("archived_at", null);
      if (!count) await supabase.from("tasks").insert({ user_id: s.userId, ...sig, equipo_id: t.equipo_id ?? null, asignada_a: t.asignada_a ?? null });
    }
  }
  refrescar();
  return { ok: true };
}

export async function alternarHecha(id: string, hecha: boolean): Promise<Resultado> {
  return aplicarEstado(id, hecha ? "hecho" : "pendiente");
}

export async function cambiarEstado(id: string, estado: Estado): Promise<Resultado> {
  return aplicarEstado(id, estado);
}

export async function moverAManana(id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Tarea no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ due_date: sumarDias(fechaCDMX(), 1) }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo mover. Inténtalo de nuevo." };
  refrescar();
  return { ok: true };
}

// Quitar sin hacer: no se borra, se archiva.
export async function quitarTarea(id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Tarea no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo quitar. Inténtalo de nuevo." };
  refrescar();
  return { ok: true };
}

// Editar una tarea: nombre, frente, fecha, tiempo, impacto y si se repite.
export async function editarTarea(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const area = String(form.get("area") ?? "");
  const due = String(form.get("due_date") ?? "").trim();
  const est = Number(form.get("est_minutes") ?? 30);
  const impact = Number(form.get("impact") ?? 2);
  const repeticion = String(form.get("repeat") ?? "none");

  if (!UUID.test(id)) return { ok: false, error: "Tarea no válida." };
  if (!title) return { ok: false, error: "Escribe qué hay que hacer." };
  if (title.length > 200) return { ok: false, error: "El título es muy largo. Déjalo en menos de 200 letras." };
  if (!esFrente(area)) return { ok: false, error: "Elige a qué frente pertenece." };
  if (due && !esFechaISO(due)) return { ok: false, error: "La fecha no es válida. Elige una del calendario." };
  if (!["none", "daily", "weekly"].includes(repeticion)) return { ok: false, error: "Repetición no válida." };
  if (repeticion !== "none" && !due) return { ok: false, error: "Una tarea que se repite necesita fecha para saber desde cuándo." };
  if (!Number.isInteger(est) || est < 5 || est > 720) return { ok: false, error: "El tiempo debe estar entre 5 minutos y 12 horas." };
  if (![1, 2, 3].includes(impact)) return { ok: false, error: "El impacto va de 1 a 3." };
  const equipo = leerPara(form, s.userId);
  if (!equipo) return { ok: false, error: "No entendí para quién es. Elige una opción de nuevo." };

  const supabase = await createClient();
  const { data: antes } = await supabase.from("tasks").select("asignada_a").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("tasks")
    .update({ title, area, due_date: due || null, est_minutes: est, impact, repeat: repeticion, ...equipo })
    .eq("id", id);
  if (error) return { ok: false, error: "No se guardó. Revisa tu conexión e inténtalo de nuevo." };
  if (antes && antes.asignada_a !== equipo.asignada_a) await avisarAsignada(s.nombre, equipo.asignada_a, s.userId, title);
  refrescar();
  return { ok: true };
}
