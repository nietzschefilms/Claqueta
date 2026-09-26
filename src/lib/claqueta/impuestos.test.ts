import { describe, expect, it } from "vitest";
import { desgloseFactura, estimadoMes, limiteDeclaracion, tasaResico } from "./impuestos";

describe("RESICO", () => {
  it("tasa por tramo mensual", () => {
    expect(tasaResico(650_000)).toBe(0.01); // $6,500
    expect(tasaResico(2_500_000)).toBe(0.01); // $25,000 justo
    expect(tasaResico(2_500_001)).toBe(0.011);
    expect(tasaResico(8_000_000)).toBe(0.015);
    expect(tasaResico(10_000_000)).toBe(0.02);
    expect(tasaResico(30_000_000)).toBe(0.025);
  });

  it("desglose de factura a empresa y a persona", () => {
    expect(desgloseFactura(1_000_000, "moral")).toEqual({ subtotal: 1_000_000, iva: 160_000, retIsr: 12_500, retIva: 106_667, deposito: 1_040_833 });
    expect(desgloseFactura(1_000_000, "fisica")).toEqual({ subtotal: 1_000_000, iva: 160_000, retIsr: 0, retIva: 0, deposito: 1_160_000 });
  });

  it("estimado del mes: sin facturas, 1% de lo cobrado; lo de los papás no cuenta", () => {
    const e = estimadoMes(
      [
        { amount: 5000, date: "2026-09-25" },
        { amount: 1500, date: "2026-09-25" },
        { amount: 2000, date: "2026-09-26", gravable: false },
        { amount: 3800, date: "2026-10-15" }
      ],
      "2026-09"
    );
    expect(e).toMatchObject({ base: 650_000, tasa: 0.01, isr: 6_500, isrPagar: 6_500, ivaPagar: 0, total: 6_500, limite: "2026-10-17" });
  });

  it("estimado con factura a empresa: resta lo retenido", () => {
    const e = estimadoMes([{ amount: 10408.33, date: "2026-11-03", factura: true, subtotal: 10000, iva: 1600, ret_isr: 125, ret_iva: 1066.67 }], "2026-11");
    expect(e).toMatchObject({ base: 1_000_000, isr: 10_000, retIsr: 12_500, isrPagar: 0, ivaCobrado: 160_000, retIva: 106_667, ivaPagar: 53_333 });
  });

  it("diciembre se declara en enero", () => {
    expect(limiteDeclaracion("2026-12")).toBe("2027-01-17");
  });
});
