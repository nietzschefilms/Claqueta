import "server-only";
import type { ReactElement } from "react";
import { Circle, G, Image, Line, Polygon, Rect, Svg, Text, Text as SvgText, View } from "@react-pdf/renderer";
import { ALTO, ANCHO, CUADRO, type Elemento } from "@/lib/claqueta/floorplan";
import type { cargarProyecto, Evento } from "@/lib/claqueta/datos-estudio";
import { escenasDe, paginas, type Escena, type Linea } from "@/lib/claqueta/estudio";
import { idsReparto, nombreCuenta, topsheet, totalLinea } from "@/lib/claqueta/produccion";
import { aCentavos, pesos } from "@/lib/claqueta/dinero";
import { C, e, Hoja, Seccion, Tabla, type Contexto } from "./marca";

// Un PDF por cada vista del proyecto, con la misma plantilla de marca.
// Reciben los datos ya filtrados por permisos (RLS + vistas.ts).

export type Datos = NonNullable<Awaited<ReturnType<typeof cargarProyecto>>>;
export type Extra = { eventos: Evento[]; nombres: Record<string, string>; conContactos: boolean };

export const fechaLarga = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fechaCorta = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "—");
const letra = (n: number) => String.fromCharCode(64 + Math.min(Math.max(n, 1), 26));
const sumarMin = (hora: string, min: number) => {
  const t = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const CONFIRMA: Record<string, string> = { falta: "Falta quién", pendiente: "Sin confirmar", confirmado: "Confirmado", no_puede: "No puede" };

// ─── Guion ──────────────────────────────────────────────────────────────
// Formato de guion (Plex Mono, márgenes de diálogo como en Final Draft).
export function Guion(ctx: Contexto, lineas: Linea[]) {
  const orden = [...lineas].sort((a, b) => a.orden - b.orden);
  let n = 0;
  return (
    <Hoja ctx={ctx}>
      <View style={{ marginTop: 14, fontFamily: "Plex", fontSize: 10, lineHeight: 1.35 }}>
        {orden.map((l) => {
          switch (l.tipo) {
            case "escena":
              n++;
              return (
                <View key={l.id} style={{ flexDirection: "row", marginTop: 14, marginBottom: 4 }} wrap={false} minPresenceAhead={40}>
                  <Text style={{ width: 26, fontWeight: 600, color: C.rojo }}>{n}</Text>
                  <Text style={{ flex: 1, fontWeight: 600, textTransform: "uppercase" }}>{l.texto}</Text>
                </View>
              );
            case "personaje":
              return <Text key={l.id} style={{ marginLeft: 150, marginTop: 8, textTransform: "uppercase" }} minPresenceAhead={24}>{l.texto}</Text>;
            case "parentesis":
              return <Text key={l.id} style={{ marginLeft: 120, marginRight: 120 }}>{l.texto.startsWith("(") ? l.texto : `(${l.texto})`}</Text>;
            case "dialogo":
              return <Text key={l.id} style={{ marginLeft: 90, marginRight: 90 }}>{l.texto}</Text>;
            case "transicion":
              return <Text key={l.id} style={{ textAlign: "right", marginTop: 8, textTransform: "uppercase" }}>{l.texto}</Text>;
            case "nota":
              return (
                <View key={l.id} style={[e.caja, { marginTop: 8, backgroundColor: C.suave, borderColor: C.suave }]}>
                  <Text style={{ fontFamily: "PublicSans", fontSize: 8.5, color: C.gris }}>{l.texto}</Text>
                </View>
              );
            default:
              return <Text key={l.id} style={{ marginTop: 6 }}>{l.texto}</Text>;
          }
        })}
      </View>
    </Hoja>
  );
}

// ─── Shotlist ───────────────────────────────────────────────────────────
export function Shotlist(ctx: Contexto, d: Datos) {
  const escenas = escenasDe(d.lineas);
  const reglas = [d.proyecto.max_planos ? `Máximo ${d.proyecto.max_planos} planos` : null, d.proyecto.movimientos_permitidos?.length ? `Solo ${d.proyecto.movimientos_permitidos.join(", ")}` : null].filter(Boolean);
  const total = d.planos.reduce((a, p) => a + p.minutos, 0);
  return (
    <Hoja ctx={{ ...ctx, horizontal: true, meta: `${d.planos.length} planos · ${total} min de rodaje${reglas.length ? ` · Reglas: ${reglas.join(" · ")}` : ""}` }}>
      {escenas.filter((es) => d.planos.some((p) => p.escena_id === es.id)).map((es) => (
        <Seccion key={es.id} t={`${es.numero} · ${es.texto}`}>
          <Tabla
            columnas={[
              { t: "Plano", w: 0.7, mono: true },
              { t: "Tamaño", w: 1.1 },
              { t: "Ángulo", w: 1.1 },
              { t: "Movimiento", w: 1.1 },
              { t: "Lente", w: 0.8, mono: true },
              { t: "Acción", w: 4 },
              { t: "Min", w: 0.5, mono: true, derecha: true },
              { t: "Filmado", w: 0.8 }
            ]}
            filas={d.planos
              .filter((p) => p.escena_id === es.id)
              .map((p) => {
                const fuera = !!d.proyecto.movimientos_permitidos?.length && !!p.movimiento && !d.proyecto.movimientos_permitidos.includes(p.movimiento);
                return [
                  `${es.numero}${letra(p.numero)}`,
                  p.tamano ?? "—",
                  p.angulo ?? "—",
                  <Text key="m" style={fuera ? e.rojo : {}}>{p.movimiento ?? "—"}</Text>,
                  p.lente ?? "—",
                  p.descripcion || "—",
                  String(p.minutos),
                  p.filmado ? `Sí${p.toma_buena ? ` · T${p.toma_buena}` : ""}` : "—"
                ];
              })}
          />
        </Seccion>
      ))}
      {!d.planos.length && <Text style={e.vacio}>El shotlist está vacío.</Text>}
    </Hoja>
  );
}

// ─── Storyboard ─────────────────────────────────────────────────────────
export function Storyboard(ctx: Contexto, d: Datos) {
  const escenas = escenasDe(d.lineas);
  const num = new Map(escenas.map((x) => [x.id, x.numero]));
  return (
    <Hoja ctx={{ ...ctx, horizontal: true, meta: `${d.planos.length} cuadros` }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12, marginHorizontal: -5 }}>
        {d.planos.map((p) => (
          <View key={p.id} style={{ width: "33.33%", padding: 5 }} wrap={false}>
            <View style={{ height: 130, backgroundColor: C.suave, borderRadius: 3, overflow: "hidden", justifyContent: "center", alignItems: "center" }}>
              {p.imagenUrl ? <Image src={p.imagenUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Text style={e.etiqueta}>Sin cuadro</Text>}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={e.monoFuerte}>{`${num.get(p.escena_id) ?? "?"}${letra(p.numero)}`}</Text>
              <Text style={[e.mono, e.muted, { fontSize: 7.5 }]}>{[p.tamano, p.angulo, p.movimiento].filter(Boolean).join(" · ")}</Text>
            </View>
            <Text style={{ fontSize: 8, marginTop: 2 }}>{p.descripcion}</Text>
          </View>
        ))}
      </View>
      {!d.planos.length && <Text style={e.vacio}>Todavía no hay planos.</Text>}
    </Hoja>
  );
}

// ─── Minuto a minuto ────────────────────────────────────────────────────
export function MinutoAMinuto(ctx: Contexto, d: Datos) {
  const dias = [...new Set(d.planDia.map((b) => b.fecha))].sort();
  return (
    <Hoja ctx={ctx}>
      {dias.map((dia, i) => {
        const bloques = d.planDia.filter((b) => b.fecha === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
        return (
          <Seccion key={dia} t={fechaLarga(dia)} nueva={i > 0}>
            <Tabla
              columnas={[
                { t: "Inicia", w: 0.8, mono: true },
                { t: "Termina", w: 0.8, mono: true },
                { t: "Qué", w: 5 },
                { t: "Min", w: 0.6, mono: true, derecha: true }
              ]}
              filas={bloques.map((b) => [hhmm(b.inicio), sumarMin(b.inicio, b.minutos), <Text key="t" style={b.tipo === "toma" ? e.fuerte : {}}>{b.titulo}</Text>, String(b.minutos)])}
            />
          </Seccion>
        );
      })}
      {!dias.length && <Text style={e.vacio}>Todavía no hay plan minuto a minuto.</Text>}
    </Hoja>
  );
}

// ─── Hoja de llamado ────────────────────────────────────────────────────
export function HojaDeLlamado(ctx: Contexto, d: Datos, x: Extra) {
  const escenas = escenasDe(d.lineas);
  const diaDe = new Map(d.rodaje.map((r) => [r.escena_id, r.dia]));
  const diasRodaje = [...new Set([...d.rodaje.map((r) => r.dia), ...x.eventos.filter((v) => v.tipo === "rodaje").map((v) => v.fecha)].filter((v): v is string => !!v))].sort();
  const ids = idsReparto(escenas);
  return (
    <Hoja ctx={ctx}>
      {diasRodaje.map((dia, i) => {
        const es = escenas.filter((s) => diaDe.get(s.id) === dia);
        const ev = x.eventos.find((v) => v.fecha === dia && v.tipo === "rodaje");
        const personajes = [...new Set(es.flatMap((s) => s.personajes))];
        const actores = d.personas.filter((p) => p.tipo === "reparto" && (p.fecha === dia || !p.fecha));
        const crew = d.personas.filter((p) => p.tipo === "crew" && (p.fecha === dia || !p.fecha));
        const lugares = [...new Set(es.map((s) => s.slug.lugar))];
        const locs = d.locaciones.filter((l) => lugares.includes(l.lugar));
        const bloques = d.planDia.filter((b) => b.fecha === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
        return (
          <View key={dia} break={i > 0}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: C.negro }}>
              <View>
                <Text style={e.etiqueta}>{`Día ${i + 1} de ${diasRodaje.length}`}</Text>
                <Text style={e.subtitulo}>{fechaLarga(dia)}</Text>
                {ev?.lugar ? <Text style={[e.meta, { maxWidth: 330 }]}>{ev.lugar}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontFamily: "Plex", fontWeight: 600, fontSize: 28, color: C.rojo }}>{hhmm(ev?.inicio)}</Text>
                <Text style={e.etiqueta}>Llamado general</Text>
              </View>
            </View>
            {es.length > 0 && (
              <Seccion t="Escenas">
                <Tabla
                  columnas={[
                    { t: "Esc", w: 0.5, mono: true },
                    { t: "Encabezado", w: 4 },
                    { t: "Personajes", w: 2.5 },
                    { t: "Págs", w: 0.7, mono: true, derecha: true }
                  ]}
                  filas={es.map((s) => [String(s.numero), s.texto, s.personajes.map((p) => `${ids.get(p) ?? ""} ${p}`.trim()).join(", ") || "—", paginas(s.octavos)])}
                />
              </Seccion>
            )}
            {(actores.length > 0 || personajes.length > 0) && (
              <Seccion t="Reparto">
                <Tabla
                  columnas={[
                    { t: "Personaje", w: 1.6 },
                    { t: "Actor", w: 2 },
                    { t: "Llamado", w: 0.8, mono: true },
                    { t: "Estado", w: 1.2 },
                    ...(x.conContactos ? [{ t: "Teléfono", w: 1.4, mono: true }] : [])
                  ]}
                  filas={actores.map((p) => [p.rol, p.nombre, hhmm(p.llamado), CONFIRMA[p.confirmacion] ?? p.confirmacion, ...(x.conContactos ? [p.telefono ?? "—"] : [])])}
                  vacio={`Personajes: ${personajes.join(", ")}. Aún sin actores.`}
                />
              </Seccion>
            )}
            <Seccion t="Crew">
              <Tabla
                columnas={[
                  { t: "Puesto", w: 1.8 },
                  { t: "Nombre", w: 2 },
                  { t: "Llamado", w: 0.8, mono: true },
                  { t: "Estado", w: 1.2 },
                  ...(x.conContactos ? [{ t: "Teléfono", w: 1.4, mono: true }] : [])
                ]}
                filas={crew.map((p) => [p.rol, p.nombre, hhmm(p.llamado), CONFIRMA[p.confirmacion] ?? p.confirmacion, ...(x.conContactos ? [p.telefono ?? "—"] : [])])}
                vacio="Todavía no hay crew en los llamados."
              />
            </Seccion>
            {bloques.length > 0 && (
              <Seccion t="Minuto a minuto">
                <Tabla columnas={[{ t: "Hora", w: 0.8, mono: true }, { t: "Qué", w: 5 }, { t: "Min", w: 0.6, mono: true, derecha: true }]} filas={bloques.map((b) => [hhmm(b.inicio), b.titulo, String(b.minutos)])} />
              </Seccion>
            )}
            {locs.length > 0 && (
              <Seccion t="Locaciones">
                {locs.map((l) => (
                  <View key={l.id} style={[e.caja, { marginBottom: 6 }]} wrap={false}>
                    <Text style={e.fuerte}>{l.lugar}</Text>
                    {l.direccion ? <Text>{l.direccion}</Text> : null}
                    <Text style={[e.muted, { fontSize: 8 }]}>{[l.estacionamiento && `Estacionamiento: ${l.estacionamiento}`, l.hospital && `Hospital: ${l.hospital}`, x.conContactos && l.contacto && `Contacto: ${l.contacto}${l.telefono ? ` ${l.telefono}` : ""}`].filter(Boolean).join(" · ")}</Text>
                  </View>
                ))}
              </Seccion>
            )}
          </View>
        );
      })}
      {!diasRodaje.length && <Text style={e.vacio}>Primero agenda el día de rodaje o asigna escenas en Plan de rodaje.</Text>}
    </Hoja>
  );
}

