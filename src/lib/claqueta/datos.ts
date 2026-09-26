import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sumarDias } from "./fechas";
import type { Bloque, Hito, Tarea } from "./tipos";

// Lecturas con el cliente de sesión: RLS deja ver solo lo propio.

const CAMPOS_TAREA = "id, title, area, due_date, est_minutes, impact, status, done_at, repeat, notes, milestone_id, created_at";

// Pendientes y en curso, más lo hecho en los últimos días (para verlo tachado).
export async function cargarTareas(hoy: string): Promise<Tarea[]> {
  const supabase = await createClient();
  const desde = `${sumarDias(hoy, -2)}T00:00:00Z`;
  const { data, error } = await supabase
    .from("tasks")
    .select(CAMPOS_TAREA)
    .is("archived_at", null)
    .or(`status.neq.hecho,done_at.gte.${desde}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(`No se pudieron leer las tareas: ${error.message}`);
  return (data ?? []) as Tarea[];
}

export async function cargarRutina(): Promise<Bloque[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routine_blocks")
    .select("id, weekday, start_time, end_time, label, kind, areas")
    .order("weekday")
    .order("start_time");
  if (error) throw new Error(`No se pudo leer la rutina: ${error.message}`);
  return (data ?? []) as Bloque[];
}

export async function cargarHitos(project = "ek"): Promise<Hito[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("id, project, week, title, done, done_at")
    .eq("project", project)
    .order("week");
  if (error) throw new Error(`No se pudieron leer los hitos: ${error.message}`);
  return (data ?? []) as Hito[];
}
