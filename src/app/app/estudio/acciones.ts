"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { esFechaISO, fechaCDMX, horaAMinutos } from "@/lib/claqueta/fechas";
import { notificar } from "@/lib/notificaciones";
import { ESTADOS_PROSPECTO, type EstadoProspecto } from "@/lib/claqueta/datos-estudio";
import { deFountain, escenasDe, sugerirPlan, TIPOS_LINEA, type Linea, type TipoLinea } from "@/lib/claqueta/estudio";

// Todo con el cliente de sesión: RLS deja tocar solo lo del equipo.

export type Resultado = { ok: boolean; error?: string; mensaje?: string; id?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIPOS_EVENTO = ["junta", "rodaje", "scouting", "llamada", "entrega", "ensayo", "otro"];
const refrescar = () => revalidatePath("/app", "layout");

async function companerosDe(supabase: Awaited<ReturnType<typeof createClient>>, equipoId: string, yo: string) {
  const { data } = await supabase.from("equipo_miembros").select("user_id").eq("equipo_id", equipoId);
  return (data ?? []).map((m) => m.user_id as string).filter((u) => u !== yo);
}

// ─── Agenda ──────────────────────────────────────────────────────────────
export async function crearEvento(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const equipo = String(form.get("equipo_id") ?? "");
  const titulo = String(form.get("titulo") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "junta");
  const fecha = String(form.get("fecha") ?? "");
  const inicio = String(form.get("inicio") ?? "");
  const fin = String(form.get("fin") ?? "");
  const lugar = String(form.get("lugar") ?? "").trim();
  const notas = String(form.get("notas") ?? "").trim();
  const proyecto = String(form.get("proyecto_id") ?? "");
  const participantes = form.getAll("participantes").map(String).filter((x) => UUID.test(x));

  if (!UUID.test(equipo)) return { ok: false, error: "No encontré tu equipo." };
  if (!titulo || titulo.length > 100) return { ok: false, error: "Ponle nombre, ej. Junta con Bribona." };
  if (!TIPOS_EVENTO.includes(tipo)) return { ok: false, error: "Elige qué tipo de cita es." };
  if (!esFechaISO(fecha)) return { ok: false, error: "Elige la fecha en el calendario." };
  if (fecha < fechaCDMX()) return { ok: false, error: "Esa fecha ya pasó." };
  if (!HORA.test(inicio) || !HORA.test(fin)) return { ok: false, error: "Escribe la hora de inicio y de fin." };
  if (horaAMinutos(fin) <= horaAMinutos(inicio)) return { ok: false, error: "La hora de fin debe ser después del inicio." };
  if (lugar.length > 120 || notas.length > 1000) return { ok: false, error: "El lugar o las notas son muy largos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .insert({
      equipo_id: equipo,
      creado_por: s.userId,
      titulo,
      tipo,
      fecha,
      inicio,
      fin,
      lugar: lugar || null,
      notas: notas || null,
      participantes,
      proyecto_id: UUID.test(proyecto) ? proyecto : null
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "No se agendó. Revisa tu conexión e inténtalo de nuevo." };

  // Aviso a quien va (menos a mí).
  const van = participantes.length ? participantes.filter((u) => u !== s.userId) : await companerosDe(supabase, equipo, s.userId);
  const quien = s.nombre.split(" ")[0] || "Tu equipo";
  for (const u of van) {
    await notificar(u, { titulo: `${quien} agendó: ${titulo}`, cuerpo: `${fecha.split("-").reverse().join("/")} · ${inicio} a ${fin}${lugar ? ` · ${lugar}` : ""}`, href: "/app/estudio", categoria: "operativo" }).catch(() => {});
  }
  refrescar();
  return { ok: true, id: data.id as string, mensaje: "Agendado. Les sale a los dos en su día." };
}

export async function cancelarEvento(id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Cita no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").update({ cancelado_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo cancelar." };
  refrescar();
  return { ok: true };
}