// ─── Llamados (crew call y casting) ─────────────────────────────────────
export function Llamados(ctx: Contexto, d: Datos, x: Extra) {
  const fila = (p: Datos["personas"][number]) => [p.tipo === "reparto" ? p.rol : p.nombre, p.tipo === "reparto" ? p.nombre : p.rol, p.fecha ? fechaCorta(p.fecha) : "—", hhmm(p.llamado), CONFIRMA[p.confirmacion] ?? p.confirmacion, ...(x.conContactos ? [p.telefono ?? "—"] : [])];
  const tel = x.conContactos ? [{ t: "Teléfono", w: 1.3, mono: true }] : [];
  const conf = d.personas.filter((p) => p.confirmacion === "confirmado").length;
  return (
    <Hoja ctx={{ ...ctx, meta: `${conf} de ${d.personas.length} confirmados` }}>
      <Seccion t="Crew call">
        <Tabla columnas={[{ t: "Nombre", w: 1.8 }, { t: "Puesto", w: 1.8 }, { t: "Día", w: 1.1 }, { t: "Hora", w: 0.7, mono: true }, { t: "Estado", w: 1.1 }, ...tel]} filas={d.personas.filter((p) => p.tipo === "crew").map(fila)} vacio="Sin crew todavía." />
      </Seccion>
      <Seccion t="Casting y reparto">
        <Tabla columnas={[{ t: "Personaje", w: 1.8 }, { t: "Actor", w: 1.8 }, { t: "Día", w: 1.1 }, { t: "Hora", w: 0.7, mono: true }, { t: "Estado", w: 1.1 }, ...tel]} filas={d.personas.filter((p) => p.tipo === "reparto").map(fila)} vacio="Sin papeles todavía." />
      </Seccion>
    </Hoja>
  );
}

