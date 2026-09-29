import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sumarDias } from "./fechas";
import type { Linea, Ocupado } from "./estudio";

// Lecturas del Estudio con el cliente de sesión: RLS deja ver solo lo del equipo.

export type Evento = {
  id: string;
  equipo_id: string;
  creado_por: string | null;
  titulo: string;
  tipo: "junta" | "rodaje" | "scouting" | "llamada" | "entrega" | "ensayo" | "otro";
  fecha: string;
  inicio: string;
  fin: string;
  lugar: string | null;
  notas: string | null;
  participantes: string[];
  proyecto_id: string | null;
};

export type Prospecto = {
  id: string;
  clave: string;
  nombre: string;
  zona: string | null;
  giro: string | null;
  apertura: string | null;
  senal: string | null;
  video: string | null;
  angulo: string | null;
  instagram: string | null;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
  contacto: string | null;
  fuentes: { t: string; url: string }[];
  estado: EstadoProspecto;
  responsable: string | null;
  siguiente_paso: string | null;
  siguiente_fecha: string | null;
  notas: string | null;
  ticket: string | null;
  actualizado_por: string | null;
  actualizado_en: string;
};

export const ESTADOS_PROSPECTO = ["pendiente", "contactado", "respondio", "reunion", "cotizado", "cerrado", "descartado"] as const;
export type EstadoProspecto = (typeof ESTADOS_PROSPECTO)[number];

export type Proyecto = {
  id: string;
  equipo_id: string;
  nombre: string;
  tipo: string;
  cliente: string | null;
  prospecto_id: string | null;
  estado: string;
  logline: string | null;
  duracion_seg: number | null;
  creado_en: string;
  imprevistos_pct?: string;
  utilidad_pct?: string;
  con_iva?: boolean;
  precio_cliente?: string | null;
};

const CAMPOS_EVENTO = "id, equipo_id, creado_por, titulo, tipo, fecha, inicio, fin, lugar, notas, participantes, proyecto_id";

// Eventos del equipo entre dos fechas (sin cancelados).
export async function cargarEventos(desde: string, hasta: string): Promise<Evento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select(CAMPOS_EVENTO)
    .is("cancelado_at", null)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha")
    .order("inicio");
  if (error) return [];
  return (data ?? []) as Evento[];
}

// ¿Me toca ir? Vacío = todo el equipo.
export const vaYo = (e: Pick<Evento, "participantes">, yo: string) => e.participantes.length === 0 || e.participantes.includes(yo);

// Horas ocupadas de todo el equipo (clases, fijos, bloques y eventos).
export async function cargarOcupado(equipoId: string, desde: string, dias: number): Promise<Ocupado[]> {
  const supabase = await createClient();
  const hasta = sumarDias(desde, dias - 1);
  const [{ data: rutina }, eventos, { data: miembros }] = await Promise.all([
    supabase.rpc("ocupado_equipo", { p_equipo: equipoId, p_desde: desde, p_hasta: hasta }),
    cargarEventos(desde, hasta),
    supabase.from("equipo_miembros").select("user_id").eq("equipo_id", equipoId)
  ]);
  const todos = (miembros ?? []).map((m) => m.user_id as string);
  const deEventos: Ocupado[] = eventos
    .filter((e) => e.equipo_id === equipoId)
    .flatMap((e) => (e.participantes.length ? e.participantes : todos).map((u) => ({ user_id: u, fecha: e.fecha, inicio: e.inicio, fin: e.fin, tipo: "evento" as const })));
  return [...((rutina ?? []) as Ocupado[]), ...deEventos];
}

export async function cargarProspectos(): Promise<Prospecto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospectos")
    .select("id, clave, nombre, zona, giro, apertura, senal, video, angulo, instagram, email, telefono, whatsapp, direccion, contacto, fuentes, estado, responsable, siguiente_paso, siguiente_fecha, notas, ticket, actualizado_por, actualizado_en")
    .order("creado_en");
  if (error) throw new Error(`No se pudo leer el Radar: ${error.message}`);
  return (data ?? []) as Prospecto[];
}

export async function cargarProyectos(): Promise<Proyecto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proyectos")
    .select("id, equipo_id, nombre, tipo, cliente, prospecto_id, estado, logline, duracion_seg, creado_en")
    .is("archivado_at", null)
    .order("creado_en", { ascending: false });
  return (data ?? []) as Proyecto[];
}

export type Desglose = { id: string; escena_id: string | null; categoria: string; elemento: string; nota: string | null };
export type RodajeEscena = { escena_id: string; dia: string | null; orden: number; llamado: string | null };
export type Plano = { id: string; escena_id: string; numero: number; tamano: string | null; angulo: string | null; movimiento: string | null; lente: string | null; descripcion: string; minutos: number; filmado: boolean; orden: number };
export type PersonaProyecto = { id: string; tipo: "reparto" | "crew"; nombre: string; rol: string; telefono: string | null; correo: string | null; llamado: string | null; nota: string | null };
export type Locacion = { id: string; lugar: string; direccion: string | null; contacto: string | null; telefono: string | null; permiso: string; estacionamiento: string | null; hospital: string | null; notas: string | null };
export type LineaPres = { id: string; cuenta: string; descripcion: string; cantidad: string; unidad: string; veces: string; tarifa: string; real: string | null; nota: string | null; orden: number };

export async function cargarProyecto(id: string) {
  const supabase = await createClient();
  const [p, l, r, d, pl, pe, lo, pr] = await Promise.all([
    supabase.from("proyectos").select("id, equipo_id, nombre, tipo, cliente, prospecto_id, estado, logline, duracion_seg, creado_en, imprevistos_pct, utilidad_pct, con_iva, precio_cliente").eq("id", id).is("archivado_at", null).maybeSingle(),
    supabase.from("guion_lineas").select("id, orden, tipo, texto").eq("proyecto_id", id).is("borrado_at", null).order("orden"),
    supabase.from("rodaje_escenas").select("escena_id, dia, orden, llamado").eq("proyecto_id", id),
    supabase.from("desglose").select("id, escena_id, categoria, elemento, nota").eq("proyecto_id", id).is("archivado_at", null).order("creado_en"),
    supabase.from("planos").select("id, escena_id, numero, tamano, angulo, movimiento, lente, descripcion, minutos, filmado, orden").eq("proyecto_id", id).is("archivado_at", null).order("orden"),
    supabase.from("personas_proyecto").select("id, tipo, nombre, rol, telefono, correo, llamado, nota").eq("proyecto_id", id).is("archivado_at", null).order("creado_en"),
    supabase.from("locaciones").select("id, lugar, direccion, contacto, telefono, permiso, estacionamiento, hospital, notas").eq("proyecto_id", id).is("archivado_at", null),
    supabase.from("presupuesto_lineas").select("id, cuenta, descripcion, cantidad, unidad, veces, tarifa, real, nota, orden").eq("proyecto_id", id).is("archivado_at", null).order("cuenta").order("orden").order("creado_en")
  ]);
  if (!p.data) return null;
  return {
    proyecto: p.data as Proyecto,
    lineas: (l.data ?? []) as Linea[],
    rodaje: (r.data ?? []) as RodajeEscena[],
    desglose: (d.data ?? []) as Desglose[],
    planos: (pl.data ?? []) as Plano[],
    personas: (pe.data ?? []) as PersonaProyecto[],
    locaciones: (lo.data ?? []) as Locacion[],
    presupuesto: (pr.data ?? []) as LineaPres[]
  };
}
