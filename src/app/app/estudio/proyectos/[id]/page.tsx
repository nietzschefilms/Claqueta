import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarPerfil } from "@/lib/claqueta/datos";
import { cargarEventos, cargarProyecto } from "@/lib/claqueta/datos-estudio";
import { escenasDe, esNoche, paginas } from "@/lib/claqueta/estudio";
import { fechaCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { Guion } from "./Guion";
import { BotonImprimir, DesgloseEscenas, EstadoProyecto, Logline, PlanRodaje } from "./Produccion";
import { nombreCategoria } from "@/lib/claqueta/produccion";
import { Presupuesto } from "./Presupuesto";
import { Gente, ListaPlanos } from "./Rodaje";
import { Storyboard } from "./Storyboard";
import { Reporte } from "./Reporte";
import { idsReparto } from "@/lib/claqueta/produccion";
import { permisosDe } from "@/lib/claqueta/puestos";
import { Resumen } from "./Resumen";
import { Llamados } from "./Llamados";
import { PlanDia } from "./PlanDia";
import { BarraPublicar, GuionPublicado, ShotlistPublicado } from "./Publicar";
import { BotonMiVersion } from "./MiVersion";
import { ClaquetaDigital } from "./Claqueta";
import { Lineamientos, SelectorCategoria } from "./Lineamientos";
import { nombreCategoria as nombreTipoProyecto } from "@/lib/claqueta/lineamientos";

export const metadata: Metadata = { title: "Proyecto" };

// Quién ve cada vista: "todos" (el equipo), "direccion" (productor, director,
// asistente de dirección) o "productor". La base aplica lo mismo con RLS.
// Las vistas se agrupan en 5 secciones para no tener 12 pestañas.
const VISTAS = [
  { v: "resumen", t: "Resumen", s: "Resumen", ve: "todos" },
  { v: "guion", t: "Guion", s: "Guion", ve: "todos" },
  { v: "desglose", t: "Desglose", s: "Guion", ve: "direccion" },
  { v: "planos", t: "Shotlist", s: "Rodaje", ve: "todos" },
  { v: "storyboard", t: "Storyboard", s: "Rodaje", ve: "todos" },
  { v: "plan", t: "Plan de rodaje", s: "Rodaje", ve: "direccion" },
  { v: "dia", t: "Minuto a minuto", s: "Rodaje", ve: "todos" },
  { v: "claqueta", t: "Claqueta", s: "Rodaje", ve: "todos" },
  { v: "llamado", t: "Hoja de llamado", s: "Rodaje", ve: "todos" },
  { v: "reporte", t: "Reporte diario", s: "Rodaje", ve: "todos" },
  { v: "llamados", t: "Llamados", s: "Gente", ve: "todos" },
  { v: "gente", t: "Reparto y locaciones", s: "Gente", ve: "direccion" },
  { v: "presupuesto", t: "Presupuesto", s: "Dinero", ve: "productor" }
] as const;
type Vista = (typeof VISTAS)[number]["v"];
const SECCIONES = ["Resumen", "Guion", "Rodaje", "Gente", "Dinero"] as const;
const DESCRIPCION: Record<string, string> = {
  guion: "Escribe el guion con formato profesional, en vivo",
  desglose: "Lo que necesita cada escena",
  planos: "Cada plano con tamaño, lente y tiempo",
  storyboard: "Un cuadro por plano",
  plan: "Qué escenas se filman cada día",
  dia: "El rodaje minuto a minuto, en vivo",
  claqueta: "La pizarra del set: anota cada toma",
  llamado: "Hoja para imprimir o mandar en PDF",
  reporte: "Lo que pasó en cada día de rodaje",
  llamados: "Crew call y casting con confirmación",
  gente: "Reparto, crew y locaciones",
  presupuesto: "Costos, utilidad y cotización"
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PROYECTO · guion en vivo, desglose, plan de rodaje y hoja de llamado.
export default async function PaginaProyecto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const s = await requerirSesion();
  const { id } = await params;
  const { v } = await searchParams;
  if (!UUID.test(id)) notFound();
  const [datos, perfil] = await Promise.all([cargarProyecto(id), cargarPerfil(s.userId)]);
  if (!datos) notFound();
  const { proyecto, lineas, rodaje, desglose, planos, personas, locaciones, presupuesto } = datos;
  const permisos = permisosDe(datos.miembros.filter((m) => m.user_id === s.userId).map((m) => m.puesto), s.esAdmin);
  const visibles = VISTAS.filter((x) => x.ve === "todos" || (x.ve === "direccion" ? permisos.direccion : permisos.productor));
  const vista: Vista = visibles.some((x) => x.v === v) ? (v as Vista) : "resumen";
  const actual = visibles.find((x) => x.v === vista)!;
  const secciones = SECCIONES.filter((sec) => visibles.some((x) => x.s === sec));
  const subvistas = visibles.filter((x) => x.s === actual.s);
  const hoy = fechaCDMX();
  const miembros = [{ id: s.userId, nombre: perfil.nombre || s.nombre || "Yo" }, ...perfil.companeros.filter((c) => c.equipo_id === proyecto.equipo_id)];
  const nombresPub = Object.fromEntries(miembros.map((m) => [m.id, m.id === s.userId ? "ti" : m.nombre.split(" ")[0]]));
  const nombreDePuesto = (puesto: string) => {
    // Sin ese puesto (proyecto personal): el productor.
    const m = datos.miembros.find((x) => x.puesto === puesto) ?? datos.miembros.find((x) => x.puesto === "productor");
    return m ? (miembros.find((x) => x.id === m.user_id)?.nombre.split(" ")[0] ?? "—") : "—";
  };
  const diasRodaje = [...new Set(rodaje.map((r) => r.dia).filter((d): d is string => !!d))].sort();
  const eventos = vista === "resumen" ? (await cargarEventos(sumarDias(hoy, -60), sumarDias(hoy, 365))).filter((e) => e.proyecto_id === proyecto.id) : [];

  return (
    <div className="space-y-5">
      <div className="aparecer print:hidden">
        <Link href="/app/estudio/proyectos" className="enlace-mono">← Proyectos</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="titulo text-4xl md:text-5xl">{proyecto.nombre}</h2>
            <p className="mt-1 text-sm text-muted">
              {proyecto.visibilidad === "privado" && <span className="mr-2 rounded-full bg-tinta/[0.08] px-2 py-0.5 text-[11px] font-semibold text-tinta">Personal</span>}
              {proyecto.tipo.charAt(0).toUpperCase() + proyecto.tipo.slice(1)}
              {proyecto.cliente ? ` · ${proyecto.cliente}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {permisos.direccion ? (
              <SelectorCategoria proyectoId={proyecto.id} categoria={proyecto.categoria ?? null} />
            ) : (
              proyecto.categoria && <span className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs font-semibold">{nombreTipoProyecto(proyecto.categoria)}</span>
            )}
            <EstadoProyecto id={proyecto.id} estado={proyecto.estado} />
          </div>
        </div>
        <Logline id={proyecto.id} valor={proyecto.logline} />
        <nav aria-label="Secciones del proyecto" className="sin-barra -mx-4 mt-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex w-max min-w-full gap-1 rounded-full bg-tinta/[0.06] p-1 md:min-w-0">
            {secciones.map((sec) => {
              const primera = visibles.find((x) => x.s === sec)!;
              const activa = actual.s === sec;
              return (
                <Link
                  key={sec}
                  href={`/app/estudio/proyectos/${proyecto.id}${primera.v === "resumen" ? "" : `?v=${primera.v}`}`}
                  aria-current={activa ? "page" : undefined}
                  className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${activa ? "bg-tinta text-fondo shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" : "text-muted hover:text-tinta"}`}
                >
                  {sec}
                </Link>
              );
            })}
          </div>
        </nav>
        {subvistas.length > 1 && (
          <nav aria-label={`Herramientas de ${actual.s}`} className="sin-barra -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
            {subvistas.map((x) => (
              <Link
                key={x.v}
                href={`/app/estudio/proyectos/${proyecto.id}?v=${x.v}`}
                aria-current={vista === x.v ? "page" : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${vista === x.v ? "bg-tinta/[0.12] text-tinta" : "text-muted hover:text-tinta"}`}
              >
                {x.t}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {vista === "resumen" && proyecto.visibilidad !== "privado" && proyecto.categoria === "estudiantil" && <BotonMiVersion proyectoId={proyecto.id} />}
      {vista === "resumen" && (proyecto.categoria === "estudiantil" || datos.lineamientos.length > 0) && (
        <Lineamientos proyectoId={proyecto.id} lineamientos={datos.lineamientos} planos={planos} puedeEditar={permisos.direccion} />
      )}
      {vista === "planos" && datos.lineamientos.length > 0 && <Lineamientos proyectoId={proyecto.id} lineamientos={datos.lineamientos} planos={planos} puedeEditar={false} compacto />}
      {vista === "resumen" && (
        <Resumen
          proyectoId={proyecto.id}
          yo={s.userId}
          personas={miembros}
          miembros={datos.miembros}
          avance={datos.avance}
          documentos={datos.documentos}
          eventos={eventos}
          llamados={personas}
          permisos={permisos}
          herramientas={visibles
            .filter((x) => x.v !== "resumen")
            .map((x) => ({
              href: `/app/estudio/proyectos/${proyecto.id}?v=${x.v}`,
              t: x.v === "guion" && !permisos.direccion ? "Guion (publicado)" : x.v === "planos" && !permisos.planos ? "Shotlist (publicado)" : x.t,
              d: x.v === "guion" && !permisos.direccion ? "La última versión que publicó dirección" : x.v === "planos" && !permisos.planos ? "Lo que publicó dirección para filmar" : DESCRIPCION[x.v] ?? "",
              editas: x.v === "planos" || x.v === "storyboard" || x.v === "claqueta" ? permisos.planos : x.v === "presupuesto" ? permisos.productor : x.v === "llamado" ? false : permisos.direccion
            }))}
          hoy={hoy}
        />
      )}
      {vista === "llamados" && permisos.direccion && <BarraPublicar proyectoId={proyecto.id} tipo="llamados" ultima={datos.publicado.llamados} nombres={nombresPub} />}
      {vista === "llamados" && <Llamados proyectoId={proyecto.id} nombre={proyecto.nombre} yo={s.userId} personas={personas} equipo={miembros} diasRodaje={diasRodaje} puedeEditar={permisos.direccion} />}
      {vista === "dia" && <PlanDia proyectoId={proyecto.id} bloques={datos.planDia} diasRodaje={diasRodaje} hoy={hoy} puedeEditar={permisos.direccion} />}
      {vista === "claqueta" && (
        <ClaquetaDigital
          proyectoId={proyecto.id}
          nombre={proyecto.nombre}
          lineas={lineas}
          planos={planos}
          director={nombreDePuesto("director")}
          camara={nombreDePuesto("fotografia")}
          puedeAnotar={permisos.planos}
          hoy={hoy}
        />
      )}
      {vista === "guion" &&
        (permisos.direccion ? (
          <>
            <BarraPublicar proyectoId={proyecto.id} tipo="guion" ultima={datos.publicado.guion} nombres={nombresPub} />
            <Guion proyectoId={proyecto.id} nombreProyecto={proyecto.nombre} inicial={lineas} yo={s.userId} miembros={miembros} />
          </>
        ) : (
          <GuionPublicado ultima={datos.publicado.guion} nombres={nombresPub} proyectoId={proyecto.visibilidad !== "privado" ? proyecto.id : undefined} />
        ))}
      {vista === "desglose" && <DesgloseEscenas proyectoId={proyecto.id} lineas={lineas} desglose={desglose} />}
      {vista === "planos" &&
        (permisos.planos ? (
          <>
            <BarraPublicar proyectoId={proyecto.id} tipo="shotlist" ultima={datos.publicado.shotlist} nombres={nombresPub} />
            <ListaPlanos proyectoId={proyecto.id} lineas={lineas} planos={planos} reglas={{ max: proyecto.max_planos ?? null, permitidos: proyecto.movimientos_permitidos ?? null, editar: permisos.direccion }} />
          </>
        ) : (
          <ShotlistPublicado ultima={datos.publicado.shotlist} nombres={nombresPub} />
        ))}
      {vista === "gente" && <Gente proyectoId={proyecto.id} lineas={lineas} personas={personas} locaciones={locaciones} />}
      {vista === "plan" && <PlanRodaje proyectoId={proyecto.id} lineas={lineas} rodaje={rodaje} planos={planos} hoy={hoy} />}
      {vista === "presupuesto" && (
        <Presupuesto
          proyectoId={proyecto.id}
          nombre={proyecto.nombre}
          cliente={proyecto.cliente}
          inicial={presupuesto}
          ajustesIniciales={{ imprevistos_pct: proyecto.imprevistos_pct ?? "10", utilidad_pct: proyecto.utilidad_pct ?? "20", con_iva: proyecto.con_iva !== false, precio_cliente: proyecto.precio_cliente ?? null }}
        />
      )}
      {vista === "llamado" && <HojasDeLlamado proyectoId={proyecto.id} nombre={proyecto.nombre} cliente={proyecto.cliente} datos={datos} miembros={miembros} hoy={hoy} />}
      {vista === "storyboard" && <Storyboard proyectoId={proyecto.id} nombre={proyecto.nombre} lineas={lineas} planos={planos} />}
      {vista === "reporte" && <VistaReporte datos={datos} hoy={hoy} />}
    </div>
  );
}

// El reporte compara contra lo agendado (hora de fin de cada día de rodaje).
async function VistaReporte({ datos, hoy }: { datos: NonNullable<Awaited<ReturnType<typeof cargarProyecto>>>; hoy: string }) {
  const dias = [...datos.rodaje.map((r) => r.dia), ...datos.reportes.map((r) => r.fecha), hoy].filter((d): d is string => !!d).sort();
  const eventos = (await cargarEventos(dias[0], dias[dias.length - 1])).filter((e) => e.proyecto_id === datos.proyecto.id && e.tipo === "rodaje");
  return (
    <Reporte
      proyectoId={datos.proyecto.id}
      nombre={datos.proyecto.nombre}
      lineas={datos.lineas}
      rodaje={datos.rodaje}
      planos={datos.planos}
      reportes={datos.reportes}
      rodajesAgenda={eventos.map((e) => ({ fecha: e.fecha, inicio: e.inicio, fin: e.fin }))}
      hoy={hoy}
    />
  );
}

// Hoja de llamado por día de rodaje: lista para imprimir o mandar en PDF.
async function HojasDeLlamado({ proyectoId, nombre, cliente, datos, miembros, hoy }: { proyectoId: string; nombre: string; cliente: string | null; datos: NonNullable<Awaited<ReturnType<typeof cargarProyecto>>>; miembros: { id: string; nombre: string }[]; hoy: string }) {
  const escenas = escenasDe(datos.lineas);
  const dia = new Map(datos.rodaje.map((r) => [r.escena_id, r.dia]));
  const dias = [...new Set(datos.rodaje.map((r) => r.dia).filter((d): d is string => !!d))].sort();
  if (!dias.length)
    return (
      <p className="tarjeta text-sm text-muted">
        Primero asigna días en <Link href={`/app/estudio/proyectos/${proyectoId}?v=plan`} className="underline">Plan de rodaje</Link>. Cada día sale con su hoja de llamado.
      </p>
    );
  const eventos = (await cargarEventos(dias[0], sumarDias(dias[dias.length - 1], 0))).filter((e) => e.proyecto_id === proyectoId && e.tipo === "rodaje");

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <BotonImprimir />
      </div>
      <div className="imprimible space-y-10">
        {dias.map((d, n) => {
          const es = escenas.filter((e) => dia.get(e.id) === d);
          const ev = eventos.find((e) => e.fecha === d);
          const reparto = [...new Set(es.flatMap((e) => e.personajes))];
          const items = datos.desglose.filter((x) => es.some((e) => e.id === x.escena_id));
          const cats = [...new Set(items.map((x) => x.categoria))];
          const lugares = [...new Set(es.map((e) => e.slug.lugar))];
          const locs = datos.locaciones.filter((x) => lugares.includes(x.lugar));
          const ids = idsReparto(escenas);
          const actores = datos.personas.filter((p) => p.tipo === "reparto" && reparto.includes(p.rol));
          const crew = datos.personas.filter((p) => p.tipo === "crew");
          const planosDia = datos.planos.filter((p) => es.some((e) => e.id === p.escena_id));
          const minutos = planosDia.reduce((a, p) => a + p.minutos, 0);
          return (
            <article key={d} className="tarjeta break-after-page space-y-5 bg-superficie p-6 text-tinta md:p-8">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-tinta pb-4">
                <div>
                  <p className="etiqueta">Hoja de llamado · día {n + 1} de {dias.length}</p>
                  <h3 className="titulo text-4xl">{nombre}</h3>
                  {cliente && <p className="text-sm text-muted">Cliente: {cliente}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold capitalize">{new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</p>
                  <p className="cifra mt-1 text-3xl font-semibold text-acento">{ev ? ev.inicio.slice(0, 5) : "—"}</p>
                  <p className="etiqueta">Llamado general</p>
                </div>
              </header>
              <section className="grid gap-4 md:grid-cols-2">
                {lugares.map((l) => {
                  const loc = locs.find((x) => x.lugar === l);
                  return (
                    <div key={l}>
                      <h4 className="etiqueta">Locación</h4>
                      <p className="mt-1 font-semibold">{l}</p>
                      {loc?.direccion && (
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(loc.direccion)}`} className="block text-sm underline decoration-tinta/30 underline-offset-2">
                          {loc.direccion}
                        </a>
                      )}
                      {loc?.contacto && <p className="text-sm text-muted">Contacto: {loc.contacto}{loc.telefono ? ` · ${loc.telefono}` : ""}</p>}
                      {loc?.estacionamiento && <p className="text-sm text-muted">Estacionamiento: {loc.estacionamiento}</p>}
                      {loc?.hospital && <p className="text-sm text-muted">Hospital: {loc.hospital}</p>}
                      {loc && loc.permiso !== "aprobado" && loc.permiso !== "no_necesita" && <p className="text-xs font-semibold text-acento">Permiso {loc.permiso}</p>}
                    </div>
                  );
                })}
                {ev?.lugar && <p className="text-sm text-muted">{ev.lugar}</p>}
              </section>
              <section>
                <h4 className="etiqueta">Escenas</h4>
                <table className="mt-2 w-full text-left text-sm">
                  <thead className="text-[11px] uppercase text-muted">
                    <tr>
                      <th className="py-1 pr-2">#</th>
                      <th className="py-1 pr-2">Escena</th>
                      <th className="py-1 pr-2">D/N</th>
                      <th className="py-1 pr-2">Pág.</th>
                      <th className="py-1">Reparto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde/60">
                    {es.map((e) => (
                      <tr key={e.id}>
                        <td className="cifra py-1.5 pr-2">{e.numero}</td>
                        <td className="py-1.5 pr-2 font-mono text-xs uppercase">{e.texto}</td>
                        <td className="py-1.5 pr-2 text-xs">{esNoche(e.slug.momento) ? "N" : "D"}</td>
                        <td className="cifra py-1.5 pr-2 text-xs">{paginas(e.octavos)}</td>
                        <td className="py-1.5 text-xs">{e.personajes.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="cifra mt-2 text-right text-xs text-muted">Total: {paginas(es.reduce((a, e) => a + e.octavos, 0))} pág.</p>
              </section>
              <div className="grid gap-5 md:grid-cols-2">
                <section>
                  <h4 className="etiqueta">Reparto</h4>
                  {reparto.length === 0 ? (
                    <p className="mt-1 text-sm">Sin personajes con diálogo</p>
                  ) : (
                    <table className="mt-1 w-full text-sm">
                      <tbody>
                        {reparto.map((r) => {
                          const a = actores.find((x) => x.rol === r);
                          return (
                            <tr key={r}>
                              <td className="cifra w-6 py-0.5 text-muted">{ids.get(r)}</td>
                              <td className="py-0.5">{r}{a ? ` · ${a.nombre}` : ""}</td>
                              <td className="cifra py-0.5 text-right">{a?.llamado?.slice(0, 5) ?? ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </section>
                <section>
                  <h4 className="etiqueta">Crew</h4>
                  {crew.length === 0 ? (
                    <p className="mt-1 text-sm">{miembros.map((m) => m.nombre).join(" · ")} · Nietzsche Studios</p>
                  ) : (
                    <table className="mt-1 w-full text-sm">
                      <tbody>
                        {crew.map((c) => (
                          <tr key={c.id}>
                            <td className="py-0.5">{c.rol}</td>
                            <td className="py-0.5">{c.nombre}{c.telefono ? ` · ${c.telefono}` : ""}</td>
                            <td className="cifra py-0.5 text-right">{c.llamado?.slice(0, 5) ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              </div>
              {planosDia.length > 0 && (
                <section>
                  <h4 className="etiqueta">Planos del día · ≈ {Math.floor(minutos / 60)} h {minutos % 60} min</h4>
                  <ol className="mt-1 grid gap-x-6 text-sm md:grid-cols-2">
                    {es.flatMap((e) =>
                      datos.planos
                        .filter((p) => p.escena_id === e.id)
                        .sort((a, b) => a.orden - b.orden)
                        .map((p) => (
                          <li key={p.id} className="flex gap-2 py-0.5">
                            <span className="cifra w-10 shrink-0 font-semibold">{e.numero}{String.fromCharCode(64 + Math.min(p.numero, 26))}</span>
                            <span className="cifra w-12 shrink-0 text-muted">{p.tamano ?? ""}</span>
                            <span className="min-w-0 flex-1">{p.descripcion}{p.movimiento ? ` · ${p.movimiento}` : ""}</span>
                          </li>
                        ))
                    )}
                  </ol>
                </section>
              )}
              {cats.length > 0 && (
                <section>
                  <h4 className="etiqueta">Lo que tiene que estar en set</h4>
                  <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                    {cats.map((c) => (
                      <div key={c}>
                        <dt className="text-xs font-semibold">{nombreCategoria(c)}</dt>
                        <dd className="text-muted">{[...new Set(items.filter((x) => x.categoria === c).map((x) => x.elemento))].join(", ")}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {ev?.notas && (
                <section>
                  <h4 className="etiqueta">Notas</h4>
                  <p className="mt-1 text-sm">{ev.notas}</p>
                </section>
              )}
              <footer className="border-t border-borde/60 pt-3 text-[11px] text-muted">Hecha con Claqueta · {hoy.split("-").reverse().join("/")}</footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
