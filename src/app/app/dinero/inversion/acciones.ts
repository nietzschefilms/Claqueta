"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { esFechaISO, fechaCDMX } from "@/lib/claqueta/fechas";
import { aCentavos } from "@/lib/claqueta/dinero";
import { CATEGORIAS_INVERSION } from "@/lib/claqueta/inversion";

// Inversión Nietzsche. Dinero: cero errores; todo se valida aquí y RLS deja
// tocar solo lo propio. Nada se borra: se descarta.

export type Resultado = { ok: boolean; error?: string; mensaje?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pesosDe = (c: number) => (c / 100).toFixed(2);
const refrescar = () => revalidatePath("/app/dinero", "layout");

export type CamposItem = {
  nombre?: string;
  categoria?: string;
  precio?: string;
  cantidad?: number;
  prioridad?: number;
  retorno?: number;
  rentable?: boolean;
  link?: string;
  tienda?: string;
  nota?: string;
};

function validar(c: CamposItem, nuevo: boolean): { ok: true; datos: Record<string, unknown> } | { ok: false; error: string } {
  const d: Record<string, unknown> = {};
  if (c.nombre !== undefined || nuevo) {
    const t = (c.nombre ?? "").trim();
    if (!t || t.length > 120) return { ok: false, error: "Escribe qué es (máximo 120 letras)." };
    d.nombre = t;
  }
  if (c.categoria !== undefined || nuevo) {
    if (!CATEGORIAS_INVERSION.some((x) => x.v === c.categoria)) return { ok: false, error: "Elige una categoría." };
    d.categoria = c.categoria;
  }
  if (c.precio !== undefined || nuevo) {
    const t = String(c.precio ?? "").trim();
    const centavos = t === "" || /^0+([.,]0+)?$/.test(t) ? 0 : aCentavos(t);
    if (centavos === null) return { ok: false, error: "El precio no es válido. Escribe solo el número, ej. 4599 o 4599.90." };
    if (centavos > 50_000_000) return { ok: false, error: "Ese precio se ve demasiado alto. Revísalo." };
    d.precio = pesosDe(centavos);
  }
  if (c.cantidad !== undefined) {
    if (!Number.isInteger(c.cantidad) || c.cantidad < 1 || c.cantidad > 99) return { ok: false, error: "La cantidad va de 1 a 99." };
    d.cantidad = c.cantidad;
  }
  if (c.prioridad !== undefined) {
    if (![1, 2, 3, 4].includes(c.prioridad)) return { ok: false, error: "Prioridad no válida." };
    d.prioridad = c.prioridad;
  }
  if (c.retorno !== undefined) {
    if (![1, 2, 3].includes(c.retorno)) return { ok: false, error: "Retorno no válido." };
    d.retorno = c.retorno;
  }
  if (c.rentable !== undefined) d.rentable = !!c.rentable;
  if (c.link !== undefined) {
    const t = c.link.trim();
    if (t && (!/^https?:\/\/\S+$/.test(t) || t.length > 500)) return { ok: false, error: "El link debe empezar con https:// (máximo 500 letras)." };
    d.link = t || null;
  }
  if (c.tienda !== undefined) {
    const t = c.tienda.trim();
    if (t.length > 60) return { ok: false, error: "El nombre de la tienda es muy largo." };
    d.tienda = t || null;
  }
  if (c.nota !== undefined) {
    const t = c.nota.trim();
    if (t.length > 400) return { ok: false, error: "La nota es muy larga (máximo 400)." };
    d.nota = t || null;
  }
  return { ok: true, datos: d };
}

export async function guardarItem(id: string | null, c: CamposItem): Promise<Resultado> {
  const s = await requerirSesion();
  if (id && !UUID.test(id)) return { ok: false, error: "Artículo no válido." };
  const v = validar(c, !id);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { error } = id ? await supabase.from("inversion_items").update(v.datos).eq("id", id) : await supabase.from("inversion_items").insert({ user_id: s.userId, ...v.datos });
  if (error) return { ok: false, error: "No se guardó. Inténtalo de nuevo." };
  refrescar();
  return { ok: true, mensaje: id ? undefined : "Agregado a tu lista." };
}

export async function cambiarEstadoItem(id: string, estado: "quiero" | "descartado"): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id) || !["quiero", "descartado"].includes(estado)) return { ok: false, error: "Cambio no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("inversion_items").update({ estado }).eq("id", id).neq("estado", "comprado");
  if (error) return { ok: false, error: "No se guardó." };
  refrescar();
  return { ok: true };
}