// ─── Radar ───────────────────────────────────────────────────────────────
export async function actualizarProspecto(
  id: string,
  cambios: { estado?: EstadoProspecto; responsable?: string | null; siguiente_paso?: string | null; siguiente_fecha?: string | null; notas?: string | null }
): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Prospecto no válido." };
  const patch: Record<string, unknown> = {};
  if (cambios.estado !== undefined) {
    if (!ESTADOS_PROSPECTO.includes(cambios.estado)) return { ok: false, error: "Estado no válido." };
    patch.estado = cambios.estado;
  }
  if (cambios.responsable !== undefined) {
    if (cambios.responsable !== null && !UUID.test(cambios.responsable)) return { ok: false, error: "Responsable no válido." };
    patch.responsable = cambios.responsable;
  }
  if (cambios.siguiente_paso !== undefined) {
    const t = (cambios.siguiente_paso ?? "").trim();
    if (t.length > 200) return { ok: false, error: "El siguiente paso es muy largo." };
    patch.siguiente_paso = t || null;
  }
  if (cambios.siguiente_fecha !== undefined) {
    if (cambios.siguiente_fecha && !esFechaISO(cambios.siguiente_fecha)) return { ok: false, error: "Fecha no válida." };
    patch.siguiente_fecha = cambios.siguiente_fecha || null;
  }
  if (cambios.notas !== undefined) {
    const t = (cambios.notas ?? "").trim();
    if (t.length > 2000) return { ok: false, error: "Las notas son muy largas." };
    patch.notas = t || null;
  }
  const supabase = await createClient();
  const { data: antes } = await supabase.from("prospectos").select("nombre, responsable").eq("id", id).maybeSingle();
  if (!antes) return { ok: false, error: "No encontré ese prospecto." };
  const { error } = await supabase.from("prospectos").update(patch).eq("id", id);
  if (error) return { ok: false, error: "No se guardó. Inténtalo de nuevo." };
  // Si se lo pasas a tu compañero, le avisa.
  if (patch.responsable && patch.responsable !== s.userId && patch.responsable !== antes.responsable) {
    await notificar(patch.responsable as string, { titulo: `${s.nombre.split(" ")[0] || "Tu equipo"} te pasó un prospecto`, cuerpo: antes.nombre as string, href: "/app/estudio/radar", categoria: "operativo" }).catch(() => {});
  }
  revalidatePath("/app/estudio", "layout");
  return { ok: true };
}

