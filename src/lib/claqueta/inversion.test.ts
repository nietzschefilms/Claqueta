import { describe, expect, it } from "vitest";
import { consejosCompra, costoItem, fondoInversion, impuestoDeCobro, ordenCompra, semaforo, type ItemInversion } from "./inversion";

describe("fondo de inversión", () => {
  it("impuesto de un cobro: IVA incluido o aparte", () => {
    // $10,000 con IVA incluido: IVA 1,379.31 + ISR 1% de 8,620.69 = 86.21
    expect(impuestoDeCobro(1_000_000, false)).toBe(137_931 + 8_621);
    expect(impuestoDeCobro(1_000_000, true)).toBe(10_000);
  });

  it("descuenta lo ya gastado, impuestos, reserva y lo invertido", () => {
    const f = fondoInversion({
      abonos: [
        { centavos: 500_000, mes: "2026-09" },
        { centavos: 1_000_000, mes: "2026-10" }
      ],
      total: 10_500_000,
      yaGastado: 500_000,
      reservaPct: 10,
      ivaAparte: false,
      invertido: 300_000,
      mesesRestantes: 12
    });
    const imp = impuestoDeCobro(500_000, false) + impuestoDeCobro(1_000_000, false);
    expect(f.impuestos).toBe(imp);
    expect(f.cobrado).toBe(1_000_000);
    const neto = 1_000_000 - imp;
    expect(f.reserva).toBe(Math.round(neto * 0.1));
    expect(f.disponible).toBe(neto - Math.round(neto * 0.1) - 300_000);
    expect(f.porCobrar).toBe(9_000_000);
    expect(f.netoMensual).toBe(Math.round(f.porLlegarNeto / 12));
  });

  it("si lo ya gastado se comió sus impuestos, se descuentan de lo que viene", () => {
    const f = fondoInversion({ abonos: [{ centavos: 500_000, mes: "2026-09" }], total: 10_500_000, yaGastado: 500_000, reservaPct: 10, ivaAparte: false, invertido: 0, mesesRestantes: 12 });
    const deuda = impuestoDeCobro(500_000, false);
    expect(f.disponible).toBe(0);
    const bruto = 10_000_000 - impuestoDeCobro(10_000_000, false) - deuda;
    expect(f.porLlegarNeto).toBe(bruto - Math.round(bruto * 0.1));
  });
});

const item = (id: string, precio: number, prioridad: number, retorno = 2, estado: ItemInversion["estado"] = "quiero"): ItemInversion => ({ id, nombre: id, categoria: "otro", precio, cantidad: 1, prioridad, retorno, rentable: false, estado });

describe("semáforo", () => {
  it("verde en orden de prioridad hasta donde alcanza, luego amarillo con fecha y gris", () => {
    const items = [item("luz", 4000, 2), item("pc", 50000, 1), item("micro", 3000, 1, 3), item("dron", 30000, 4), item("ya", 999, 1, 2, "comprado")];
    expect(ordenCompra(items.filter((i) => i.estado === "quiero")).map((i) => i.id)).toEqual(["micro", "pc", "luz", "dron"]);
    const s = semaforo(items, { disponible: 5_500_000, porLlegarNeto: 1_000_000, netoMensual: 500_000 }, "2026-10-01");
    expect(s.get("micro")?.color).toBe("verde");
    expect(s.get("pc")?.color).toBe("verde");
    expect(s.get("luz")?.color).toBe("amarillo");
    expect(s.get("luz")?.fecha).toBe("2026-10-31");
    expect(s.get("dron")?.color).toBe("gris");
    expect(s.has("ya")).toBe(false);
  });

  it("consejos de contador según precio y si se renta", () => {
    expect(costoItem({ precio: "1500.50", cantidad: 2 })).toBe(300_100);
    const pc = consejosCompra(item("pc", 50000, 1), { resico: true });
    expect(pc.some((x) => x.includes("factura"))).toBe(true);
    expect(pc.some((x) => x.includes("meses sin intereses"))).toBe(true);
    const gimbal = consejosCompra({ ...item("gimbal", 9000, 3, 1), rentable: true }, { resico: false });
    expect(gimbal.some((x) => x.includes("renta"))).toBe(true);
  });
});
