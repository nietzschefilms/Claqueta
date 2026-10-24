"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { notificar } from "@/lib/notificaciones";
import type { Resultado } from "../../acciones";

// PUBLICAR · dirección trabaja en borrador y con un botón deja una versión fija
// para todo el equipo (guion, shotlist, llamados). Le llega aviso a todos.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = { guion: "el guion", shotlist: "el shotlist", llamados: "los llamados" } as const;
type Tipo = keyof typeof TIPOS;

export async function publicar(proyectoId: string, tipo: Tipo, nota: string): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || !(tipo in TIPOS)) return { ok: false, error: "No se pudo publicar." };
  const n = nota.trim();
  if (n.length > 300) return { ok: false, error: "La nota es muy larga (máx. 300)." };
  const supabase = await createClient();

  let contenido: Record<string, unknown>;
  if (tipo === "guion") {
    const { data } = await supabase.from("guion_lineas").select("tipo, texto").eq("proyecto_id", proyectoId).is("borrado_at", null).order("orden");
    if (!data?.some((l) => l.tipo !== "escena")) return { ok: false, error: "Solo dirección publica el guion (y debe tener texto)." };
    contenido = { lineas: data };
  } else if (tipo === "shotlist") {
    const [{ data: es }, { data: pl }] = await Promise.all([
      supabase.from("guion_lineas").select("id, texto").eq("proyecto_id", proyectoId).eq("tipo", "escena").is("borrado_at", null).order("orden"),
      supabase.from("planos").select("escena_id, numero, tamano, angulo, movimiento, lente, descripcion, minutos, orden").eq("proyecto_id", proyectoId).is("archivado_at", null).order("orden")
    ]);
    if (!pl?.length) return { ok: false, error: "El shotlist está vacío. Agrega planos primero." };
    const escenas = (es ?? []).map((e, i) => ({ numero: i + 1, encabezado: e.texto as string, planos: pl.filter((p) => p.escena_id === e.id).map(({ escena_id: _x, orden: _o, ...p }) => p) })).filter((e) => e.planos.length);
    contenido = { escenas };
  } else {
    const { data } = await supabase.from("personas_proyecto").select("tipo, nombre, rol, fecha, llamado, confirmacion").eq("proyecto_id", proyectoId).is("archivado_at", null).order("tipo").order("fecha").order("llamado");
    if (!data?.length) return { ok: false, error: "No hay llamados todavía." };
    contenido = { personas: data };
  }

  const { data: ult } = await supabase.from("proyecto_publicaciones").select("version").eq("proyecto_id", proyectoId).eq("tipo", tipo).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = ((ult?.version as number) ?? 0) + 1;
  const { error } = await supabase.from("proyecto_publicaciones").insert({ proyecto_id: proyectoId, tipo, version, contenido, nota: n || null, publicado_por: s.userId });
  if (error) return { ok: false, error: tipo === "shotlist" ? "Solo dirección o fotografía publican el shotlist." : "Solo productor, director o asistente de dirección publican esto." };

  // Aviso a todo el equipo del proyecto.
  const { data: pr } = await supabase.from("proyectos").select("nombre, equipo_id").eq("id", proyectoId).maybeSingle();
  const { data: gente } = await supabase.from("equipo_miembros").select("user_id").eq("equipo_id", pr?.equipo_id ?? "");
  const vista = tipo === "guion" ? "guion" : tipo === "shotlist" ? "planos" : "llamados";
  const quien = s.nombre.split(" ")[0] || "Dirección";
  for (const u of new Set((gente ?? []).map((g) => g.user_id as string).filter((u) => u !== s.userId))) {
    await notificar(u, {
      titulo: `${quien} publicó ${TIPOS[tipo]} · v${version}`,
      cuerpo: `${pr?.nombre ?? "Proyecto"}${n ? ` · ${n}` : ""}`,
      href: `/app/estudio/proyectos/${proyectoId}?v=${vista}`,
      categoria: "operativo"
    }).catch(() => {});
  }
  revalidatePath(`/app/estudio/proyectos/${proyectoId}`);
  return { ok: true, mensaje: `Publicado: ${TIPOS[tipo]} versión ${version}. Ya le llegó el aviso al equipo.` };
}