export async function crearProspecto(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  await requerirSesion();
  const equipo = String(form.get("equipo_id") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();
  const zona = String(form.get("zona") ?? "").trim();
  const giro = String(form.get("giro") ?? "").trim();
  const ig = String(form.get("instagram") ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
  const angulo = String(form.get("angulo") ?? "").trim();
  if (!UUID.test(equipo)) return { ok: false, error: "No encontré tu equipo." };
  if (!nombre || nombre.length > 80) return { ok: false, error: "Escribe el nombre del negocio." };
  if (ig && !/^[A-Za-z0-9._]{1,40}$/.test(ig)) return { ok: false, error: "El Instagram no es válido. Escribe solo el usuario, ej. bribona_mx" };
  const clave = `${nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}-${Date.now().toString(36).slice(-5)}`;
  const supabase = await createClient();
  const { error } = await supabase.from("prospectos").insert({
    equipo_id: equipo,
    clave,
    nombre,
    zona: zona || null,
    giro: giro || null,
    instagram: ig || null,
    angulo: angulo || null,
    apertura: "Nuevo",
    ticket: 14000
  });
  if (error) return { ok: false, error: "No se guardó el prospecto. Inténtalo de nuevo." };
  revalidatePath("/app/estudio", "layout");
  return { ok: true, mensaje: `${nombre} entró al Radar.` };
}

// ─── Proyectos ───────────────────────────────────────────────────────────
const PLANTILLA: { tipo: TipoLinea; texto: string }[] = [
  { tipo: "escena", texto: "INT. LUGAR - DÍA" },
  { tipo: "accion", texto: "" }
];

export async function crearProyecto(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const equipo = String(form.get("equipo_id") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "spot");
  const cliente = String(form.get("cliente") ?? "").trim();
  const prospecto = String(form.get("prospecto_id") ?? "");
  if (!UUID.test(equipo)) return { ok: false, error: "No encontré tu equipo." };
  if (!nombre || nombre.length > 100) return { ok: false, error: "Ponle nombre al proyecto." };
  if (!["spot", "corto", "videoclip", "documental", "serie", "otro"].includes(tipo)) return { ok: false, error: "Elige el tipo de proyecto." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyectos")
    .insert({ equipo_id: equipo, nombre, tipo, cliente: cliente || null, prospecto_id: UUID.test(prospecto) ? prospecto : null, creado_por: s.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se creó el proyecto. Inténtalo de nuevo." };
  await supabase.from("guion_lineas").insert(PLANTILLA.map((l, i) => ({ proyecto_id: data.id, orden: (i + 1) * 1024, tipo: l.tipo, texto: l.texto })));
  revalidatePath("/app/estudio", "layout");
  return { ok: true, id: data.id as string };
}

export async function editarProyecto(id: string, cambios: { nombre?: string; logline?: string; estado?: string; cliente?: string }): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Proyecto no válido." };
  const patch: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) {
    const n = cambios.nombre.trim();
    if (!n || n.length > 100) return { ok: false, error: "El nombre va de 1 a 100 letras." };
    patch.nombre = n;
  }
  if (cambios.logline !== undefined) {
    if (cambios.logline.length > 400) return { ok: false, error: "El logline es muy largo (máx. 400)." };
    patch.logline = cambios.logline.trim() || null;
  }
  if (cambios.cliente !== undefined) patch.cliente = cambios.cliente.trim().slice(0, 100) || null;
  if (cambios.estado !== undefined) {
    if (!["idea", "preproduccion", "rodaje", "post", "entregado"].includes(cambios.estado)) return { ok: false, error: "Estado no válido." };
    patch.estado = cambios.estado;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("proyectos").update(patch).eq("id", id);
  if (error) return { ok: false, error: "No se guardó." };
  revalidatePath(`/app/estudio/proyectos/${id}`);
  return { ok: true };
}

export async function archivarProyecto(id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Proyecto no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("proyectos").update({ archivado_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo archivar." };
  revalidatePath("/app/estudio", "layout");
  return { ok: true };
}

// Pegar un guion en Fountain (Final Draft, Highland, WriterSolo lo exportan): se agrega al final.
export async function importarFountain(proyectoId: string, texto: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  if (texto.length > 400_000) return { ok: false, error: "El guion es demasiado largo para pegarlo de una vez." };
  const lineas = deFountain(texto).filter((l) => TIPOS_LINEA.includes(l.tipo)).map((l) => ({ ...l, texto: l.texto.slice(0, 4000) }));
  if (!lineas.length) return { ok: false, error: "No encontré texto de guion. Pega el contenido del archivo .fountain o el texto del guion." };
  const supabase = await createClient();
  const { data: ultima } = await supabase.from("guion_lineas").select("orden").eq("proyecto_id", proyectoId).is("borrado_at", null).order("orden", { ascending: false }).limit(1).maybeSingle();
  const base = (ultima?.orden as number | undefined) ?? 0;
  const filas = lineas.map((l, i) => ({ proyecto_id: proyectoId, orden: base + (i + 1) * 1024, tipo: l.tipo, texto: l.texto }));
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await supabase.from("guion_lineas").insert(filas.slice(i, i + 500));
    if (error) return { ok: false, error: "No se pudo importar todo el guion. Inténtalo de nuevo." };
  }
  revalidatePath(`/app/estudio/proyectos/${proyectoId}`);
  return { ok: true, mensaje: `Importé ${lineas.length} elementos.` };
}

// ─── Plan de rodaje ──────────────────────────────────────────────────────
export async function asignarDia(proyectoId: string, escenaId: string, dia: string | null, llamado?: string | null): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(escenaId)) return { ok: false, error: "Escena no válida." };
  if (dia && !esFechaISO(dia)) return { ok: false, error: "Fecha no válida." };
  if (llamado && !HORA.test(llamado)) return { ok: false, error: "Hora de llamado no válida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rodaje_escenas")
    .upsert({ proyecto_id: proyectoId, escena_id: escenaId, dia: dia || null, llamado: llamado || null }, { onConflict: "escena_id" });
  if (error) return { ok: false, error: "No se guardó el día." };
  revalidatePath(`/app/estudio/proyectos/${proyectoId}`);
  return { ok: true };
}

// Arma el plan: junta escenas por locación y luz, llena jornadas y reparte en días desde `inicio`.
export async function planearRodaje(proyectoId: string, inicio: string, paginasPorDia: number): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !esFechaISO(inicio)) return { ok: false, error: "Elige la fecha del primer día de rodaje." };
  if (!(paginasPorDia >= 0.5 && paginasPorDia <= 20)) return { ok: false, error: "Las páginas por día van de 0.5 a 20." };
  const supabase = await createClient();
  const { data } = await supabase.from("guion_lineas").select("id, orden, tipo, texto").eq("proyecto_id", proyectoId).is("borrado_at", null);
  const escenas = escenasDe((data ?? []) as Linea[]);
  if (!escenas.length) return { ok: false, error: "El guion aún no tiene escenas." };
  const plan = sugerirPlan(escenas, Math.round(paginasPorDia * 8));
  const [a, m, d] = inicio.split("-").map(Number);
  const fechaDia = (n: number) => new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
  const filas = escenas.map((e, i) => ({ proyecto_id: proyectoId, escena_id: e.id, dia: fechaDia(plan.get(e.id) ?? 0), orden: i }));
  const { error } = await supabase.from("rodaje_escenas").upsert(filas, { onConflict: "escena_id" });
  if (error) return { ok: false, error: "No se guardó el plan." };
  revalidatePath(`/app/estudio/proyectos/${proyectoId}`);
  const dias = new Set(plan.values()).size;
  return { ok: true, mensaje: `Plan listo: ${escenas.length} escenas en ${dias} ${dias === 1 ? "día" : "días"}.` };
}

// Pone cada día de rodaje en la agenda del equipo (sale en Hoy de los dos).
export async function agendarRodaje(proyectoId: string, llamado: string, horas: number): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(proyectoId) || !HORA.test(llamado)) return { ok: false, error: "Escribe la hora de llamado." };
  if (!(horas >= 1 && horas <= 16)) return { ok: false, error: "La jornada va de 1 a 16 horas." };
  const supabase = await createClient();
  const [{ data: p }, { data: r }, { data: ya }] = await Promise.all([
    supabase.from("proyectos").select("id, equipo_id, nombre").eq("id", proyectoId).maybeSingle(),
    supabase.from("rodaje_escenas").select("dia").eq("proyecto_id", proyectoId).not("dia", "is", null),
    supabase.from("eventos").select("fecha").eq("proyecto_id", proyectoId).eq("tipo", "rodaje").is("cancelado_at", null)
  ]);
  if (!p) return { ok: false, error: "No encontré el proyecto." };
  const agendados = new Set((ya ?? []).map((e) => e.fecha as string));
  const dias = [...new Set((r ?? []).map((x) => x.dia as string))].filter((d) => !agendados.has(d)).sort();
  if (!dias.length) return { ok: true, mensaje: agendados.size ? "Los días de rodaje ya estaban en la agenda." : "Primero asigna días a las escenas." };
  const finMin = Math.min(horaAMinutos(llamado) + horas * 60, 23 * 60 + 59);
  const fin = `${String(Math.floor(finMin / 60)).padStart(2, "0")}:${String(finMin % 60).padStart(2, "0")}`;
  const { error } = await supabase.from("eventos").insert(
    dias.map((fecha, i) => ({ equipo_id: p.equipo_id, creado_por: s.userId, titulo: `Rodaje ${p.nombre}${dias.length > 1 ? ` · día ${i + 1}` : ""}`, tipo: "rodaje", fecha, inicio: llamado, fin, proyecto_id: p.id }))
  );
  if (error) return { ok: false, error: "No se pudo agendar el rodaje." };
  refrescar();
  return { ok: true, mensaje: `Agendé ${dias.length} ${dias.length === 1 ? "día" : "días"} de rodaje para los dos.` };
}

