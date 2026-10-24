"use server";

import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { validarElementos } from "@/lib/claqueta/floorplan";
import type { Resultado } from "../../acciones";

// Floor plan por escena (0027). Con el cliente de sesión: RLS deja guardar
// solo a dirección y fotografía, y solo en escenas de ese mismo proyecto.
//
// No se llama a revalidatePath: el editor guarda solo mientras se trabaja y
// recargar todo el proyecto en cada guardado sería lento en el celular. La
// vista lee lo guardado cada vez que se abre.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function guardarFloorPlan(proyectoId: string, escenaId: string, elementos: unknown): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(escenaId)) return { ok: false, error: "Escena no válida." };
  const v = validarElementos(elementos);
  if (!v.ok) return v;
  const supabase = await createClient();
  // La escena tiene que ser de este proyecto (la base lo vuelve a revisar).
  const { data: escena } = await supabase.from("guion_lineas").select("id").eq("id", escenaId).eq("proyecto_id", proyectoId).eq("tipo", "escena").is("borrado_at", null).maybeSingle();
  if (!escena) return { ok: false, error: "No encontré esa escena en el proyecto." };
  const { data, error } = await supabase
    .from("floor_plans")
    .upsert({ proyecto_id: proyectoId, escena_id: escenaId, elementos: v.elementos, actualizado_por: s.userId, actualizado_en: new Date().toISOString() }, { onConflict: "proyecto_id,escena_id" })
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No se guardó el floor plan. Solo dirección y fotografía lo pueden cambiar." };
  return { ok: true };
}