// Ya lo compré: precio real, fecha y con qué se pagó. Se anota como gasto en Dinero.
export async function marcarComprado(id: string, c: { precio: string; fecha: string; cuenta: string }): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(id)) return { ok: false, error: "Artículo no válido." };
  const centavos = aCentavos(c.precio);
  if (!centavos) return { ok: false, error: "Escribe cuánto pagaste en total." };
  if (!esFechaISO(c.fecha) || c.fecha > fechaCDMX()) return { ok: false, error: "La fecha no es válida o es del futuro." };
  if (!UUID.test(c.cuenta)) return { ok: false, error: "Elige con qué pagaste." };
  const supabase = await createClient();
  const [{ data: item }, { data: cuenta }] = await Promise.all([
    supabase.from("inversion_items").select("nombre, estado").eq("id", id).maybeSingle(),
    supabase.from("cuentas").select("tipo").eq("id", c.cuenta).eq("activo", true).maybeSingle()
  ]);
  if (!item) return { ok: false, error: "No encontré ese artículo." };
  if (item.estado === "comprado") return { ok: false, error: "Ya estaba marcado como comprado." };
  if (!cuenta || !["debito", "efectivo", "credito"].includes(cuenta.tipo as string)) return { ok: false, error: "Elige débito, efectivo o una tarjeta." };
  const { data: gasto, error: e1 } = await supabase
    .from("expenses")
    .insert({ user_id: s.userId, amount: pesosDe(centavos), category: "Equipo de video", date: c.fecha, note: `Inversión Nietzsche: ${item.nombre}`.slice(0, 200), cuenta_id: c.cuenta })
    .select("id")
    .single();
  if (e1 || !gasto) return { ok: false, error: "No se guardó el gasto. No se marcó como comprado." };
  const { error: e2 } = await supabase.from("inversion_items").update({ estado: "comprado", precio_real: pesosDe(centavos), comprado_en: c.fecha, gasto_id: gasto.id }).eq("id", id);
  if (e2) return { ok: false, error: "Se guardó el gasto pero no se marcó el artículo. Márcalo de nuevo o anula el gasto en Dinero." };
  refrescar();
  return { ok: true, mensaje: `¡Comprado! Se anotó el gasto de ${item.nombre}.` };
}

export async function guardarAjustesInversion(c: { contrato_id?: string | null; ya_gastado?: string; reserva_pct?: string; iva_aparte?: boolean }): Promise<Resultado> {
  const s = await requerirSesion();
  const d: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
  if (c.contrato_id !== undefined) {
    if (c.contrato_id !== null && !UUID.test(c.contrato_id)) return { ok: false, error: "Contrato no válido." };
    d.contrato_id = c.contrato_id;
  }
  if (c.ya_gastado !== undefined) {
    const t = c.ya_gastado.trim();
    const v = t === "" || /^0+([.,]0+)?$/.test(t) ? 0 : aCentavos(t);
    if (v === null) return { ok: false, error: "Lo ya gastado no es válido. Escribe solo el número." };
    d.ya_gastado = pesosDe(v);
  }
  if (c.reserva_pct !== undefined) {
    const n = Number(c.reserva_pct);
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(c.reserva_pct.trim()) || n > 100) return { ok: false, error: "La reserva va de 0 a 100%." };
    d.reserva_pct = n;
  }
  if (c.iva_aparte !== undefined) d.iva_aparte = !!c.iva_aparte;
  const supabase = await createClient();
  const { error } = await supabase.from("inversion_ajustes").upsert({ user_id: s.userId, ...d }, { onConflict: "user_id" });
  if (error) return { ok: false, error: "No se guardó." };
  refrescar();
  return { ok: true };
}
