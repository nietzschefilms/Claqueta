// Impuestos de persona física en RESICO (Régimen Simplificado de Confianza).
// Es un ESTIMADO para apartar dinero: la declaración la confirma el contador.
//
// ISR: tasa fija sobre lo cobrado en el mes, sin deducciones (art. 113-E LISR).
// IVA: 16% sobre lo que se factura con IVA. Si el cliente es empresa (persona
//      moral) retiene 1.25% de ISR (art. 113-J) y 2/3 del IVA.
// Se declara y paga a más tardar el día 17 del mes siguiente.
import type { Pago } from "./dinero";
import { aCentavos } from "./dinero";

export const IVA = 0.16;
export const RET_ISR_MORAL = 0.0125;

// Tabla mensual del RESICO (límite superior en centavos, tasa).
const TABLA_RESICO: [number, number][] = [
  [2_500_000, 0.01],
  [5_000_000, 0.011],
  [8_333_333, 0.015],
  [20_833_333, 0.02],
  [Number.POSITIVE_INFINITY, 0.025]
];

export function tasaResico(ingresoMensual: number): number {
  return TABLA_RESICO.find(([tope]) => ingresoMensual <= tope)![1];
}

export type ClienteTipo = "moral" | "fisica";

// Desglose de una factura a partir del subtotal (antes de IVA), en centavos.
export function desgloseFactura(subtotal: number, cliente: ClienteTipo) {
  const iva = Math.round(subtotal * IVA);
  const retIsr = cliente === "moral" ? Math.round(subtotal * RET_ISR_MORAL) : 0;
  const retIva = cliente === "moral" ? Math.round((iva * 2) / 3) : 0;
  return { subtotal, iva, retIsr, retIva, deposito: subtotal + iva - retIsr - retIva };
}

type PagoFiscal = Pick<Pago, "amount" | "date"> & {
  gravable?: boolean;
  factura?: boolean;
  subtotal?: number | string | null;
  iva?: number | string | null;
  ret_isr?: number | string | null;
  ret_iva?: number | string | null;
};

const c = (v: number | string | null | undefined) => (v === null || v === undefined || Number(v) === 0 ? 0 : aCentavos(v) ?? 0);

// Fecha límite para declarar el mes "2026-09": 17 de octubre.
export function limiteDeclaracion(mes: string): string {
  let [a, m] = mes.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    a += 1;
  }
  return `${a}-${String(m).padStart(2, "0")}-17`;
}

// Estimado del mes: ISR sobre todo lo cobrado de la actividad, IVA de lo facturado.
export function estimadoMes(pagos: PagoFiscal[], mes: string) {
  const delMes = pagos.filter((p) => p.date.startsWith(mes) && p.gravable !== false);
  // Base del ISR: el subtotal si hubo factura; si no, lo que entró.
  const base = delMes.reduce((a, p) => a + (p.factura ? c(p.subtotal) : c(p.amount)), 0);
  const facturado = delMes.filter((p) => p.factura).reduce((a, p) => a + c(p.subtotal), 0);
  const tasa = tasaResico(base);
  const isr = Math.round(base * tasa);
  const retIsr = delMes.reduce((a, p) => a + c(p.ret_isr), 0);
  const ivaCobrado = delMes.reduce((a, p) => a + c(p.iva), 0);
  const retIva = delMes.reduce((a, p) => a + c(p.ret_iva), 0);
  const isrPagar = Math.max(0, isr - retIsr);
  const ivaPagar = Math.max(0, ivaCobrado - retIva);
  return { base, facturado, tasa, isr, retIsr, isrPagar, ivaCobrado, retIva, ivaPagar, total: isrPagar + ivaPagar, limite: limiteDeclaracion(mes) };
}

// ─── Contador: formas legales de pagar menos o no pagar de más ───────────
// Solo planeación legal (no evasión). Cada consejo dice por qué aplica.
export type ConsejoFiscal = { titulo: string; texto: string; aplica?: boolean };

export function consejosFiscales(e: ReturnType<typeof estimadoMes>, datos: { facturasEmitidas: number }): ConsejoFiscal[] {
  const tope = TABLA_RESICO[0][0];
  return [
    {
      titulo: "Quédate en RESICO",
      texto: "Pagas de 1% a 2.5% sobre lo que cobras, sin llevar deducciones. Es de las tasas más bajas de México. El límite es 3.5 millones al año.",
      aplica: true
    },
    {
      titulo: e.base > tope * 0.8 ? "Cerca del tramo de 1.1%" : "Estás en el tramo de 1%",
      texto:
        e.base > tope * 0.8
          ? "Arriba de $25,000 en el mes la tasa sube a 1.1% sobre TODO lo del mes. Si un cliente te puede pagar el 1 del mes siguiente en lugar del 30, cobrarlo después es legal y te deja en 1%."
          : "Mientras cobres hasta $25,000 al mes pagas 1%. Si un mes viene cargado, pedir que un pago caiga el mes siguiente te mantiene en 1% (es legal: RESICO cuenta lo cobrado, no lo facturado).",
      aplica: true
    },
    {
      titulo: "Pide factura de todo lo de trabajo",
      texto: "Equipo de video, software, discos, renta de equipo. En RESICO no te bajan el ISR, pero el IVA de esas facturas se resta del IVA que cobres a tus clientes (IVA acreditable). Pide la factura a tu RFC con uso 'Gastos en general'.",
      aplica: true
    },
    {
      titulo: "Compra equipo el mes que factures con IVA",
      texto: "Si compras una cámara de $20,000 + IVA el mismo mes que cobras IVA, sus $3,200 de IVA bajan lo que pagas ese mes. Hazlo con factura y pagando con tarjeta o transferencia (no efectivo arriba de $2,000).",
      aplica: true
    },
    {
      titulo: "Factura a empresas: la retención ya es pago",
      texto: "Cuando una empresa te retiene 1.25% de ISR y 2/3 del IVA, eso ya lo pagó por ti al SAT. Resta esas retenciones en tu declaración para no pagar doble. Guarda cada factura con su retención.",
      aplica: datos.facturasEmitidas > 0
    },
    {
      titulo: "Declara antes del 17, aunque sea en ceros",
      texto: "Evitas recargos y multas. Ojo: en RESICO, si dejas de declarar 3 meses seguidos te sacan del régimen y pagarías mucho más en otro.",
      aplica: true
    },
    {
      titulo: "Separa una cuenta para tu trabajo",
      texto: "Que ahí entren tus cobros y salgan tus gastos de trabajo. Si el SAT pregunta, se ve claro qué es ingreso y qué es regalo de tus papás (los regalos de padres a hijos no pagan ISR).",
      aplica: true
    },
    {
      titulo: "Aparta el impuesto al cobrar",
      texto: "Cada vez que te paguen, mueve el 1% (y el IVA si cobraste) a tu apartado. Así nunca se te junta.",
      aplica: true
    }
  ];
}