// ─── Reporte diario ─────────────────────────────────────────────────────
export function Reporte(ctx: Contexto, d: Datos) {
  const escenas = escenasDe(d.lineas);
  const num = new Map(escenas.map((x) => [x.id, x.numero]));
  return (
    <Hoja ctx={ctx}>
      {d.reportes.map((r, i) => {
        const filmados = d.planos.filter((p) => p.filmado_en === r.fecha);
        return (
          <Seccion key={r.id} t={fechaLarga(r.fecha)} nueva={i > 0}>
            <Tabla
              columnas={[{ t: "Llamado", w: 1, mono: true }, { t: "1a toma", w: 1, mono: true }, { t: "Comida", w: 1.4, mono: true }, { t: "Fin", w: 1, mono: true }, { t: "Clima", w: 1.6 }]}
              filas={[[hhmm(r.llamado), hhmm(r.primera_toma), `${hhmm(r.comida_inicio)}–${hhmm(r.comida_fin)}`, hhmm(r.fin), r.clima ?? "—"]]}
            />
            <Text style={[e.etiqueta, { marginTop: 8 }]}>{`Planos filmados (${filmados.length})`}</Text>
            <Text style={{ marginTop: 2 }}>{filmados.map((p) => `${num.get(p.escena_id) ?? "?"}${letra(p.numero)}${p.toma_buena ? ` (T${p.toma_buena})` : ""}`).join(", ") || "—"}</Text>
            {r.incidentes ? (
              <>
                <Text style={[e.etiqueta, { marginTop: 8 }]}>Incidentes</Text>
                <Text>{r.incidentes}</Text>
              </>
            ) : null}
            {r.notas ? (
              <>
                <Text style={[e.etiqueta, { marginTop: 8 }]}>Notas</Text>
                <Text>{r.notas}</Text>
              </>
            ) : null}
          </Seccion>
        );
      })}
      {!d.reportes.length && <Text style={e.vacio}>Todavía no hay reportes de rodaje.</Text>}
    </Hoja>
  );
}

