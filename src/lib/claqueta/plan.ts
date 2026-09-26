// Plan de dinero: cómo repartir lo que entra fijo cada mes. Todo en centavos.
// Reglas de dedo sanas para quien empieza: pagar impuestos y fijos primero,
// ahorrar antes de gastar, juntar para el equipo en lugar de endeudarse, y
// usar la tarjeta poquito y pagarla completa para construir historial.
import { aCentavos, type Cuenta, type ReglaIngreso } from "./dinero";
import { tasaResico } from "./impuestos";

export type GastoFijo = {
  id: string;
  nombre: string;
  categoria: string;
  moneda: "MXN" | "USD";
  monto: number | string;
  monto_mxn: number | string;
  dia: number | null;
  cuenta_id: string | null;
};

export const PORCENTAJE_AHORRO = 0.15;
export const PORCENTAJE_EQUIPO = 0.1;
export const USO_CREDITO_SANO = 0.3; // arriba de 30% del límite baja tu score
export const USO_CREDITO_IDEAL = 0.1;

// Ingreso fijo mensual "seguro": quincenas ×2 y viernes ×4 (hay meses de 5 viernes; ese extra es colchón).
export function ingresoFijoMensual(reglas: ReglaIngreso[]): number {
  return reglas
    .filter((r) => r.activo && r.gravable !== false)
    .reduce((a, r) => {
      const c = aCentavos(r.amount) ?? 0;
      if (r.rule === "biweekly_15_30") return a + c * 2;
      if (r.rule === "weekly_friday") return a + c * 4;
      return a;
    }, 0);
}

// Límite de una tarjeta: fijo, o saldo de su garantía + lo extra que presta el banco.
export function limiteCredito(c: Cuenta & { limite?: number | string | null; garantia_id?: string | null; limite_extra?: number | string | null }, saldos: Map<string, number>): number | null {
  if (c.limite !== null && c.limite !== undefined) return Math.round(Number(c.limite) * 100);
  if (c.garantia_id) return (saldos.get(c.garantia_id) ?? 0) + Math.round(Number(c.limite_extra ?? 0) * 100);
  return null;
}

// Cómo repartir el ingreso fijo del mes.
export function repartoMensual(ingreso: number, fijos: GastoFijo[], limiteTotal: number) {
  const impuestos = Math.round(ingreso * tasaResico(ingreso));
  const suscripciones = fijos.reduce((a, f) => a + (aCentavos(f.monto_mxn) ?? 0), 0);
  const ahorro = Math.round((ingreso * PORCENTAJE_AHORRO) / 100) * 100;
  const equipo = Math.round((ingreso * PORCENTAJE_EQUIPO) / 100) * 100;
  const vivir = Math.max(0, ingreso - impuestos - suscripciones - ahorro - equipo);
  // En tarjeta: lo sano es no pasar de 30% del límite, y nunca más de lo que ya tienes para vivir.
  const topeCredito = Math.min(Math.floor((limiteTotal * USO_CREDITO_SANO) / 100) * 100, vivir);
  return { ingreso, impuestos, suscripciones, ahorro, equipo, vivir, topeCredito, colchonMeta: (suscripciones + vivir) * 3 };
}

export type Consejo = { nivel: "alerta" | "ojo" | "bien"; titulo: string; texto: string };

// Consejos con los números reales de la persona.
export function consejosDinero(p: { usoCredito: number | null; disponible: number; deuda: number; ingresoFijo: number; ahorrado: number }): Consejo[] {
  const out: Consejo[] = [];
  if (p.usoCredito !== null) {
    const pct = Math.round(p.usoCredito * 100);
    if (p.usoCredito > 0.9) out.push({ nivel: "alerta", titulo: `Usas ${pct}% de tu crédito`, texto: "Estás al tope. Para tu historial conviene bajar de 30%. No uses la tarjeta hasta pagar y paga el total antes de la fecha límite." });
    else if (p.usoCredito > USO_CREDITO_SANO) out.push({ nivel: "ojo", titulo: `Usas ${pct}% de tu crédito`, texto: "Arriba de 30% baja tu score. Intenta abonar antes del corte para que el banco reporte menos deuda." });
    else out.push({ nivel: "bien", titulo: `Usas ${pct}% de tu crédito`, texto: "Vas bien. Mantenlo abajo de 30% (ideal 10%) y paga siempre el total." });
  }
  if (p.deuda > 0 && p.deuda > p.disponible) out.push({ nivel: "ojo", titulo: "Debes más de lo que tienes disponible", texto: "Normal si ya viene un cobro, pero aparta cada quincena lo de la tarjeta para llegar completo a la fecha límite." });
  if (p.ahorrado < p.ingresoFijo) out.push({ nivel: "ojo", titulo: "Arma tu colchón", texto: "Antes de invertir en equipo, junta al menos un mes de ingresos para imprevistos. Luego sube a tres." });
  return out;
}

// Camino para construir historial con Nu (tarjeta garantizada).
export const CAMINO_NU = [
  { paso: "Paga el total, no el mínimo", texto: "Cada mes paga el 'pago para no generar intereses' antes del día 5. Pagar solo el mínimo te cobra intereses altos y no ayuda igual." },
  { paso: "Usa poquito", texto: "Gasta máximo 30% de tu límite (ideal 10%). Con tu límite actual es cuidar que el saldo al corte sea bajo." },
  { paso: "Úsala para algo fijo", texto: "Carga a Nu una suscripción (ej. Meli+) y págala completa cada mes. Uso constante + pago puntual es lo que más suma." },
  { paso: "Abona antes del corte", texto: "Si gastaste de más, abona antes del 25. Lo que el banco reporta es tu saldo al corte." },
  { paso: "Sube tu garantía poco a poco", texto: "Cada peso que metes a la garantía sube tu límite. Más límite con el mismo gasto = menor porcentaje de uso." },
  { paso: "Después de 6 a 12 meses", texto: "Con pagos puntuales, Nu suele ofrecer más crédito o pasarte a tarjeta sin garantía. No pidas muchas tarjetas a la vez: cada solicitud consulta tu buró." }
];