// ─── Desglose ────────────────────────────────────────────────────────────
const CATEGORIAS = ["reparto", "extras", "utileria", "vestuario", "maquillaje", "arte", "vehiculos", "efectos", "sonido", "camara", "locacion", "otro"];

export async function agregarDesglose(proyectoId: string, escenaId: string | null, categoria: string, elemento: string): Promise<Resultado> {
  await requerirSesion();
  const e = elemento.trim();
  if (!UUID.test(proyectoId) || (escenaId && !UUID.test(escenaId))) return { ok: false, error: "Escena no válida." };
  if (!CATEGORIAS.includes(categoria)) return { ok: false, error: "Elige la categoría." };
  if (!e || e.length > 120) return { ok: false, error: "Escribe el elemento (máx. 120 letras)." };
  const supabase = await createClient();
  const { error } = await supabase.from("desglose").insert({ proyecto_id: proyectoId, escena_id: escenaId, categoria, elemento: e });
  if (error) return { ok: false, error: "No se guardó." };
  revalidatePath(`/app/estudio/proyectos/${proyectoId}`);
  return { ok: true };
}

export async function quitarDesglose(proyectoId: string, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id) || !UUID.test(proyectoId)) return { ok: false, error: "Elemento no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("desglose").update({ archivado_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo quitar." };
  revalidatePath(`/app/estudio/proyectos/${proyectoId}`);
  return { ok: true };
}

