import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { esFrente, type FrenteId } from "./frentes";
import { sumarDias } from "./fechas";
import type { Bloque, Hito, Tarea } from "./tipos";
import type { Contrato, Cuenta, Gasto, Pago, ReglaIngreso, Transferencia } from "./dinero";
import type { GastoFijo } from "./plan";

// Lecturas con el cliente de sesión: RLS deja ver solo lo propio.

const CAMPOS_TAREA = "id, user_id, title, area, due_date, est_minutes, impact, status, done_at, repeat, notes, milestone_id, created_at, materia, dificultad, equipo_id, asignada_a";

// ─── Perfil: frentes, régimen, equipo y compañeros ────────────────────────
export type Companero = { id: string; nombre: string; equipo_id: string };
export type Equipo = { id: string; nombre: string; frente: FrenteId };
export type PerfilClaqueta = {
  id: string;
  nombre: string;
  frentes: FrenteId[];
  resicoDesde: string | null;
  bienvenidaVista: boolean;
  equipos: Equipo[];
  companeros: Companero[];
};

export const cargarPerfil = cache(async (userId: string): Promise<PerfilClaqueta> => {
  const supabase = await createClient();
  const [p, e, c] = await Promise.all([
    supabase.from("perfiles").select("nombre, frentes, resico_desde, bienvenida_vista").eq("id", userId).maybeSingle(),
    supabase.from("equipos").select("id, nombre, frente").order("creado_en"),
    supabase.rpc("companeros")
  ]);
  const frentes = ((p.data?.frentes as string[] | null) ?? []).filter(esFrente);
  return {
    id: userId,
    nombre: (p.data?.nombre as string) || "",
    frentes: frentes.length ? frentes : ["escuela", "nietzsche", "personal"],
    resicoDesde: (p.data?.resico_desde as string | null) ?? null,
    bienvenidaVista: p.data?.bienvenida_vista !== false,
    equipos: ((e.data ?? []) as Equipo[]).filter((x) => esFrente(x.frente)),
    companeros: ((c.data ?? []) as Companero[]).filter((x) => x.id !== userId)
  };
});

// ¿Me toca a mí? Si está asignada, a quien la tiene. Si es de equipo sin
// asignar ("de los dos"), a todos. Si es privada, a quien la creó.
export function esMia(t: Pick<Tarea, "user_id" | "asignada_a" | "equipo_id">, userId: string) {
  if (t.asignada_a) return t.asignada_a === userId;
  if (t.equipo_id) return true;
  return t.user_id === userId;
}

// Pendientes y en curso, más lo hecho en los últimos días (para verlo tachado).
// Con `mias` deja solo las que le tocan a esa persona (las del equipo asignadas a otro, no).
export async function cargarTareas(hoy: string, mias?: string): Promise<Tarea[]> {
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
  const tareas = (data ?? []) as Tarea[];
  return mias ? tareas.filter((t) => esMia(t, mias)) : tareas;
}

export async function cargarRutina(): Promise<Bloque[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routine_blocks")
    .select("id, weekday, start_time, end_time, label, kind, areas, salon, piso, profesor, clave")
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
  const [reglas, pagos, gastos, contratos, cuentas, transferencias, fijos] = await Promise.all([
    supabase.from("income_rules").select("id, source, amount, rule, date, area, desde, activo, gravable").eq("activo", true).order("source"),
    supabase.from("payments").select("id, cuenta_id, source, amount, date, expected_key, contract_id, area, note, gravable, factura, cliente_tipo, subtotal, iva, ret_isr, ret_iva").is("anulado_at", null).order("date", { ascending: false }).limit(2000),
    supabase.from("expenses").select("id, cuenta_id, amount, category, date, note, fijo_key").is("anulado_at", null).order("date", { ascending: false }).limit(2000),
    supabase.from("contracts").select("id, client, total, start_date, pay_deadline, area").order("start_date"),
    supabase.from("cuentas").select("id, nombre, tipo, saldo_inicial, dia_corte, dia_pago, orden, limite, garantia_id, limite_extra").eq("activo", true).order("orden"),
    supabase.from("transferencias").select("id, desde_id, hacia_id, amount, date, note").is("anulado_at", null).order("date", { ascending: false }).limit(2000),
    supabase.from("gastos_fijos").select("id, nombre, categoria, moneda, monto, monto_mxn, dia, cuenta_id, creado_en").eq("activo", true).order("nombre")
  ]);
  const error = reglas.error ?? pagos.error ?? gastos.error ?? contratos.error ?? cuentas.error ?? transferencias.error ?? fijos.error;
  if (error) throw new Error(`No se pudo leer el dinero: ${error.message}`);
  return {
    reglas: (reglas.data ?? []) as ReglaIngreso[],
    pagos: (pagos.data ?? []) as Pago[],
    gastos: (gastos.data ?? []) as Gasto[],
    contratos: (contratos.data ?? []) as Contrato[],
    cuentas: (cuentas.data ?? []) as Cuenta[],
    transferencias: (transferencias.data ?? []) as Transferencia[],
    fijos: (fijos.data ?? []) as GastoFijo[]
  };
}
