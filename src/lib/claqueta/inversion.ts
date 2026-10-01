// Inversión Nietzsche: cuánto dinero hay para equipo y qué ya se puede comprar.
// Dinero en centavos enteros. Todo es estimado: los impuestos reales los
// confirma el contador; aquí se aparta de más para no quedarse corto.

import { aCentavos } from "./dinero";
import { IVA, tasaResico } from "./impuestos";
import { sumarDias } from "./fechas";

export const CATEGORIAS_INVERSION: { v: string; t: string }[] = [
  { v: "computadora", t: "Computadora" },
  { v: "lentes", t: "Lentes" },
  { v: "iluminacion", t: "Iluminación" },
  { v: "sonido", t: "Sonido" },
  { v: "energia", t: "Energía" },
  { v: "almacenamiento", t: "Almacenamiento" },
  { v: "grip", t: "Grip y soporte" },
  { v: "filtros", t: "Filtros" },
  { v: "monitoreo", t: "Monitoreo" },
  { v: "mochilas", t: "Mochilas y estuches" },
  { v: "accesorios", t: "Accesorios" },
  { v: "software", t: "Software" },
  { v: "otro", t: "Otro" }
];
export const nombreCategoriaInversion = (v: string) => CATEGORIAS_INVERSION.find((c) => c.v === v)?.t ?? v;

export const PRIORIDADES = [
  { v: 1, t: "Imprescindible", d: "Sin esto no se cobra un spot" },
  { v: 2, t: "Importante", d: "Sube la calidad que cobras" },
  { v: 3, t: "Deseable", d: "Ayuda, pero se puede esperar" },
  { v: 4, t: "Sueño", d: "Cuando sobre" }
] as const;

export type ItemInversion = {
  id: string;
  nombre: string;
  categoria: string;
  precio: number | string;
  cantidad: number;
  prioridad: number;
  retorno: number;
  rentable: boolean;
  estado: "quiero" | "comprado" | "descartado";
  precio_real?: number | string | null;
  orden?: number;
};

const c = (v: number | string | null | undefined) => (v === null || v === undefined || Number(v) === 0 ? 0 : aCentavos(v) ?? 0);
export const costoItem = (i: Pick<ItemInversion, "precio" | "cantidad">) => c(i.precio) * Math.max(1, i.cantidad);

// Impuesto estimado de un cobro (RESICO). Sin IVA aparte, el IVA venía incluido
// (16/116 del cobro); el ISR es la tasa del mes sobre lo que queda.
export function impuestoDeCobro(centavos: number, ivaAparte: boolean, tasa = 0.01) {
  if (ivaAparte) return Math.round(centavos * tasa);
  const iva = Math.round((centavos * IVA) / (1 + IVA));
  return iva + Math.round((centavos - iva) * tasa);
}

export type Fondo = {
  cobrado: number; // abonos del contrato menos lo ya gastado
  impuestos: number;
  reserva: number;
  invertido: number;
  disponible: number;
  porCobrar: number; // lo que falta del contrato
  porLlegarNeto: number; // lo que falta, ya sin impuestos ni reserva
  netoMensual: number; // ritmo estimado para llegar a la fecha límite
};

