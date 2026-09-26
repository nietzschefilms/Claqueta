import { describe, expect, it } from "vitest";
import { aCentavos, avanceContrato, fechasTarjeta, saldosCuentas, type Cuenta, esperados, gastoPorCategoria, ocurrencias, pesos, resumen, type Contrato, type Pago, type ReglaIngreso } from "./dinero";

const regla = (p: Partial<ReglaIngreso>): ReglaIngreso => ({
  id: "r1",
  source: "Top Mart",
  amount: 3800,
  rule: "biweekly_15_30",
  date: null,
  area: "topmart",
  desde: "2026-09-25",
  activo: true,
  ...p
});
let n = 0;
const pago = (p: Partial<Pago>): Pago => ({ id: `p${++n}`, cuenta_id: null, source: "x", amount: 100, date: "2026-09-25", expected_key: null, contract_id: null, area: null, note: null, ...p });

describe("montos", () => {
  it("convierte a centavos sin errores de redondeo", () => {
    expect(aCentavos("1,500.50")).toBe(150050);
    expect(aCentavos(0.1 + 0.2)).toBeNull(); // más de 2 decimales: no es un monto capturado
    expect(aCentavos("0.30")).toBe(30);
    expect(aCentavos("$5,000")).toBe(500000);
    expect(aCentavos("-5")).toBeNull();
    expect(aCentavos("0")).toBeNull();
    expect(aCentavos("abc")).toBeNull();
  });
  it("formatea en pesos", () => {
    expect(pesos(500000)).toBe("$5,000");
    expect(pesos(150050)).toBe("$1,500.50");
  });
});

describe("ocurrencias", () => {
  it("quincenal: 15 y 30, y el último día en febrero", () => {
    expect(ocurrencias(regla({}), "2026-09-25", "2026-10-31")).toEqual(["2026-09-30", "2026-10-15", "2026-10-30"]);
    expect(ocurrencias(regla({ desde: "2027-02-01" }), "2027-02-01", "2027-02-28")).toEqual(["2027-02-15", "2027-02-28"]);
  });
  it("semanal: cada viernes desde el inicio", () => {
    expect(ocurrencias(regla({ rule: "weekly_friday" }), "2026-09-25", "2026-10-10")).toEqual(["2026-09-25", "2026-10-02", "2026-10-09"]);
  });
  it("no cuenta antes de 'desde' ni reglas inactivas", () => {
    expect(ocurrencias(regla({}), "2026-09-01", "2026-09-20")).toEqual([]);
    expect(ocurrencias(regla({ activo: false }), "2026-09-25", "2026-12-31")).toEqual([]);
  });
});

describe("esperados", () => {
  it("quita los ya confirmados y separa hoy de próximos", () => {
    const clinica = regla({ id: "r2", source: "Clínica", amount: 1500, rule: "weekly_friday" });
    const e = esperados([regla({}), clinica], [pago({ expected_key: "r2:2026-09-25" })], "2026-09-25", 7);
    expect(e.hoy).toHaveLength(0);
    expect(e.proximos.map((x) => `${x.regla.source} ${x.fecha}`)).toEqual(["Top Mart 2026-09-30", "Clínica 2026-10-02"]);
  });
});

describe("contrato", () => {
  const c: Contrato = { id: "c1", client: "EK Bars", total: 100000, start_date: "2026-09-25", pay_deadline: "2027-09-25", area: "ek" };
  it("suma los abonos hasta el total", () => {
    const a = avanceContrato(c, [pago({ contract_id: "c1", amount: 5000 }), pago({ amount: 999 })], "2026-09-25");
    expect(a.pagado).toBe(500000);
    expect(a.restante).toBe(9500000);
    expect(a.porcentaje).toBeCloseTo(0.05);
    expect(a.mesesRestantes).toBe(12);
    expect(a.sugeridoMensual).toBe(791700); // 95,000 / 12 redondeado a pesos
  });
});

describe("resumen", () => {
  it("entradas, salidas y saldo", () => {
    const r = resumen(
      [pago({ amount: 5000 }), pago({ amount: 1500 }), pago({ amount: 200, date: "2026-10-02" })],
      [{ id: "g1", cuenta_id: null, amount: "350.50", category: "Comida", date: "2026-09-25", note: null }],
      "2026-09"
    );
    expect(r).toEqual({ entradas: 650000, salidas: 35050, neto: 614950, saldo: 634950 });
  });
  it("gasto por categoría", () => {
    const g = gastoPorCategoria(
      [
        { id: "1", cuenta_id: null, amount: 100, category: "Comida", date: "2026-09-25", note: null },
        { id: "2", cuenta_id: null, amount: 300, category: "Transporte", date: "2026-09-25", note: null },
        { id: "3", cuenta_id: null, amount: 50, category: "Comida", date: "2026-09-26", note: null }
      ],
      "2026-09"
    );
    expect(g).toEqual([{ categoria: "Transporte", centavos: 30000 }, { categoria: "Comida", centavos: 15000 }]);
  });
});

describe("cuentas", () => {
  const cuenta = (id: string, tipo: Cuenta["tipo"], saldo_inicial = 0, dia_corte: number | null = null, dia_pago: number | null = null): Cuenta => ({ id, nombre: id, tipo, saldo_inicial, dia_corte, dia_pago, orden: 0 });
  it("el arranque de Jamez: 6,500 entran, 3,000 a Mercado Libre, 3,500 a la garantía", () => {
    const cuentas = [cuenta("deb", "debito"), cuenta("nu", "credito", "5247.20" as unknown as number, 25, 5), cuenta("ml", "credito", 3000), cuenta("gar", "garantia")];
    const s = saldosCuentas(
      cuentas,
      [pago({ cuenta_id: "deb", amount: 5000 }), pago({ cuenta_id: "deb", amount: 1500 })],
      [],
      [
        { id: "t1", desde_id: "deb", hacia_id: "ml", amount: 3000, date: "2026-09-25", note: null },
        { id: "t2", desde_id: "deb", hacia_id: "gar", amount: 3500, date: "2026-09-25", note: null }
      ]
    );
    expect(s.porCuenta.get("deb")).toBe(0);
    expect(s.porCuenta.get("ml")).toBe(0);
    expect(s.porCuenta.get("gar")).toBe(350000);
    expect(s.porCuenta.get("nu")).toBe(524720);
    expect(s).toMatchObject({ disponible: 0, apartado: 350000, deuda: 524720 });
  });
  it("gastar con crédito sube la deuda y no toca el débito", () => {
    const s = saldosCuentas([cuenta("deb", "debito", 1000), cuenta("nu", "credito")], [], [{ id: "g", cuenta_id: "nu", amount: 250, category: "Comida", date: "2026-09-26", note: null }], []);
    expect(s).toMatchObject({ disponible: 100000, deuda: 25000 });
  });
  it("fechas de la tarjeta Nu (corte 25, pago 5)", () => {
    expect(fechasTarjeta({ dia_corte: 25, dia_pago: 5 }, "2026-09-25")).toEqual({ corte: "2026-10-25", limite: "2026-11-05" });
    expect(fechasTarjeta({ dia_corte: 25, dia_pago: 5 }, "2026-10-10")).toEqual({ corte: "2026-10-25", limite: "2026-11-05" });
    expect(fechasTarjeta({ dia_corte: 25, dia_pago: 5 }, "2026-12-26")).toEqual({ corte: "2027-01-25", limite: "2027-02-05" });
    expect(fechasTarjeta({ dia_corte: null, dia_pago: null }, "2026-09-25")).toBeNull();
  });
});