// Si el orden fraccionario se queda sin espacio entre dos líneas, se renumera todo.
export async function renumerarGuion(proyectoId: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  const supabase = await createClient();
  const { data } = await supabase.from("guion_lineas").select("id, orden").eq("proyecto_id", proyectoId).is("borrado_at", null).order("orden");
  const filas = (data ?? []) as { id: string; orden: number }[];
  for (let i = 0; i < filas.length; i++) {
    const nuevo = (i + 1) * 1024;
    if (filas[i].orden !== nuevo) await supabase.from("guion_lineas").update({ orden: nuevo }).eq("id", filas[i].id);
  }
  return { ok: true };
}

// ─── Producción: presupuesto, planos, gente y locaciones ────────────────
const UNIDADES = ["día", "semana", "hora", "pieza", "fijo", "km", "persona"];
const TAMANOS = ["GPG", "PG", "PC", "PA", "PM", "PMC", "PP", "PPP", "PD", "INSERT", "OTRO"];
const numero = (v: unknown, max: number, decimales = 2) => {
  const t = String(v ?? "").replace(/[$,\s]/g, "");
  if (t === "") return 0;
  if (!new RegExp(`^\\d+(\\.\\d{1,${decimales}})?$`).test(t)) return null;
  const n = Number(t);
  return n <= max ? n : null;
};
const texto = (v: unknown, max: number) => {
  const t = String(v ?? "").trim();
  return t.length <= max ? t : null;
};
const tocarProyecto = (id: string) => revalidatePath(`/app/estudio/proyectos/${id}`);

type CamposLinea = { cuenta?: string; descripcion?: string; cantidad?: string | number; unidad?: string; veces?: string | number; tarifa?: string | number; real?: string | number | null; nota?: string };

function validarLinea(c: CamposLinea, nueva: boolean): { ok: true; datos: Record<string, unknown> } | { ok: false; error: string } {
  const d: Record<string, unknown> = {};
  if (c.cuenta !== undefined || nueva) {
    if (!/^\d{3,4}$/.test(String(c.cuenta ?? ""))) return { ok: false, error: "Elige la cuenta." };
    d.cuenta = c.cuenta;
  }
  if (c.descripcion !== undefined || nueva) {
    const t = texto(c.descripcion, 120);
    if (!t) return { ok: false, error: "Escribe qué es (máx. 120 letras)." };
    d.descripcion = t;
  }
  for (const [k, max] of [["cantidad", 100000], ["veces", 10000], ["tarifa", 10_000_000]] as const) {
    if (c[k] === undefined) continue;
    const n = numero(c[k], max);
    if (n === null) return { ok: false, error: `${k === "tarifa" ? "La tarifa" : k === "cantidad" ? "La cantidad" : "Las veces"} no es válida. Escribe solo el número, con máximo dos decimales.` };
    d[k] = n;
  }
  if (c.unidad !== undefined) {
    if (!UNIDADES.includes(c.unidad)) return { ok: false, error: "Unidad no válida." };
    d.unidad = c.unidad;
  }
  if (c.real !== undefined) {
    if (c.real === null || c.real === "") d.real = null;
    else {
      const n = numero(c.real, 10_000_000);
      if (n === null) return { ok: false, error: "Lo gastado no es válido. Escribe solo el número." };
      d.real = n;
    }
  }
  if (c.nota !== undefined) {
    const t = texto(c.nota, 300);
    if (t === null) return { ok: false, error: "La nota es muy larga." };
    d.nota = t || null;
  }
  return { ok: true, datos: d };
}

