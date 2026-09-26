import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sumarDias } from "./fechas";
import type { Bloque, Hito, Tarea } from "./tipos";
import type { Contrato, Cuenta, Gasto, Pago, ReglaIngreso, Transferencia } from "./dinero";

// Lecturas con el cliente de sesión: RLS deja ver solo lo propio.

const CAMPOS_TAREA = "id, title, area, due_date, est_minutes, impact, status, done_at, repeat, notes, milestone_id, created_at";

// Pendientes y en curso, más lo hecho en los últimos días (para verlo tachado).
export async function cargarTareas(hoy: string): Promise<Tarea[]> {
  const supabase = await createClient();
  const desde = `${sumarDias(hoy, -2)}T00:00:00Z`;
  const { data, error } = await supabase
    .from("tasks")
    .select(CAMPOS_TAREA)
    .is("archived_at", null)
    .or(`status.neq.hecho,done_at.gte.${desde}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(`No se pudieron leer las tareas: ${error.message}`);
  return (data ?? []) as Tarea[];
}

export async function cargarRutina(): Promise<Bloque[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routine_blocks")
    .select("id, weekday, start_time, end_time, label, kind, areas")
    .order("weekday")
    .order("start_time");
  if (error) throw new Error(`No se pudo leer la rutina: ${error.message}`);
  return (data ?? []) as Bloque[];
}

export async function cargarHitos(project = "ek"): Promise<Hito[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("id, project, week, title, done, done_at")
    .eq("project", project)
    .order("week");
  if (error) throw new Error(`No se pudieron leer los hitos: ${error.message}`);
  return (data ?? []) as Hito[];
}

// ─── Dinero ───────────────────────────────────────────────────────────────

export async function cargarDinero() {
  const supabase = await createClient();
  const [reglas, pagos, gastos, contratos, cuentas, transferencias] = await Promise.all([
    supabase.from("income_rules").select("id, source, amount, rule, date, area, desde, activo, gravable").eq("activo", true).order("source"),
    supabase.from("payments").select("id, cuenta_id, source, amount, date, expected_key, contract_id, area, note, gravable, factura, cliente_tipo, subtotal, iva, ret_isr, ret_iva").is("anulado_at", null).order("date", { ascending: false }).limit(2000),
    supabase.from("expenses").select("id, cuenta_id, amount, category, date, note").is("anulado_at", null).order("date", { ascending: false }).limit(2000),
    supabase.from("contracts").select("id, client, total, start_date, pay_deadline, area").order("start_date"),
    supabase.from("cuentas").select("id, nombre, tipo, saldo_inicial, dia_corte, dia_pago, orden").eq("activo", true).order("orden"),
    supabase.from("transferencias").select("id, desde_id, hacia_id, amount, date, note").is("anulado_at", null).order("date", { ascending: false }).limit(2000)
  ]);
  const error = reglas.error ?? pagos.error ?? gastos.error ?? contratos.error ?? cuentas.error ?? transferencias.error;
  if (error) throw new Error(`No se pudo leer el dinero: ${error.message}`);
  return {
    reglas: (reglas.data ?? []) as ReglaIngreso[],
    pagos: (pagos.data ?? []) as Pago[],
    gastos: (gastos.data ?? []) as Gasto[],
    contratos: (contratos.data ?? []) as Contrato[],
    cuentas: (cuentas.data ?? []) as Cuenta[],
    transferencias: (transferencias.data ?? []) as Transferencia[]
  };
}
