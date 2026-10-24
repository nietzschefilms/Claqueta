import "server-only";
import path from "node:path";
import type { ReactNode } from "react";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Plantilla de marca para todos los PDF del Estudio: hoja blanca para que se
// imprima bien, franja negra arriba con el punto rojo, títulos en Archivo
// condensado, texto en Public Sans y horas/montos en Plex Mono (las mismas
// fuentes de la app, en versiones fijas dentro de ./fuentes).

const FUENTES = path.join(process.cwd(), "src/lib/pdf/fuentes");

Font.register({
  family: "Archivo",
  fonts: [
    { src: path.join(FUENTES, "Archivo-Condensado-ExtraBold.ttf"), fontWeight: 800 },
    { src: path.join(FUENTES, "Archivo-Condensado-Black.ttf"), fontWeight: 900 }
  ]
});
Font.register({
  family: "PublicSans",
  fonts: [
    { src: path.join(FUENTES, "PublicSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FUENTES, "PublicSans-SemiBold.ttf"), fontWeight: 600 }
  ]
});
Font.register({
  family: "Plex",
  fonts: [
    { src: path.join(FUENTES, "IBMPlexMono-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FUENTES, "IBMPlexMono-SemiBold.ttf"), fontWeight: 600 }
  ]
});
// Sin guiones de corte a media palabra.
Font.registerHyphenationCallback((palabra) => [palabra]);

// react-pdf guarda las fuentes ya cargadas entre un PDF y otro, y al armar
// documentos de proyectos distintos en el mismo servidor se comía letras
// ("Ixmu" salía "xmu"). Antes de cada PDF se descartan para que se lean de
// cero (Font.reset() no basta: deja la promesa de carga vieja).
type Fuente = { data: unknown; loadResultPromise: unknown };
export function fuentesFrescas() {
  const familias = Font.getRegisteredFonts() as unknown as Record<string, { sources: Fuente[] }>;
  for (const f of ["Archivo", "PublicSans", "Plex"])
    for (const fuente of familias[f]?.sources ?? []) {
      fuente.data = null;
      fuente.loadResultPromise = null;
    }
}

export const C = { negro: "#0A0A0A", hueso: "#EBE7E0", rojo: "#FF0000", gris: "#6E6A64", linea: "#D9D4CC", suave: "#F4F1EC", papel: "#FFFFFF" };

export const e = StyleSheet.create({
  pagina: { fontFamily: "PublicSans", fontSize: 9.5, color: C.negro, backgroundColor: C.papel, paddingTop: 64, paddingBottom: 46, paddingHorizontal: 36 },
  franja: { position: "absolute", top: 0, left: 0, right: 0, height: 40, backgroundColor: C.negro, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 36 },
  marca: { flexDirection: "row", alignItems: "center" },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.rojo, marginRight: 7 },
  marcaTexto: { fontFamily: "Plex", fontWeight: 600, fontSize: 7.5, letterSpacing: 1.6, color: C.hueso },
  franjaDer: { fontFamily: "Plex", fontSize: 7.5, letterSpacing: 1.4, color: "#B9B4AC" },
  pie: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontFamily: "Plex", fontSize: 7, color: C.gris, letterSpacing: 0.8 },
  etiqueta: { fontFamily: "Plex", fontWeight: 600, fontSize: 7, letterSpacing: 1.6, color: C.gris, textTransform: "uppercase" },
  titulo: { fontFamily: "Archivo", fontWeight: 900, fontSize: 30, lineHeight: 0.95, textTransform: "uppercase", marginTop: 4 },
  subtitulo: { fontFamily: "Archivo", fontWeight: 800, fontSize: 14, textTransform: "uppercase", marginTop: 2 },
  meta: { fontSize: 8.5, color: C.gris, marginTop: 5 },
  seccion: { fontFamily: "Archivo", fontWeight: 900, fontSize: 15, textTransform: "uppercase", marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: C.negro },
  mono: { fontFamily: "Plex" },
  monoFuerte: { fontFamily: "Plex", fontWeight: 600 },
  fuerte: { fontWeight: 600 },
  muted: { color: C.gris },
  rojo: { color: C.rojo },
  vacio: { marginTop: 10, color: C.gris },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.linea, paddingVertical: 4 },
  cabecera: { flexDirection: "row", backgroundColor: C.negro, paddingVertical: 4, borderRadius: 2 },
  celdaCab: { fontFamily: "Plex", fontWeight: 600, fontSize: 6.8, letterSpacing: 1, color: C.hueso, textTransform: "uppercase", paddingHorizontal: 4 },
  celda: { paddingHorizontal: 4 },
  caja: { borderWidth: 1, borderColor: C.linea, borderRadius: 4, padding: 8 },
  chip: { fontFamily: "Plex", fontWeight: 600, fontSize: 7, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, backgroundColor: C.suave }
});

export type Contexto = { proyecto: string; documento: string; meta?: string; generado: string; horizontal?: boolean };

// Hoja con franja, encabezado del documento y pie con páginas.
export function Hoja({ ctx, children }: { ctx: Contexto; children: ReactNode }) {
  return (
    <Document title={`${ctx.proyecto} · ${ctx.documento}`} author="Nietzsche Studios" creator="Claqueta" producer="Claqueta" language="es-MX">
      <Page size="LETTER" orientation={ctx.horizontal ? "landscape" : "portrait"} style={e.pagina} wrap>
        <View style={e.franja} fixed>
          <View style={e.marca}>
            <View style={e.punto} />
            <Text style={e.marcaTexto}>NIETZSCHE STUDIOS</Text>
          </View>
          <Text style={e.franjaDer}>{`${ctx.proyecto} · ${ctx.documento}`.toUpperCase()}</Text>
        </View>
        <View>
          <Text style={e.etiqueta}>{ctx.documento}</Text>
          <Text style={e.titulo}>{ctx.proyecto}</Text>
          {ctx.meta ? <Text style={e.meta}>{ctx.meta}</Text> : null}
        </View>
        {children}
        <View style={e.pie} fixed>
          <Text>{`HECHO EN CLAQUETA · ${ctx.generado}`}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export type Columna = { t: string; w: number; mono?: boolean; derecha?: boolean };

// Tabla simple: columnas con ancho relativo; la cabecera se repite en cada hoja.
export function Tabla({ columnas, filas, vacio }: { columnas: Columna[]; filas: ReactNode[][]; vacio?: string }) {
  if (!filas.length) return <Text style={e.vacio}>{vacio ?? "Sin datos todavía."}</Text>;
  return (
    <View>
      <View style={e.cabecera} fixed>
        {columnas.map((c) => (
          <Text key={c.t} style={[e.celdaCab, { flex: c.w, textAlign: c.derecha ? "right" : "left" }]}>
            {c.t}
          </Text>
        ))}
      </View>
      {filas.map((f, i) => (
        <View key={i} style={e.fila} wrap={false}>
          {f.map((v, j) => {
            const c = columnas[j];
            return (
              <View key={j} style={[e.celda, { flex: c.w }]}>
                {typeof v === "string" || typeof v === "number" ? <Text style={[c.mono ? e.mono : {}, { textAlign: c.derecha ? "right" : "left" }]}>{String(v)}</Text> : v}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function Seccion({ t, children, nueva }: { t: string; children?: ReactNode; nueva?: boolean }) {
  return (
    <View break={nueva}>
      <Text style={e.seccion} minPresenceAhead={60}>{t}</Text>
      {children}
    </View>
  );
}
