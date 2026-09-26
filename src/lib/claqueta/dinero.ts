// Lógica del módulo de Dinero. Todo en CENTAVOS enteros: nunca se suman
// flotantes con decimales de pesos, así 0.1 + 0.2 no se vuelve 0.30000004.
import { diaSemana, diasEntre, sumarDias } from "./fechas";
import type { FrenteId } from "./frentes";

export type ReglaIngreso = {
  id: string;
  source: string;
  amount: number | string;
  rule: "biweekly_15_30" | "weekly_friday" | "one_off";
  date: string | null;
  area: FrenteId | null;
  desde: string;
  activo: boolean;
};

export type Pago = {
  id: string;
  source: string;
  amount: number | string;
  date: string;
  expected_key: string | null;
  contract_id: string | null;
  area: FrenteId | null;
  note: string | null;
};

export type Gasto = {
  id: string;
  amount: number | string;
  category: string;
  date: string;
  note: string | null;
};

export type Contrato = {
  id: string;
  client: string;
  total: number | string;
  start_date: string;
  pay_deadline: string | null;
  area: FrenteId | null;
};

export type Esperado = { regla: ReglaIngreso; fecha: string; clave: string; centavos: number };

// "1,234.50" o 1234.5 → 123450. Devuelve null si no es un monto válido y positivo.
export function aCentavos(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const texto = String(v).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null;
  const c = Math.round(Number(texto) * 100);
  return c > 0 ? c : null;
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const mxnCentavos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 500000 → "$5,000"; 150050 → "$1,500.50"
export function pesos(centavos: number): string {
  return (centavos % 100 === 0 ? mxn : mxnCentavos).format(centavos / 100);
}

const suma = (xs: { amount: number | string }[]) => xs.reduce((a, x) => a + (aCentavos(x.amount) ?? 0), 0);

function ultimoDiaMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// Fechas en que se espera la regla, entre desde y hasta (incluidos).
export function ocurrencias(regla: ReglaIngreso, desde: string, hasta: string): string[] {
  const inicio = regla.desde > desde ? regla.desde : desde;
  if (!regla.activo || inicio > hasta) return [];
  if (regla.rule === "one_off") return regla.date && regla.date >= inicio && regla.date <= hasta ? [regla.date] : [];

  const fechas: string[] = [];
  if (regla.rule === "weekly_friday") {
    let d = sumarDias(inicio, (5 - diaSemana(inicio) + 7) % 7);
    while (d <= hasta) {
      fechas.push(d);
      d = sumarDias(d, 7);
    }
    return fechas;
  }

  // Quincenal: el 15 y el 30 (o el último día si el mes es más corto).
  let [anio, mes] = inicio.split("-").map(Number);
  while (true) {
    const mm = String(mes).padStart(2, "0");
    for (const dia of [15, Math.min(30, ultimoDiaMes(anio, mes))]) {
      const f = `${anio}-${mm}-${String(dia).padStart(2, "0")}`;
      if (f > hasta) return fechas;
      if (f >= inicio) fechas.push(f);
    }
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
}

export const claveEsperado = (reglaId: string, fecha: string) => `${reglaId}:${fecha}`;

// Cobros esperados: atrasados (hasta 30 días atrás), de hoy y de los próximos días.
export function esperados(reglas: ReglaIngreso[], pagos: Pago[], hoy: string, diasAdelante = 14) {
  const confirmadas = new Set(pagos.map((p) => p.expected_key).filter(Boolean));
  const todos: Esperado[] = reglas.flatMap((r) =>
    ocurrencias(r, sumarDias(hoy, -30), sumarDias(hoy, diasAdelante)).map((fecha) => ({
      regla: r,
      fecha,
      clave: claveEsperado(r.id, fecha),
      centavos: aCentavos(r.amount) ?? 0
    }))
  );
  const pendientes = todos.filter((e) => !confirmadas.has(e.clave)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    atrasados: pendientes.filter((e) => e.fecha < hoy),
    hoy: pendientes.filter((e) => e.fecha === hoy),
    proximos: pendientes.filter((e) => e.fecha > hoy)
  };
}

// Avance de un contrato que se paga en abonos hasta juntar el total.
export function avanceContrato(contrato: Contrato, pagos: Pago[], hoy: string) {
  const total = aCentavos(contrato.total) ?? 0;
  const abonos = pagos.filter((p) => p.contract_id === contrato.id).sort((a, b) => a.date.localeCompare(b.date));
  const pagado = suma(abonos);
  const restante = Math.max(0, total - pagado);
  const fin = contrato.pay_deadline;
  const mesesRestantes = fin ? Math.max(1, Math.ceil(diasEntre(hoy, fin) / 30.44)) : null;
  return {
    total,
    pagado,
    restante,
    porcentaje: total > 0 ? Math.min(1, pagado / total) : 0,
    abonos,
    mesesRestantes,
    // Cuánto tendría que llegar al mes, en promedio, para juntar el total a tiempo.
    sugeridoMensual: mesesRestantes && restante > 0 ? Math.ceil(restante / mesesRestantes / 100) * 100 : 0
  };
}

// Entradas y salidas de un mes ("2026-09") y el saldo desde que se empezó a llevar la cuenta.
export function resumen(pagos: Pago[], gastos: Gasto[], mes: string) {
  const delMes = <T extends { date: string }>(xs: T[]) => xs.filter((x) => x.date.startsWith(mes));
  const entradas = suma(delMes(pagos));
  const salidas = suma(delMes(gastos));
  return { entradas, salidas, neto: entradas - salidas, saldo: suma(pagos) - suma(gastos) };
}

// Gasto por categoría del mes, de mayor a menor.
export function gastoPorCategoria(gastos: Gasto[], mes: string) {
  const m = new Map<string, number>();
  for (const g of gastos) if (g.date.startsWith(mes)) m.set(g.category, (m.get(g.category) ?? 0) + (aCentavos(g.amount) ?? 0));
  return [...m.entries()].map(([categoria, centavos]) => ({ categoria, centavos })).sort((a, b) => b.centavos - a.centavos);
}