// ─── Desglose ───────────────────────────────────────────────────────────
export function Desglose(ctx: Contexto, d: Datos, nombreCategoria: (c: string) => string) {
  const escenas = escenasDe(d.lineas);
  const grupos: { t: string; items: Datos["desglose"] }[] = [
    ...escenas.map((s) => ({ t: `${s.numero} · ${s.texto}`, items: d.desglose.filter((x) => x.escena_id === s.id) })),
    { t: "Todo el proyecto", items: d.desglose.filter((x) => !x.escena_id) }
  ].filter((g) => g.items.length);
  return (
    <Hoja ctx={ctx}>
      {grupos.map((g) => (
        <Seccion key={g.t} t={g.t}>
          <Tabla columnas={[{ t: "Categoría", w: 1.3 }, { t: "Elemento", w: 3 }, { t: "Nota", w: 2.5 }]} filas={g.items.map((x) => [nombreCategoria(x.categoria), x.elemento, x.nota ?? ""])} />
        </Seccion>
      ))}
      {!grupos.length && <Text style={e.vacio}>El desglose está vacío.</Text>}
    </Hoja>
  );
}

// ─── Plan de rodaje (stripboard) ────────────────────────────────────────
export function PlanRodaje(ctx: Contexto, d: Datos) {
  const escenas = escenasDe(d.lineas);
  const diaDe = new Map(d.rodaje.map((r) => [r.escena_id, r.dia]));
  const dias = [...new Set(d.rodaje.map((r) => r.dia).filter((x): x is string => !!x))].sort();
  const sinDia = escenas.filter((s) => !diaDe.get(s.id));
  const tabla = (es: Escena[]) => (
    <Tabla
      columnas={[{ t: "Esc", w: 0.5, mono: true }, { t: "I/E", w: 0.6 }, { t: "Lugar", w: 2.4 }, { t: "Momento", w: 1 }, { t: "Personajes", w: 2.4 }, { t: "Págs", w: 0.6, mono: true, derecha: true }]}
      filas={es.map((s) => [String(s.numero), s.slug.intExt ?? "—", s.slug.lugar, s.slug.momento ?? "—", s.personajes.join(", ") || "—", paginas(s.octavos)])}
    />
  );
  return (
    <Hoja ctx={{ ...ctx, horizontal: true, meta: `${escenas.length} escenas · ${dias.length} días de rodaje` }}>
      {dias.map((dia) => {
        const es = escenas.filter((s) => diaDe.get(s.id) === dia);
        return (
          <Seccion key={dia} t={`${fechaLarga(dia)} · ${paginas(es.reduce((a, s) => a + s.octavos, 0))} págs`}>
            {tabla(es)}
          </Seccion>
        );
      })}
      {sinDia.length > 0 && <Seccion t="Sin día asignado">{tabla(sinDia)}</Seccion>}
    </Hoja>
  );
}

