import { renderToBuffer } from "@react-pdf/renderer";
import { requerirSesion } from "@/lib/sesion";
import { cargarEventos, cargarFloorPlans, cargarProyecto } from "@/lib/claqueta/datos-estudio";
import { cargarPerfil } from "@/lib/claqueta/datos";
import { lineasConPublicado, type Linea } from "@/lib/claqueta/estudio";
import { fechaCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { permisosDe, type Permisos } from "@/lib/claqueta/puestos";
import { nombreCategoria } from "@/lib/claqueta/produccion";
import * as D from "@/lib/pdf/documentos";
import { fuentesFrescas } from "@/lib/pdf/marca";

// Descarga en PDF de cada vista del proyecto, con la plantilla de marca.
// Los permisos son los mismos de la página (y la base filtra con RLS).
export const runtime = "nodejs";

type Doc = { t: string; ve: "todos" | keyof Permisos };
const DOCS: Record<string, Doc> = {
  guion: { t: "Guion", ve: "todos" },
  shotlist: { t: "Shotlist", ve: "todos" },
  storyboard: { t: "Storyboard", ve: "todos" },
  tecnico: { t: "Guion técnico", ve: "todos" },
  floorplan: { t: "Floor plan", ve: "todos" },
  dia: { t: "Minuto a minuto", ve: "todos" },
  llamado: { t: "Hoja de llamado", ve: "todos" },
  llamados: { t: "Crew call y casting", ve: "todos" },
  reporte: { t: "Reporte de rodaje", ve: "todos" },
  lineamientos: { t: "Lineamientos", ve: "todos" },
  desglose: { t: "Desglose", ve: "direccion" },
  plan: { t: "Plan de rodaje", ve: "direccion" },
  gente: { t: "Reparto y locaciones", ve: "direccion" },
  presupuesto: { t: "Presupuesto", ve: "productor" }
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (t: string, status: number) => new Response(t, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
const archivo = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "documento";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; doc: string }> }) {
  const s = await requerirSesion();
  const { id, doc } = await params;
  const def = DOCS[doc];
  if (!UUID.test(id) || !def) return texto("Ese documento no existe.", 404);
  const [datos, perfil] = await Promise.all([cargarProyecto(id), cargarPerfil(s.userId)]);
  if (!datos) return texto("No encontré el proyecto (o no tienes acceso).", 404);
  const permisos = permisosDe(datos.miembros.filter((m) => m.user_id === s.userId).map((m) => m.puesto), s.esAdmin);
  if (def.ve !== "todos" && !permisos[def.ve]) return texto(def.ve === "productor" ? "Este documento solo lo descarga el productor del proyecto." : "Este documento solo lo descarga dirección del proyecto.", 403);

  // Fuera de dirección: el guion es el publicado (la base no deja leer el borrador).
  const publicadas = ((datos.publicado.guion?.contenido as { lineas?: { tipo: string; texto: string }[] } | null)?.lineas ?? []);
  const lineas: Linea[] = permisos.direccion ? datos.lineas : lineasConPublicado(datos.lineas, publicadas);
  const d = { ...datos, lineas };
  const hoy = fechaCDMX();
  const ctx = {
    proyecto: datos.proyecto.nombre,
    documento: def.t,
    generado: new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).toUpperCase()
  };
  const nombres = Object.fromEntries([{ id: s.userId, nombre: perfil.nombre || s.nombre }, ...perfil.companeros].map((m) => [m.id, m.nombre]));
  const extra = async () => ({ eventos: (await cargarEventos(sumarDias(hoy, -120), sumarDias(hoy, 365))).filter((e) => e.proyecto_id === id), nombres, conContactos: permisos.direccion });

  let pdf;
  switch (doc) {
    case "guion": {
      if (!lineas.some((l) => l.tipo !== "escena")) return texto("Todavía no hay guion publicado para descargar.", 404);
      const pub = datos.publicado.guion;
      pdf = D.Guion({ ...ctx, meta: !permisos.direccion && pub ? `Versión publicada ${pub.version}` : "Borrador de dirección" }, lineas);
      break;
    }
    case "shotlist": pdf = D.Shotlist(ctx, d); break;
    case "storyboard": pdf = D.Storyboard(ctx, d); break;
    case "tecnico": pdf = D.GuionTecnico(ctx, d); break;
    case "floorplan": pdf = D.FloorPlan(ctx, d, (await cargarFloorPlans(id)).planes); break;
    case "dia": pdf = D.MinutoAMinuto(ctx, d); break;
    case "llamado": pdf = D.HojaDeLlamado(ctx, d, await extra()); break;
    case "llamados": pdf = D.Llamados(ctx, d, await extra()); break;
    case "reporte": pdf = D.Reporte(ctx, d); break;
    case "lineamientos": pdf = D.Lineamientos(ctx, d); break;
    case "desglose": pdf = D.Desglose(ctx, d, nombreCategoria); break;
    case "plan": pdf = D.PlanRodaje(ctx, d); break;
    case "gente": pdf = D.Gente(ctx, d); break;
    case "presupuesto": pdf = D.Presupuesto(ctx, d); break;
    default: return texto("Ese documento no existe.", 404);
  }
  fuentesFrescas();
  const buffer = await renderToBuffer(pdf);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${archivo(datos.proyecto.nombre)}_${archivo(def.t)}.pdf"`,
      "cache-control": "private, no-store"
    }
  });
}