export async function agregarLineaPresupuesto(proyectoId: string, c: CamposLinea): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  const v = validarLinea(c, true);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { data, error } = await supabase.from("presupuesto_lineas").insert({ proyecto_id: proyectoId, unidad: "día", ...v.datos }).select("id").single();
  if (error) return { ok: false, error: "No se guardó la línea." };
  tocarProyecto(proyectoId);
  return { ok: true, id: data.id as string };
}

export async function editarLineaPresupuesto(proyectoId: string, id: string, c: CamposLinea): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Línea no válida." };
  const v = validarLinea(c, false);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { error } = await supabase.from("presupuesto_lineas").update(v.datos).eq("id", id).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, error: "No se guardó el cambio." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

export async function archivarLineaPresupuesto(proyectoId: string, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Línea no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("presupuesto_lineas").update({ archivado_at: new Date().toISOString() }).eq("id", id).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, error: "No se pudo quitar." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

// Carga las líneas típicas de un spot (sin montos). Solo si el presupuesto está vacío.
export async function cargarPlantillaPresupuesto(proyectoId: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  const { PLANTILLA_SPOT } = await import("@/lib/claqueta/produccion");
  const supabase = await createClient();
  const { count } = await supabase.from("presupuesto_lineas").select("id", { count: "exact", head: true }).eq("proyecto_id", proyectoId).is("archivado_at", null);
  if (count) return { ok: false, error: "El presupuesto ya tiene líneas." };
  const { error } = await supabase.from("presupuesto_lineas").insert(PLANTILLA_SPOT.map((l, i) => ({ proyecto_id: proyectoId, ...l, veces: 1, tarifa: 0, orden: i })));
  if (error) return { ok: false, error: "No se cargó la plantilla." };
  tocarProyecto(proyectoId);
  return { ok: true, mensaje: "Listo: llena la tarifa de cada línea con la cotización real." };
}

export async function editarTopsheet(proyectoId: string, c: { imprevistos_pct?: string; utilidad_pct?: string; con_iva?: boolean; precio_cliente?: string | null }): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId)) return { ok: false, error: "Proyecto no válido." };
  const d: Record<string, unknown> = {};
  if (c.imprevistos_pct !== undefined) {
    const n = numero(c.imprevistos_pct, 100);
    if (n === null) return { ok: false, error: "Imprevistos va de 0 a 100%." };
    d.imprevistos_pct = n;
  }
  if (c.utilidad_pct !== undefined) {
    const n = numero(c.utilidad_pct, 300);
    if (n === null) return { ok: false, error: "La utilidad va de 0 a 300%." };
    d.utilidad_pct = n;
  }
  if (c.con_iva !== undefined) d.con_iva = !!c.con_iva;
  if (c.precio_cliente !== undefined) {
    if (c.precio_cliente === null || c.precio_cliente === "") d.precio_cliente = null;
    else {
      const n = numero(c.precio_cliente, 100_000_000);
      if (n === null) return { ok: false, error: "El precio no es válido. Escribe solo el número, ej. 14000." };
      d.precio_cliente = n;
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("proyectos").update(d).eq("id", proyectoId);
  if (error) return { ok: false, error: "No se guardó." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

type CamposPlano = { tamano?: string | null; angulo?: string; movimiento?: string; lente?: string; descripcion?: string; minutos?: number; filmado?: boolean; numero?: number; tomas?: number; toma_buena?: number | null };

function validarPlano(c: CamposPlano): { ok: true; datos: Record<string, unknown> } | { ok: false; error: string } {
  const d: Record<string, unknown> = {};
  if (c.tamano !== undefined) {
    if (c.tamano && !TAMANOS.includes(c.tamano)) return { ok: false, error: "Tamaño de plano no válido." };
    d.tamano = c.tamano || null;
  }
  for (const [k, max] of [["angulo", 40], ["movimiento", 40], ["lente", 20]] as const) {
    if (c[k] === undefined) continue;
    const t = texto(c[k], max);
    if (t === null) return { ok: false, error: "Texto muy largo." };
    d[k] = t || null;
  }
  if (c.descripcion !== undefined) {
    const t = texto(c.descripcion, 400);
    if (t === null) return { ok: false, error: "La descripción es muy larga (máx. 400)." };
    d.descripcion = t;
  }
  if (c.minutos !== undefined) {
    if (!Number.isInteger(c.minutos) || c.minutos < 1 || c.minutos > 600) return { ok: false, error: "Los minutos van de 1 a 600." };
    d.minutos = c.minutos;
  }
  if (c.numero !== undefined) {
    if (!Number.isInteger(c.numero) || c.numero < 1 || c.numero > 999) return { ok: false, error: "Número de plano no válido." };
    d.numero = c.numero;
  }
  if (c.filmado !== undefined) {
    d.filmado = !!c.filmado;
    // El día en que se filmó (para el reporte diario).
    d.filmado_en = c.filmado ? fechaCDMX() : null;
  }
  if (c.tomas !== undefined) {
    if (!Number.isInteger(c.tomas) || c.tomas < 0 || c.tomas > 999) return { ok: false, error: "Número de tomas no válido." };
    d.tomas = c.tomas;
  }
  if (c.toma_buena !== undefined) {
    if (c.toma_buena !== null && (!Number.isInteger(c.toma_buena) || c.toma_buena < 1 || c.toma_buena > 999)) return { ok: false, error: "Toma buena no válida." };
    d.toma_buena = c.toma_buena;
  }
  return { ok: true, datos: d };
}

// El cuadro del storyboard ya subido al bucket: se guarda su ruta en el plano.
// La ruta debe ser de ese proyecto y de ese plano (no se aceptan rutas ajenas).
export async function ponerImagenPlano(proyectoId: string, id: string, ruta: string | null): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Plano no válido." };
  if (ruta !== null && !new RegExp(`^${proyectoId}/${id}-\\d{1,16}\\.jpg$`).test(ruta)) return { ok: false, error: "Imagen no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("planos").update({ imagen: ruta }).eq("id", id).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, error: "No se guardó la imagen." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

type CamposReporte = { llamado?: string | null; primera_toma?: string | null; comida_inicio?: string | null; comida_fin?: string | null; fin?: string | null; clima?: string; incidentes?: string; notas?: string };

// Reporte diario: horas reales del día de rodaje, clima, incidentes y notas.
export async function guardarReporte(proyectoId: string, fecha: string, c: CamposReporte): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !esFechaISO(fecha)) return { ok: false, error: "Día no válido." };
  const d: Record<string, unknown> = {};
  for (const k of ["llamado", "primera_toma", "comida_inicio", "comida_fin", "fin"] as const) {
    if (c[k] === undefined) continue;
    if (c[k] && !HORA.test(c[k]!)) return { ok: false, error: "Escribe la hora con el reloj, ej. 08:30." };
    d[k] = c[k] || null;
  }
  for (const [k, max] of [["clima", 80], ["incidentes", 2000], ["notas", 2000]] as const) {
    if (c[k] === undefined) continue;
    const t = texto(c[k], max);
    if (t === null) return { ok: false, error: "El texto es muy largo." };
    d[k] = t || null;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("reportes_rodaje").upsert({ proyecto_id: proyectoId, fecha, ...d, actualizado_en: new Date().toISOString() }, { onConflict: "proyecto_id,fecha" });
  if (error) return { ok: false, error: "No se guardó el reporte." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

export async function agregarPlano(proyectoId: string, escenaId: string, c: CamposPlano): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(escenaId)) return { ok: false, error: "Escena no válida." };
  const v = validarPlano(c);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { count } = await supabase.from("planos").select("id", { count: "exact", head: true }).eq("escena_id", escenaId).is("archivado_at", null);
  const { error } = await supabase.from("planos").insert({ proyecto_id: proyectoId, escena_id: escenaId, numero: (count ?? 0) + 1, orden: (count ?? 0) + 1, ...v.datos });
  if (error) return { ok: false, error: "No se guardó el plano." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

export async function editarPlano(proyectoId: string, id: string, c: CamposPlano): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Plano no válido." };
  const v = validarPlano(c);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { error } = await supabase.from("planos").update(v.datos).eq("id", id).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, error: "No se guardó." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

export async function archivarPlano(proyectoId: string, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Plano no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("planos").update({ archivado_at: new Date().toISOString() }).eq("id", id).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, error: "No se pudo quitar." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

type CamposPersona = { tipo?: "reparto" | "crew"; nombre?: string; rol?: string; telefono?: string; correo?: string; llamado?: string | null; nota?: string };

export async function guardarPersona(proyectoId: string, id: string | null, c: CamposPersona): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || (id && !UUID.test(id))) return { ok: false, error: "Persona no válida." };
  const d: Record<string, unknown> = {};
  if (c.tipo !== undefined || !id) {
    if (c.tipo !== "reparto" && c.tipo !== "crew") return { ok: false, error: "¿Reparto o crew?" };
    d.tipo = c.tipo;
  }
  if (c.nombre !== undefined || !id) {
    const t = texto(c.nombre, 80);
    if (!t) return { ok: false, error: "Escribe el nombre." };
    d.nombre = t;
  }
  if (c.rol !== undefined || !id) {
    const t = texto(c.rol, 80);
    if (!t) return { ok: false, error: c.tipo === "reparto" ? "¿Qué personaje hace?" : "¿Qué puesto tiene? Ej. Fotógrafo, Sonidista." };
    d.rol = c.tipo === "reparto" ? t.toUpperCase() : t;
  }
  if (c.telefono !== undefined) {
    const t = texto(c.telefono, 40);
    if (t === null || (t && !/^[+\d\s()-]{7,40}$/.test(t))) return { ok: false, error: "El teléfono no es válido." };
    d.telefono = t || null;
  }
  if (c.correo !== undefined) {
    const t = texto(c.correo, 120);
    if (t === null || (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))) return { ok: false, error: "El correo no es válido." };
    d.correo = t || null;
  }
  if (c.llamado !== undefined) {
    if (c.llamado && !HORA.test(c.llamado)) return { ok: false, error: "Hora de llamado no válida." };
    d.llamado = c.llamado || null;
  }
  if (c.nota !== undefined) {
    const t = texto(c.nota, 300);
    if (t === null) return { ok: false, error: "La nota es muy larga." };
    d.nota = t || null;
  }
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("personas_proyecto").update(d).eq("id", id).eq("proyecto_id", proyectoId)
    : await supabase.from("personas_proyecto").insert({ proyecto_id: proyectoId, ...d });
  if (error) return { ok: false, error: "No se guardó." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

export async function archivarPersona(proyectoId: string, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || !UUID.test(id)) return { ok: false, error: "Persona no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("personas_proyecto").update({ archivado_at: new Date().toISOString() }).eq("id", id).eq("proyecto_id", proyectoId);
  if (error) return { ok: false, error: "No se pudo quitar." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

type CamposLocacion = { direccion?: string; contacto?: string; telefono?: string; permiso?: string; estacionamiento?: string; hospital?: string; notas?: string };

export async function guardarLocacion(proyectoId: string, lugar: string, c: CamposLocacion): Promise<Resultado> {
  await requerirSesion();
  const l = texto(lugar, 120);
  if (!UUID.test(proyectoId) || !l) return { ok: false, error: "Locación no válida." };
  const d: Record<string, unknown> = {};
  for (const [k, max] of [["direccion", 200], ["contacto", 80], ["telefono", 40], ["estacionamiento", 200], ["hospital", 200], ["notas", 600]] as const) {
    if (c[k] === undefined) continue;
    const t = texto(c[k], max);
    if (t === null) return { ok: false, error: "Texto muy largo." };
    d[k] = t || null;
  }
  if (c.permiso !== undefined) {
    if (!["pendiente", "solicitado", "aprobado", "no_necesita"].includes(c.permiso)) return { ok: false, error: "Estado de permiso no válido." };
    d.permiso = c.permiso;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("locaciones").upsert({ proyecto_id: proyectoId, lugar: l.toUpperCase(), ...d }, { onConflict: "proyecto_id,lugar" });
  if (error) return { ok: false, error: "No se guardó la locación." };
  tocarProyecto(proyectoId);
  return { ok: true };
}

// Orden de las escenas dentro de un día de rodaje (el stripboard).
export async function ordenarDia(proyectoId: string, escenas: string[]): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(proyectoId) || escenas.length > 300 || !escenas.every((x) => UUID.test(x))) return { ok: false, error: "Orden no válido." };
  const supabase = await createClient();
  for (let i = 0; i < escenas.length; i++) {
    const { error } = await supabase.from("rodaje_escenas").update({ orden: i }).eq("proyecto_id", proyectoId).eq("escena_id", escenas[i]);
    if (error) return { ok: false, error: "No se guardó el orden." };
  }
  tocarProyecto(proyectoId);
  return { ok: true };
}