// ─── Reparto y locaciones ───────────────────────────────────────────────
export function Gente(ctx: Contexto, d: Datos) {
  const ids = idsReparto(escenasDe(d.lineas));
  return (
    <Hoja ctx={ctx}>
      <Seccion t="Reparto">
        <Tabla
          columnas={[{ t: "ID", w: 0.4, mono: true }, { t: "Personaje", w: 1.6 }, { t: "Actor", w: 1.8 }, { t: "Teléfono", w: 1.3, mono: true }, { t: "Correo", w: 2 }]}
          filas={d.personas.filter((p) => p.tipo === "reparto").map((p) => [String(ids.get(p.rol) ?? ""), p.rol, p.nombre, p.telefono ?? "—", p.correo ?? "—"])}
          vacio="Sin reparto todavía."
        />
      </Seccion>
      <Seccion t="Crew">
        <Tabla columnas={[{ t: "Puesto", w: 1.6 }, { t: "Nombre", w: 1.8 }, { t: "Teléfono", w: 1.3, mono: true }, { t: "Correo", w: 2 }]} filas={d.personas.filter((p) => p.tipo === "crew").map((p) => [p.rol, p.nombre, p.telefono ?? "—", p.correo ?? "—"])} vacio="Sin crew todavía." />
      </Seccion>
      <Seccion t="Locaciones">
        {d.locaciones.map((l) => (
          <View key={l.id} style={[e.caja, { marginBottom: 6 }]} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={e.fuerte}>{l.lugar}</Text>
              <Text style={e.chip}>{`Permiso: ${l.permiso}`}</Text>
            </View>
            {l.direccion ? <Text>{l.direccion}</Text> : null}
            <Text style={[e.muted, { fontSize: 8 }]}>{[l.contacto && `Contacto: ${l.contacto}${l.telefono ? ` ${l.telefono}` : ""}`, l.estacionamiento && `Estacionamiento: ${l.estacionamiento}`, l.hospital && `Hospital: ${l.hospital}`, l.notas].filter(Boolean).join(" · ")}</Text>
          </View>
        ))}
        {!d.locaciones.length && <Text style={e.vacio}>Sin locaciones todavía.</Text>}
      </Seccion>
    </Hoja>
  );
}

