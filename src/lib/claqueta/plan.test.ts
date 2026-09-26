import { describe, expect, it } from "vitest";
import { consejosDinero, estadoFijo, ingresoFijoMensual, limiteCredito, repartoMensual, type GastoFijo } from "./plan";
import type { Cuenta, ReglaIngreso } from "./dinero";

const regla = (p: Partial<ReglaIngreso>): ReglaIngreso => ({ id: "r", source: "x", amount: 0, rule: "biweekly_15_30", date: null, area: null, desde: "2026-09-25", activo: true, ...p });
const fijo = (monto_mxn: number): GastoFijo => ({ id: "f", nombre: "x", categoria: "Suscripciones", moneda: "MXN", monto: monto_mxn, monto_mxn, dia: null, cuenta_id: null });

describe("plan de dinero", () => {
  it("ingreso fijo de Jamez: Top Mart 3,800 quincenal + clínica 1,500 semanal = 13,600", () => {
    expect(ingresoFijoMensual([regla({ amount: 3800 }), regla({ amount: 1500, rule: "weekly_friday" })])).toBe(1_360_000);
  });

  it("límite de Nu = garantía + 1,000", () => {
    const nu = { id: "nu", nombre: "Nu", tipo: "credito", saldo_inicial: 0, dia_corte: 25, dia_pago: 5, orden: 0, garantia_id: "gar", limite_extra: 1000 } as Cuenta & { garantia_id: string; limite_extra: number };
    expect(limiteCredito(nu, new Map([["gar", 436_461]]))).toBe(536_461);
    expect(limiteCredito({ ...nu, garantia_id: null, limite: 20000 } as never, new Map())).toBe(2_000_000);
  });

  it("reparto de 13,600 con Claude 1,800 y Meli+ 500", () => {
    const r = repartoMensual(1_360_000, [fijo(1800), fijo(500)], 536_461);
    expect(r).toMatchObject({ impuestos: 13_600, suscripciones: 230_000, ahorro: 204_000, equipo: 136_000 });
    expect(r.vivir).toBe(1_360_000 - 13_600 - 230_000 - 204_000 - 136_000);
    expect(r.topeCredito).toBe(160_900); // 30% de 5,364.61 redondeado a pesos
  });

  it("alerta al usar casi todo el crédito", () => {
    const c = consejosDinero({ usoCredito: 0.98, disponible: 0, deuda: 524_720, ingresoFijo: 1_360_000, ahorrado: 436_461 });
    expect(c[0].nivel).toBe("alerta");
    expect(c.map((x) => x.titulo)).toContain("Arma tu colchón");
  });
});

describe("cargos fijos", () => {
  const claude = { id: "c", dia: 23 };
  it("el del 23 de septiembre fue antes de empezar: el próximo es el 23 de octubre", () => {
    expect(estadoFijo(claude, "2026-09-25", "2026-09-25", new Set())).toEqual({ estado: "proximo", mes: "2026-09", fecha: "2026-10-23" });
  });
  it("el 23 de octubre pide confirmarlo, y ya confirmado queda cobrado", () => {
    expect(estadoFijo(claude, "2026-10-23", "2026-09-25", new Set())).toMatchObject({ estado: "pendiente", fecha: "2026-10-23" });
    expect(estadoFijo(claude, "2026-10-24", "2026-09-25", new Set(["c:2026-10"]))).toMatchObject({ estado: "cobrado" });
  });
  it("antes del día muestra la fecha; día 31 en noviembre cae el 30", () => {
    expect(estadoFijo({ id: "m", dia: 17 }, "2026-10-10", "2026-09-25", new Set())).toMatchObject({ estado: "proximo", fecha: "2026-10-17" });
    expect(estadoFijo({ id: "x", dia: 31 }, "2026-11-02", "2026-09-25", new Set())).toMatchObject({ estado: "proximo", fecha: "2026-11-30" });
  });
});
