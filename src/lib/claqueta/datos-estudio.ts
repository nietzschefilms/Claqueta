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
export type Plano = {
  id: string;
  escena_id: string;
  numero: number;
  tamano: string | null;
  angulo: string | null;
  movimiento: string | null;
  lente: string | null;
  descripcion: string;
  minutos: number;
  filmado: boolean;
  orden: number;
  imagen: string | null;
  tomas: number;
  toma_buena: number | null;
  filmado_en: string | null;
  // Liga firmada (1 h) para ver el cuadro del storyboard.
  imagenUrl?: string | null;
};
export type ReporteRodaje = {
  id: string;
  fecha: string;
  llamado: string | null;
  primera_toma: string | null;
  comida_inicio: string | null;
  comida_fin: string | null;
  fin: string | null;
  clima: string | null;
  incidentes: string | null;
  notas: string | null;
  actualizado_en: string;
};
export type Confirmacion = "falta" | "pendiente" | "confirmado" | "no_puede";
export type PersonaProyecto = {
  id: string;
  tipo: "reparto" | "crew";
  nombre: string;
  rol: string;
  telefono: string | null;
  correo: string | null;
  llamado: string | null;
  nota: string | null;
  user_id: string | null;
  fecha: string | null;
  confirmacion: Confirmacion;
  confirmado_en: string | null;
};
export type MiembroProyecto = { id: string; user_id: string; puesto: string };
export type Avance = { id: string; titulo: string; estado: "falta" | "en_proceso" | "listo"; responsable: string | null; fecha_limite: string | null; nota: string | null; orden: number; actualizado_por: string | null; actualizado_en: string };
export type BloqueDia = { id: string; fecha: string; inicio: string; minutos: number; titulo: string; tipo: string; plano_id: string | null; estado: "pendiente" | "en_curso" | "hecho"; empezo_en: string | null; termino_en: string | null };
export type Publicacion = { id: string; tipo: "guion" | "shotlist" | "llamados"; version: number; contenido: unknown; nota: string | null; publicado_por: string | null; creado_en: string };
export type Documento = { id: string; titulo: string; url: string | null; ruta: string | null; tipo_archivo: string | null; solo_direccion: boolean; creado_por: string | null; creado_en: string };
export type Locacion = { id: string; lugar: string; direccion: string | null; contacto: string | null; telefono: string | null; permiso: string; estacionamiento: string | null; hospital: string | null; notas: string | null };
export type LineaPres = { id: string; cuenta: string; descripcion: string; cantidad: string; unidad: string; veces: string; tarifa: string; real: string | null; nota: string | null; orden: number };