// ─── Presupuesto (solo productor) ───────────────────────────────────────
export function Presupuesto(ctx: Contexto, d: Datos) {
  const p = d.proyecto;
  const t = topsheet(d.presupuesto, { imprevistos_pct: p.imprevistos_pct ?? 0, utilidad_pct: p.utilidad_pct ?? 0, con_iva: !!p.con_iva, precio_cliente: p.precio_cliente ?? null });
  const renglon = (a: string, b: number, fuerte = false) => (
    <View key={a} style={[e.fila, { justifyContent: "space-between" }]}>
      <Text style={fuerte ? e.fuerte : {}}>{a}</Text>
      <Text style={fuerte ? e.monoFuerte : e.mono}>{pesos(b)}</Text>
    </View>
  );
  return (
    <Hoja ctx={{ ...ctx, meta: p.cliente ? `Cliente: ${p.cliente}` : undefined }}>
      <Seccion t="Resumen (topsheet)">
        {t.porCuenta.map((c) => renglon(`${c.cuenta} · ${c.nombre}`, c.total))}
        {renglon("Costo directo", t.directo, true)}
        {renglon(`Imprevistos (${p.imprevistos_pct ?? 0}%)`, t.imprevistos)}
        {renglon(`Utilidad (${p.utilidad_pct ?? 0}%)`, t.utilidad)}
        {renglon("Precio sugerido", t.precioSugerido, true)}
        {p.con_iva ? renglon("IVA 16%", t.iva) : null}
        {p.con_iva ? renglon("Total con IVA", t.totalConIva, true) : null}
        {t.precio !== null ? renglon("Precio cerrado con el cliente (sin IVA)", t.precio, true) : null}
      </Seccion>
      <Seccion t="Detalle">
        <Tabla
          columnas={[{ t: "Cuenta", w: 1.6 }, { t: "Concepto", w: 2.8 }, { t: "Cant", w: 0.6, mono: true, derecha: true }, { t: "Veces", w: 0.6, mono: true, derecha: true }, { t: "Tarifa", w: 1.1, mono: true, derecha: true }, { t: "Total", w: 1.2, mono: true, derecha: true }]}
          filas={d.presupuesto.map((l) => [nombreCuenta(l.cuenta), `${l.descripcion}${l.unidad ? ` (${l.unidad})` : ""}`, String(l.cantidad), String(l.veces), pesos(aCentavos(l.tarifa) ?? 0), pesos(totalLinea(l))])}
          vacio="El presupuesto está vacío."
        />
      </Seccion>
    </Hoja>
  );
}

// ─── Lineamientos (checklist de la tarea) ───────────────────────────────
export function Lineamientos(ctx: Contexto, d: Datos) {
  const hechos = d.lineamientos.filter((l) => l.cumplido).length;
  return (
    <Hoja ctx={{ ...ctx, meta: `${hechos} de ${d.lineamientos.length} cumplidos` }}>
      <View style={{ marginTop: 12 }}>
        {d.lineamientos.map((l) => (
          <View key={l.id} style={[e.fila, { alignItems: "flex-start" }]} wrap={false}>
            <View style={{ width: 11, height: 11, marginRight: 8, marginTop: 1, borderWidth: 1.2, borderColor: l.cumplido ? C.negro : C.gris, backgroundColor: l.cumplido ? C.negro : C.papel, borderRadius: 2 }} />
            <Text style={{ flex: 1 }}>{l.texto}</Text>
          </View>
        ))}
      </View>
      {!d.lineamientos.length && <Text style={e.vacio}>Este proyecto no tiene lineamientos.</Text>}
    </Hoja>
  );
}

export type Pdf = (ctx: Contexto) => ReactElement;

