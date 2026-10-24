import { describe, expect, it } from "vitest";
import { leerLineamiento, partirLineamientos, revisar } from "./lineamientos";

// Texto tal cual del PDF de El Robo (con sus cortes de línea).
const EL_ROBO = `Reglas para resolver el Ejercicio:
14 tomas máximo.
1. Aplicación de las reglas simples de angulación y
continuidad:
a) Cambio notable de tamaño entre toma y toma.
b) Cambio notable de angulación entre toma y toma.
2. Aplicación correcta del cambio de código entre "cámara
objetiva" y "cámara subjetiva" (P.O.V.)
3. Aplicación de correspondientes:
c) Pareja de Over-shoulders.
4. Aplicación del insert.
5. Los únicos movimientos de cámara permitidos son panning,
tilt y correcciones de cuadro.
6. NO USAR ZOOM, DOLLY, NI CÁMARA EN MANO.
7. Presentar un sólo video editado.`;

const plano = (p: Partial<{ tamano: string; angulo: string; movimiento: string; descripcion: string }> = {}) => ({ tamano: null, angulo: null, movimiento: null, descripcion: "", ...p });

describe("lineamientos de El Robo", () => {
  const lista = partirLineamientos(EL_ROBO).map(leerLineamiento);
  const de = (r: string) => lista.filter((l) => l.regla === r);

  it("parte los renglones y une los cortes del PDF", () => {
    expect(lista.some((l) => l.texto === "Los únicos movimientos de cámara permitidos son panning, tilt y correcciones de cuadro.")).toBe(true);
    expect(lista.some((l) => /^Reglas para/.test(l.texto))).toBe(false);
  });
  it("detecta el tope de 14 tomas", () => expect(de("max_planos")[0]?.valor).toEqual({ max: 14 }));
  it("detecta movimientos permitidos y prohibidos", () => {
    const m = de("movimientos");
    expect(m.find((x) => x.valor?.permitidos)?.valor?.permitidos).toEqual(["Fijo", "Paneo", "Tilt"]);
    expect(m.find((x) => x.valor?.prohibidos)?.valor?.prohibidos).toEqual(["Zoom", "Dolly", "Mano"]);
  });
  it("detecta POV, insert y over-shoulder", () => {
    expect(de("incluye_pov")).toHaveLength(1);
    expect(de("incluye_insert")).toHaveLength(1);
    expect(de("incluye_over")).toHaveLength(1);
  });
  it("lo demás queda a mano", () => expect(lista.find((l) => /video editado/.test(l.texto))?.regla).toBe("manual"));
});

describe("revisar contra el shotlist", () => {
  const planos = [
    plano({ tamano: "PG", movimiento: "Fijo", descripcion: "Oficina" }),
    plano({ tamano: "PM", movimiento: "Paneo", angulo: "POV de Juan" }),
    plano({ tamano: "INSERT", movimiento: "Fijo", descripcion: "Morral" }),
    plano({ tamano: "PM", angulo: "Over-shoulder Juan", movimiento: "Fijo" }),
    plano({ tamano: "PM", angulo: "Over-shoulder Ricardo", movimiento: "Dolly" })
  ];
  it("tope", () => {
    expect(revisar({ regla: "max_planos", valor: { max: 14 } }, planos).ok).toBe(true);
    expect(revisar({ regla: "max_planos", valor: { max: 4 } }, planos).ok).toBe(false);
  });
  it("movimientos", () => {
    expect(revisar({ regla: "movimientos", valor: { permitidos: ["Fijo", "Paneo", "Tilt"] } }, planos)).toEqual({ ok: false, detalle: "1 plano con movimiento no permitido" });
    expect(revisar({ regla: "movimientos", valor: { prohibidos: ["Zoom"] } }, planos).ok).toBe(true);
  });
  it("POV, insert y over-shoulder en pareja", () => {
    expect(revisar({ regla: "incluye_pov", valor: null }, planos).ok).toBe(true);
    expect(revisar({ regla: "incluye_insert", valor: null }, planos).ok).toBe(true);
    expect(revisar({ regla: "incluye_over", valor: null }, planos).ok).toBe(true);
    expect(revisar({ regla: "incluye_over", valor: null }, planos.slice(0, 4)).ok).toBe(false);
  });
  it("lo manual no se revisa solo", () => expect(revisar({ regla: "manual", valor: null }, planos).ok).toBeNull());
});