export async function cargarProyecto(id: string) {
  const supabase = await createClient();
  const ultimaPub = (tipo: string) =>
    supabase.from("proyecto_publicaciones").select("id, tipo, version, contenido, nota, publicado_por, creado_en").eq("proyecto_id", id).eq("tipo", tipo).order("version", { ascending: false }).limit(1).maybeSingle();
  const [p, l, r, d, pl, pe, lo, pr, rep, din, mi, av, pd, doc, pubG, pubS, pubL] = await Promise.all([
    supabase.from("proyectos").select("id, equipo_id, nombre, tipo, cliente, prospecto_id, estado, logline, duracion_seg, creado_en").eq("id", id).is("archivado_at", null).maybeSingle(),
    supabase.from("guion_lineas").select("id, orden, tipo, texto").eq("proyecto_id", id).is("borrado_at", null).order("orden"),
    supabase.from("rodaje_escenas").select("escena_id, dia, orden, llamado").eq("proyecto_id", id),
    supabase.from("desglose").select("id, escena_id, categoria, elemento, nota").eq("proyecto_id", id).is("archivado_at", null).order("creado_en"),
    supabase.from("planos").select("id, escena_id, numero, tamano, angulo, movimiento, lente, descripcion, minutos, filmado, orden, imagen, tomas, toma_buena, filmado_en").eq("proyecto_id", id).is("archivado_at", null).order("orden"),
    supabase.from("personas_proyecto").select("id, tipo, nombre, rol, telefono, correo, llamado, nota, user_id, fecha, confirmacion, confirmado_en").eq("proyecto_id", id).is("archivado_at", null).order("creado_en"),
    supabase.from("locaciones").select("id, lugar, direccion, contacto, telefono, permiso, estacionamiento, hospital, notas").eq("proyecto_id", id).is("archivado_at", null),
    supabase.from("presupuesto_lineas").select("id, cuenta, descripcion, cantidad, unidad, veces, tarifa, real, nota, orden").eq("proyecto_id", id).is("archivado_at", null).order("cuenta").order("orden").order("creado_en"),
    supabase.from("reportes_rodaje").select("id, fecha, llamado, primera_toma, comida_inicio, comida_fin, fin, clima, incidentes, notas, actualizado_en").eq("proyecto_id", id).order("fecha"),
    // Precio y utilidad: la base solo los da al productor (y al admin).
    supabase.rpc("proyecto_dinero", { p_proyecto: id }).maybeSingle(),
    supabase.from("proyecto_miembros").select("id, user_id, puesto").eq("proyecto_id", id).is("archivado_at", null).order("creado_en"),
    supabase.from("proyecto_avance").select("id, titulo, estado, responsable, fecha_limite, nota, orden, actualizado_por, actualizado_en").eq("proyecto_id", id).is("archivado_at", null).order("orden").order("creado_en"),
    supabase.from("plan_dia").select("id, fecha, inicio, minutos, titulo, tipo, plano_id, estado, empezo_en, termino_en").eq("proyecto_id", id).is("archivado_at", null).order("fecha").order("inicio"),
    supabase.from("proyecto_documentos").select("id, titulo, url, ruta, tipo_archivo, solo_direccion, creado_por, creado_en").eq("proyecto_id", id).is("archivado_at", null).order("creado_en"),
    ultimaPub("guion"),
    ultimaPub("shotlist"),
    ultimaPub("llamados")
  ]);
  if (!p.data) return null;
  const dinero = (din.data ?? null) as { imprevistos_pct: string | null; utilidad_pct: string | null; con_iva: boolean | null; precio_cliente: string | null } | null;
  // Cuadros del storyboard: ligas firmadas de 1 hora (el bucket es privado).
  const planos = (pl.data ?? []) as Plano[];
  const rutas = planos.map((x) => x.imagen).filter((x): x is string => !!x);
  if (rutas.length) {
    const { data: firmadas } = await supabase.storage.from("storyboard").createSignedUrls(rutas, 3600);
    const url = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
    for (const x of planos) x.imagenUrl = x.imagen ? url.get(x.imagen) ?? null : null;
  }
  // Archivos subidos: ligas firmadas de 1 hora (el bucket es privado).
  const documentos = (doc.data ?? []) as Documento[];
  const rutasDoc = documentos.map((x) => x.ruta).filter((x): x is string => !!x);
  if (rutasDoc.length) {
    const { data: f } = await supabase.storage.from("proyecto-docs").createSignedUrls(rutasDoc, 3600);
    const url = new Map((f ?? []).map((x) => [x.path, x.signedUrl]));
    for (const x of documentos) if (x.ruta) x.url = url.get(x.ruta) ?? null;
  }
  return {
    proyecto: { ...(p.data as Proyecto), ...(dinero ?? {}) } as Proyecto,
    miembros: (mi.data ?? []) as MiembroProyecto[],
    avance: (av.data ?? []) as Avance[],
    planDia: (pd.data ?? []) as BloqueDia[],
    documentos,
    publicado: {
      guion: (pubG.data ?? null) as Publicacion | null,
      shotlist: (pubS.data ?? null) as Publicacion | null,
      llamados: (pubL.data ?? null) as Publicacion | null
    },
    lineas: (l.data ?? []) as Linea[],
    rodaje: (r.data ?? []) as RodajeEscena[],
    desglose: (d.data ?? []) as Desglose[],
    planos,
    personas: (pe.data ?? []) as PersonaProyecto[],
    locaciones: (lo.data ?? []) as Locacion[],
    presupuesto: (pr.data ?? []) as LineaPres[],
    reportes: (rep.data ?? []) as ReporteRodaje[]
  };
}

// HOY · lo de producción que es de una persona: sus llamados que vienen y lo
// que tiene asignado (sin terminar) en cualquier proyecto activo.
export async function cargarMiProduccion(userId: string, hoy: string) {
  const supabase = await createClient();
  const [l, p] = await Promise.all([
    supabase
      .from("personas_proyecto")
      .select("id, proyecto_id, rol, fecha, llamado, confirmacion, proyectos!inner(nombre, archivado_at)")
      .eq("user_id", userId)
      .gte("fecha", hoy)
      .neq("confirmacion", "no_puede")
      .is("archivado_at", null)
      .is("proyectos.archivado_at", null)
      .order("fecha")
      .order("llamado"),
    supabase
      .from("proyecto_avance")
      .select("id, proyecto_id, titulo, estado, fecha_limite, proyectos!inner(nombre, archivado_at)")
      .eq("responsable", userId)
      .neq("estado", "listo")
      .is("archivado_at", null)
      .is("proyectos.archivado_at", null)
      .order("fecha_limite", { nullsFirst: false })
  ]);
  const nombre = (x: { proyectos: unknown }) => {
    const pr = x.proyectos as { nombre: string } | { nombre: string }[] | null;
    return (Array.isArray(pr) ? pr[0]?.nombre : pr?.nombre) ?? "Proyecto";
  };
  return {
    llamados: (l.data ?? []).map((x) => ({ id: x.id as string, proyecto_id: x.proyecto_id as string, proyecto: nombre(x), rol: x.rol as string, fecha: x.fecha as string, llamado: x.llamado as string | null, confirmacion: x.confirmacion as string })),
    pendientes: (p.data ?? []).map((x) => ({ id: x.id as string, proyecto_id: x.proyecto_id as string, proyecto: nombre(x), titulo: x.titulo as string, estado: x.estado as "falta" | "en_proceso", fecha_limite: x.fecha_limite as string | null }))
  };
}