// ─── Guion técnico (toma por toma, con la foto de "tu toma") ────────────
export function GuionTecnico(ctx: Contexto, d: Datos) {
  const escenas = escenasDe(d.lineas).filter((s) => d.planos.some((p) => p.escena_id === s.id));
  return (
    <Hoja ctx={{ ...ctx, meta: `${d.planos.length} tomas` }}>
      {escenas.map((s) => (
        <Seccion key={s.id} t={`${s.numero} · ${s.texto}`}>
          {d.planos
            .filter((p) => p.escena_id === s.id)
            .map((p) => (
              <View key={p.id} style={[e.fila, { alignItems: "flex-start", paddingVertical: 6 }]} wrap={false}>
                <Text style={[e.monoFuerte, { width: 34, fontSize: 11 }]}>{`${s.numero}${letra(p.numero)}`}</Text>
                <View style={{ width: 128, height: 72, marginRight: 10, backgroundColor: C.suave, borderRadius: 3, overflow: "hidden", justifyContent: "center", alignItems: "center" }}>
                  {p.imagenUrl ? <Image src={p.imagenUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Text style={e.etiqueta}>Sin foto</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    {[p.tamano, p.angulo, p.movimiento, p.lente].filter(Boolean).map((x) => (
                      <Text key={x as string} style={e.chip}>{x as string}</Text>
                    ))}
                  </View>
                  <Text style={{ marginTop: 5 }}>{p.descripcion || "Sin acción escrita."}</Text>
                </View>
              </View>
            ))}
        </Seccion>
      ))}
      {!escenas.length && <Text style={e.vacio}>Todavía no hay tomas en el guion técnico.</Text>}
    </Hoja>
  );
}

// ─── Floor plan (planta vista desde arriba, una hoja por escena) ────────
const rad = (g: number) => (g * Math.PI) / 180;
function DibujoElemento({ x: el }: { x: Elemento }) {
  const rot = `rotate(${el.rot} ${el.x} ${el.y})`;
  switch (el.tipo) {
    case "personaje": {
      const nx = el.x + Math.cos(rad(el.rot)) * 24;
      const ny = el.y + Math.sin(rad(el.rot)) * 24;
      return (
        <G>
          <Polygon points={`${el.x + Math.cos(rad(el.rot - 28)) * 13},${el.y + Math.sin(rad(el.rot - 28)) * 13} ${nx},${ny} ${el.x + Math.cos(rad(el.rot + 28)) * 13},${el.y + Math.sin(rad(el.rot + 28)) * 13}`} fill={C.negro} />
          <Circle cx={el.x} cy={el.y} r={14} fill={C.hueso} stroke={C.negro} strokeWidth={2} />
          <SvgText x={el.x} y={el.y + 30} style={{ fontSize: 11, fontFamily: "PublicSans", fontWeight: 600 }} textAnchor="middle" fill={C.negro}>{el.etiqueta}</SvgText>
        </G>
      );
    }
    case "camara": {
      const fov = el.fov ?? 50;
      const largo = 120;
      const a = `${el.x + Math.cos(rad(el.rot - fov / 2)) * largo},${el.y + Math.sin(rad(el.rot - fov / 2)) * largo}`;
      const b = `${el.x + Math.cos(rad(el.rot + fov / 2)) * largo},${el.y + Math.sin(rad(el.rot + fov / 2)) * largo}`;
      return (
        <G>
          <Polygon points={`${el.x},${el.y} ${a} ${b}`} fill={C.rojo} fillOpacity={0.12} stroke={C.rojo} strokeWidth={1} strokeOpacity={0.5} />
          <G transform={rot}>
            <Rect x={el.x - 14} y={el.y - 10} width={22} height={20} rx={3} fill={C.negro} />
            <Polygon points={`${el.x + 8},${el.y - 6} ${el.x + 18},${el.y - 11} ${el.x + 18},${el.y + 11} ${el.x + 8},${el.y + 6}`} fill={C.negro} />
          </G>
          <Circle cx={el.x - 18} cy={el.y - 18} r={10} fill={C.rojo} />
          <SvgText x={el.x - 18} y={el.y - 14} style={{ fontSize: 10, fontFamily: "Plex", fontWeight: 600 }} textAnchor="middle" fill={C.papel}>{el.numero ? String(el.numero) : "C"}</SvgText>
        </G>
      );
    }
    case "luz":
      return (
        <G>
          <Polygon points={`${el.x},${el.y} ${el.x + Math.cos(rad(el.rot - 20)) * 70},${el.y + Math.sin(rad(el.rot - 20)) * 70} ${el.x + Math.cos(rad(el.rot + 20)) * 70},${el.y + Math.sin(rad(el.rot + 20)) * 70}`} fill="#F5B700" fillOpacity={0.18} />
          <Circle cx={el.x} cy={el.y} r={11} fill="#F5B700" stroke={C.negro} strokeWidth={1.5} />
          {el.etiqueta ? <SvgText x={el.x} y={el.y + 25} style={{ fontSize: 10, fontFamily: "PublicSans" }} textAnchor="middle" fill={C.gris}>{el.etiqueta}</SvgText> : null}
        </G>
      );
    case "mueble": {
      const w = el.w ?? 80;
      const h = el.h ?? 50;
      return (
        <G transform={rot}>
          <Rect x={el.x - w / 2} y={el.y - h / 2} width={w} height={h} fill={C.suave} stroke={C.gris} strokeWidth={1.5} />
          {el.etiqueta ? <SvgText x={el.x} y={el.y + 4} style={{ fontSize: 10, fontFamily: "PublicSans" }} textAnchor="middle" fill={C.gris}>{el.etiqueta}</SvgText> : null}
        </G>
      );
    }
    case "pared":
      return <Line x1={el.x} y1={el.y} x2={el.x2 ?? el.x} y2={el.y2 ?? el.y} stroke={C.negro} strokeWidth={6} strokeLinecap="square" />;
    case "puerta":
      return <Line x1={el.x} y1={el.y} x2={el.x2 ?? el.x} y2={el.y2 ?? el.y} stroke={C.gris} strokeWidth={4} strokeDasharray="6,4" />;
    case "flecha": {
      const x2 = el.x2 ?? el.x;
      const y2 = el.y2 ?? el.y;
      const ang = Math.atan2(y2 - el.y, x2 - el.x);
      const color = el.de === "camara" ? C.rojo : C.negro;
      const p1 = `${x2 - Math.cos(ang - 0.45) * 14},${y2 - Math.sin(ang - 0.45) * 14}`;
      const p2 = `${x2 - Math.cos(ang + 0.45) * 14},${y2 - Math.sin(ang + 0.45) * 14}`;
      return (
        <G>
          <Line x1={el.x} y1={el.y} x2={x2} y2={y2} stroke={color} strokeWidth={2.5} strokeDasharray={el.de === "camara" ? "8,6" : undefined} />
          <Polygon points={`${x2},${y2} ${p1} ${p2}`} fill={color} />
        </G>
      );
    }
    default:
      return null;
  }
}

export function FloorPlan(ctx: Contexto, d: Datos, planes: { escena_id: string; elementos: Elemento[] }[]) {
  const escenas = escenasDe(d.lineas).filter((s) => planes.some((p) => p.escena_id === s.id && p.elementos.length));
  const lineas: ReactElement[] = [];
  for (let x = 0; x <= ANCHO; x += CUADRO) lineas.push(<Line key={`x${x}`} x1={x} y1={0} x2={x} y2={ALTO} stroke={C.linea} strokeWidth={0.6} />);
  for (let y = 0; y <= ALTO; y += CUADRO) lineas.push(<Line key={`y${y}`} x1={0} y1={y} x2={ANCHO} y2={y} stroke={C.linea} strokeWidth={0.6} />);
  return (
    <Hoja ctx={{ ...ctx, horizontal: true, meta: "Planta vista desde arriba · cada cuadro mide unos 50 cm" }}>
      {escenas.map((s, i) => {
        const els = planes.find((p) => p.escena_id === s.id)!.elementos;
        const camaras = els.filter((x) => x.tipo === "camara").sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));
        return (
          <View key={s.id} break={i > 0} wrap={false}>
            <Text style={e.seccion}>{`${s.numero} · ${s.texto}`}</Text>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Svg viewBox={`0 0 ${ANCHO} ${ALTO}`} style={{ width: 520, height: 390, borderWidth: 1, borderColor: C.linea }}>
                <Rect x={0} y={0} width={ANCHO} height={ALTO} fill={C.papel} />
                {lineas}
                {[...els].sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo]).map((x) => (
                  <DibujoElemento key={x.id} x={x} />
                ))}
              </Svg>
              <View style={{ flex: 1 }}>
                <Text style={e.etiqueta}>Cámaras</Text>
                {camaras.map((c) => (
                  <Text key={c.id} style={{ marginTop: 3 }}>{`${c.numero ? `Toma ${c.numero}` : "Cámara"}${c.etiqueta ? ` · ${c.etiqueta}` : ""}`}</Text>
                ))}
                {!camaras.length && <Text style={[e.muted, { marginTop: 3 }]}>Sin cámaras.</Text>}
                <Text style={[e.etiqueta, { marginTop: 12 }]}>Simbología</Text>
                <Text style={{ marginTop: 3, fontSize: 8.5 }}>Círculo con nariz: personaje y hacia dónde mira.</Text>
                <Text style={{ fontSize: 8.5 }}>Cámara negra con número rojo: la toma; el abanico es lo que ve.</Text>
                <Text style={{ fontSize: 8.5 }}>Flecha negra: movimiento de actor. Roja punteada: de cámara.</Text>
                <Text style={{ fontSize: 8.5 }}>Amarillo: luces. Gris: muebles, paredes y puertas.</Text>
              </View>
            </View>
          </View>
        );
      })}
      {!escenas.length && <Text style={e.vacio}>Todavía no hay floor plans.</Text>}
    </Hoja>
  );
}
const ORDEN: Record<Elemento["tipo"], number> = { mueble: 0, pared: 1, puerta: 1, luz: 2, flecha: 3, camara: 4, personaje: 5 };
