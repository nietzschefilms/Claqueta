"use server";

import { revalidatePath } from "next/cache";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { esFrente } from "@/lib/claqueta/frentes";
import { esFechaISO, fechaCDMX } from "@/lib/claqueta/fechas";
import { aCentavos, claveEsperado, ocurrencias, type ReglaIngreso } from "@/lib/claqueta/dinero";
import { desgloseFactura } from "@/lib/claqueta/impuestos";

// Dinero: cero errores. Cada monto se valida en el servidor y se guarda tal cual
// lo escribió la persona. Nada se borra: lo mal capturado se anula.

export type Resultado = { ok: boolean; error?: string; mensaje?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refrescar = () => revalidatePath("/app", "layout");
const pesosDe = (c: number) => (c / 100).toFixed(2);

function leerMontoYFecha(form: FormData): { centavos: number; fecha: string } | { error: string } {
  const centavos = aCentavos(String(form.get("monto") ?? ""));
  const fecha = String(form.get("fecha") ?? "").trim() || fechaCDMX();
  if (!centavos) return { error: "Escribe un monto mayor a cero, con máximo dos decimales. Ej. 350 o 1250.50" };
  if (centavos > 100_000_000) return { error: "Ese monto se ve demasiado alto. Revísalo." };
  if (!esFechaISO(fecha)) return { error: "La fecha no es válida. Elige una del calendario." };
  if (fecha > fechaCDMX()) return { error: "La fecha no puede ser del futuro." };
  return { centavos, fecha };
}

// La cuenta debe existir, ser propia (RLS) y del tipo permitido.
async function cuentaValida(supabase: Awaited<ReturnType<typeof createClient>>, id: string, tipos: string[]) {
  if (!UUID.test(id)) return false;
  const { data } = await supabase.from("cuentas").select("tipo").eq("id", id).eq("activo", true).maybeSingle<{ tipo: string }>();
  return !!data && tipos.includes(data.tipo);
}

// Gasto rápido.
export async function registrarGasto(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const m = leerMontoYFecha(form);
  if ("error" in m) return { ok: false, error: m.error };
  const categoria = String(form.get("categoria") ?? "").trim();
  const nota = String(form.get("nota") ?? "").trim();
  if (!categoria) return { ok: false, error: "Elige o escribe una categoría." };
  if (categoria.length > 60) return { ok: false, error: "La categoría es muy larga. Déjala en menos de 60 letras." };

  const supabase = await createClient();
  const cuenta = String(form.get("cuenta") ?? "");
  if (!(await cuentaValida(supabase, cuenta, ["debito", "efectivo", "credito"]))) return { ok: false, error: "Elige con qué pagaste: débito, efectivo o una tarjeta." };
  const { error } = await supabase.from("expenses").insert({ user_id: s.userId, amount: pesosDe(m.centavos), category: categoria, date: m.fecha, note: nota || null, cuenta_id: cuenta });
  if (error) return { ok: false, error: "No se guardó el gasto. Revisa tu conexión e inténtalo de nuevo." };
  refrescar();
  return { ok: true, mensaje: "Gasto guardado." };
}

// Entrada suelta: comisiones, abono del cliente, dinero de los papás u otro ingreso.
// Con factura, el monto capturado es el SUBTOTAL y se calcula IVA, retenciones y depósito.
export async function registrarEntrada(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const m = leerMontoYFecha(form);
  if ("error" in m) return { ok: false, error: m.error };
  const fuente = String(form.get("fuente") ?? "").trim();
  const area = String(form.get("area") ?? "");
  const contrato = String(form.get("contrato") ?? "");
  const nota = String(form.get("nota") ?? "").trim();
  const gravable = form.get("gravable") !== "no";
  const factura = form.get("factura") === "si";
  const cliente = String(form.get("cliente_tipo") ?? "");
  if (!fuente || fuente.length > 80) return { ok: false, error: "Escribe de dónde vino el dinero." };
  if (area && !esFrente(area)) return { ok: false, error: "Frente no válido." };
  if (contrato && !UUID.test(contrato)) return { ok: false, error: "Contrato no válido." };
  if (factura && !gravable) return { ok: false, error: "Si lleva factura es de tu trabajo: cuenta para impuestos." };
  if (factura && cliente !== "moral" && cliente !== "fisica") return { ok: false, error: "Elige si le facturaste a una empresa o a una persona." };

  const supabase = await createClient();
  const cuenta = String(form.get("cuenta") ?? "");
  if (!(await cuentaValida(supabase, cuenta, ["debito", "efectivo"]))) return { ok: false, error: "Elige dónde entró: débito o efectivo." };

  const d = factura ? desgloseFactura(m.centavos, cliente as "moral" | "fisica") : null;
  const { error } = await supabase.from("payments").insert({
    user_id: s.userId,
    cuenta_id: cuenta,
    source: fuente,
    amount: pesosDe(d ? d.deposito : m.centavos),
    date: m.fecha,
    area: area || null,
    contract_id: contrato || null,
    note: nota || null,
    gravable,
    factura,
    cliente_tipo: d ? cliente : null,
    subtotal: d ? pesosDe(d.subtotal) : null,
    iva: d ? pesosDe(d.iva) : 0,
    ret_isr: d ? pesosDe(d.retIsr) : 0,
    ret_iva: d ? pesosDe(d.retIva) : 0
  });
  if (error) return { ok: false, error: "No se guardó la entrada. Revisa tu conexión e inténtalo de nuevo." };
  refrescar();
  return { ok: true, mensaje: d ? `Guardado. Te depositan $${pesosDe(d.deposito)}.` : "Entrada guardada." };
}

// "Ya llegó": confirma un cobro esperado (Top Mart, clínica). El índice único evita duplicarlo.
export async function confirmarCobro(reglaId: string, fecha: string, cuentaId: string, montoTexto?: string): Promise<Resultado> {
  const s = await requerirSesion();
  if (!UUID.test(reglaId) || !esFechaISO(fecha)) return { ok: false, error: "Cobro no válido." };
  const supabase = await createClient();
  const { data: r } = await supabase.from("income_rules").select("id, source, amount, rule, date, area, desde, activo, gravable").eq("id", reglaId).maybeSingle<ReglaIngreso>();
  if (!r) return { ok: false, error: "No encontré ese ingreso." };
  if (!ocurrencias(r, fecha, fecha).length) return { ok: false, error: "Ese día no toca ese cobro." };
  const centavos = montoTexto ? aCentavos(montoTexto) : aCentavos(r.amount);
  if (!centavos) return { ok: false, error: "Escribe un monto válido." };
  if (!(await cuentaValida(supabase, cuentaId, ["debito", "efectivo"]))) return { ok: false, error: "Elige dónde entró: débito o efectivo." };

  const { error } = await supabase.from("payments").insert({
    user_id: s.userId,
    cuenta_id: cuentaId,
    source: r.source,
    amount: pesosDe(centavos),
    date: fecha > fechaCDMX() ? fechaCDMX() : fecha,
    area: r.area,
    gravable: r.gravable !== false,
    expected_key: claveEsperado(r.id, fecha)
  });
  if (error?.code === "23505") return { ok: true, mensaje: "Ya estaba confirmado." };
  if (error) return { ok: false, error: "No se guardó. Inténtalo de nuevo." };
  refrescar();
  return { ok: true };
}

// Mover dinero entre cuentas: pagar una tarjeta, apartar en la garantía, sacar efectivo.
// No es gasto ni ingreso: solo cambia de lugar.
export async function registrarTransferencia(_prev: Resultado | null, form: FormData): Promise<Resultado> {
  const s = await requerirSesion();
  const m = leerMontoYFecha(form);
  if ("error" in m) return { ok: false, error: m.error };
  const desde = String(form.get("desde") ?? "");
  const hacia = String(form.get("hacia") ?? "");
  const nota = String(form.get("nota") ?? "").trim();
  if (desde === hacia) return { ok: false, error: "Elige dos cuentas distintas." };
  const supabase = await createClient();
  const todas = ["debito", "efectivo", "credito", "garantia"];
  if (!(await cuentaValida(supabase, desde, todas)) || !(await cuentaValida(supabase, hacia, todas))) return { ok: false, error: "Elige de qué cuenta sale y a cuál llega." };
  const { error } = await supabase.from("transferencias").insert({ user_id: s.userId, desde_id: desde, hacia_id: hacia, amount: pesosDe(m.centavos), date: m.fecha, note: nota || null });
  if (error) return { ok: false, error: "No se guardó. Revisa tu conexión e inténtalo de nuevo." };
  refrescar();
  return { ok: true, mensaje: "Listo, movido." };
}

const TABLA = { entrada: "payments", gasto: "expenses", movimiento: "transferencias" } as const;

// Anular una entrada, gasto o movimiento mal capturado (no se borra).
export async function anularMovimiento(tipo: keyof typeof TABLA, id: string): Promise<Resultado> {
  await requerirSesion();
  if (!UUID.test(id) || !(tipo in TABLA)) return { ok: false, error: "Movimiento no válido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLA[tipo])
    .update({ anulado_at: new Date().toISOString() })
    .eq("id", id)
    .is("anulado_at", null);
  if (error) return { ok: false, error: "No se pudo anular. Inténtalo de nuevo." };
  refrescar();
  return { ok: true };
}
