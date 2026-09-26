"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { esFrente } from "@/lib/claqueta/frentes";
import { horaAMinutos } from "@/lib/claqueta/fechas";

export type Resultado = { ok: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Crea o edita un bloque de la rutina. No deja que se encime con otro del mismo día.
export async function guardarBloque(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const id = String(form.get("id") ?? "");
  const weekday = Number(form.get("weekday"));
  const inicio = String(form.get("inicio") ?? "");
  const fin = String(form.get("fin") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const kind = String(form.get("kind") ?? "focus");
  const areas = String(form.get("areas") ?? "").split(",").filter(Boolean);

  if (id && !UUID.test(id)) return { ok: false, error: "Bloque no válido." };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Día no válido." };
  if (!HORA.test(inicio) || !HORA.test(fin)) return { ok: false, error: "Escribe la hora de inicio y de fin." };
  if (horaAMinutos(fin) <= horaAMinutos(inicio)) return { ok: false, error: "La hora de fin debe ser después de la de inicio." };
  if (!label || label.length > 80) return { ok: false, error: "Ponle un nombre al bloque (máximo 80 letras)." };
  if (kind !== "focus" && kind !== "fixed") return { ok: false, error: "Tipo no válido." };
  if (!areas.every(esFrente)) return { ok: false, error: "Frente no válido." };

  const supabase = await createClient();
  const { data: delDia } = await supabase.from("routine_blocks").select("id, label, start_time, end_time").eq("weekday", weekday);
  const choca = (delDia ?? []).find(
    (b) => b.id !== id && horaAMinutos(inicio) < horaAMinutos(b.end_time) && horaAMinutos(fin) > horaAMinutos(b.start_time)
  );
  if (choca) return { ok: false, error: `Se encima con "${choca.label}" (${String(choca.start_time).slice(0, 5)} a ${String(choca.end_time).slice(0, 5)}). Ajusta las horas.` };

  const datos = { weekday, start_time: inicio, end_time: fin, label, kind, areas: kind === "focus" ? areas : [] };
  const { error } = id
    ? await supabase.from("routine_blocks").update(datos).eq("id", id)
    : await supabase.from("routine_blocks").insert({ user_id: s.userId, ...datos });
  if (error) return { ok: false, error: "No se guardó. Revisa tu conexión e inténtalo de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

// Quitar un bloque de la rutina (es configuración, no historial: sí se borra).
export async function quitarBloque(id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Bloque no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("routine_blocks").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo quitar. Inténtalo de nuevo." };
  revalidatePath("/app", "layout");
  return { ok: true };
}