// tasaDelMes: la tasa RESICO del mes de cada cobro (si se conoce); por defecto 1%.
export function fondoInversion(opciones: {
  abonos: { centavos: number; mes: string }[];
  total: number;
  yaGastado: number;
  reservaPct: number;
  ivaAparte: boolean;
  invertido: number;
  mesesRestantes: number | null;
  baseDelMes?: Map<string, number>;
}): Fondo {
  const { abonos, total, yaGastado, reservaPct, ivaAparte, invertido, mesesRestantes, baseDelMes } = opciones;
  const pagado = abonos.reduce((a, x) => a + x.centavos, 0);
  const impuestos = abonos.reduce((a, x) => a + impuestoDeCobro(x.centavos, ivaAparte, tasaResico(baseDelMes?.get(x.mes) ?? 0)), 0);
  const cobrado = Math.max(0, pagado - yaGastado);
  // Lo ya gastado sale de lo cobrado; sus impuestos igual se deben.
  const neto = Math.max(0, cobrado - impuestos);
  const reserva = Math.round((neto * reservaPct) / 100);
  const porCobrar = Math.max(0, total - pagado);
  const porLlegarBruto = porCobrar - impuestoDeCobro(porCobrar, ivaAparte);
  const porLlegarNeto = porLlegarBruto - Math.round((porLlegarBruto * reservaPct) / 100);
  return {
    cobrado,
    impuestos,
    reserva,
    invertido,
    disponible: Math.max(0, neto - reserva - invertido),
    porCobrar,
    porLlegarNeto,
    netoMensual: mesesRestantes && mesesRestantes > 0 ? Math.round(porLlegarNeto / mesesRestantes) : 0
  };
}

export type Semaforo = { color: "verde" | "amarillo" | "gris"; acumulado: number; fecha: string | null };

// Orden de compra: prioridad, luego retorno (más alto primero), luego lo más barato.
export function ordenCompra<T extends ItemInversion>(items: T[]): T[] {
  return [...items].sort((a, b) => a.prioridad - b.prioridad || b.retorno - a.retorno || (a.orden ?? 0) - (b.orden ?? 0) || costoItem(a) - costoItem(b));
}

// Verde: alcanza hoy siguiendo el orden de prioridad. Amarillo: alcanza con lo
// que falta del contrato (con fecha estimada). Gris: más allá del contrato.
export function semaforo(items: ItemInversion[], fondo: Pick<Fondo, "disponible" | "porLlegarNeto" | "netoMensual">, hoy: string): Map<string, Semaforo> {
  const out = new Map<string, Semaforo>();
  let acumulado = 0;
  for (const i of ordenCompra(items.filter((x) => x.estado === "quiero"))) {
    acumulado += costoItem(i);
    if (acumulado <= fondo.disponible) out.set(i.id, { color: "verde", acumulado, fecha: hoy });
    else if (acumulado <= fondo.disponible + fondo.porLlegarNeto) {
      const falta = acumulado - fondo.disponible;
      const meses = fondo.netoMensual > 0 ? Math.ceil(falta / fondo.netoMensual) : null;
      out.set(i.id, { color: "amarillo", acumulado, fecha: meses ? sumarDias(hoy, Math.round(meses * 30.44)) : null });
    } else out.set(i.id, { color: "gris", acumulado, fecha: null });
  }
  return out;
}

// Consejos de contador para un artículo (RESICO).
export function consejosCompra(i: ItemInversion, opciones: { resico: boolean; semaforo?: Semaforo }): string[] {
  const costo = costoItem(i);
  const ivaAcreditable = Math.round((costo * IVA) / (1 + IVA));
  const out: string[] = [];
  if (opciones.resico && costo >= 50_000) {
    out.push(`Pide factura a tu RFC (uso "Gastos en general"): el IVA de ${Math.round(ivaAcreditable / 100).toLocaleString("es-MX")} pesos te baja el IVA que pagas ese mes.`);
    out.push("Cómpralo el mismo mes en que cobras a EK: así ese IVA se descuenta justo cuando más IVA debes.");
  }
  if (costo > 200_000) out.push("Paga con tarjeta o transferencia, no en efectivo (arriba de $2,000 en efectivo no sirve para impuestos).");
  if (costo >= 1_000_000) out.push("Si lo pagas a meses sin intereses, que la mensualidad no pase de 30% de tu límite y págala completa cada mes: suma a tu historial.");
  if (i.rentable && i.retorno <= 2) out.push("Se renta por día en CDMX: réntalo hasta que lo uses 3 o más veces al mes; entonces conviene comprarlo.");
  if (i.prioridad >= 3 && opciones.semaforo?.color === "verde") out.push("Ya alcanza, pero no es urgente: compra primero lo imprescindible que falte.");
  return out;
}
