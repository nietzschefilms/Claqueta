import { describe, expect, it } from "vitest";
import { aCentavos, avanceContrato, esperados, gastoPorCategoria, ocurrencias, pesos, resumen, type Contrato, type Pago, type ReglaIngreso } from "./dinero";

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
const pago = (p: Partial<Pago>): Pago => ({ id: `p${++n}`, source: "x", amount: 100, date: "2026-09-25", expected_key: null, contract_id: null, area: null, note: null, ...p });

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
      [{ id: "g1", amount: "350.50", category: "Comida", date: "2026-09-25", note: null }],
      "2026-09"
    );
    expect(r).toEqual({ entradas: 650000, salidas: 35050, neto: 614950, saldo: 634950 });
  });
  it("gasto por categoría", () => {
    const g = gastoPorCategoria(
      [
        { id: "1", amount: 100, category: "Comida", date: "2026-09-25", note: null },
        { id: "2", amount: 300, category: "Transporte", date: "2026-09-25", note: null },
        { id: "3", amount: 50, category: "Comida", date: "2026-09-26", note: null }
      ],
      "2026-09"
    );
    expect(g).toEqual([{ categoria: "Transporte", centavos: 30000 }, { categoria: "Comida", centavos: 15000 }]);
  });
});
