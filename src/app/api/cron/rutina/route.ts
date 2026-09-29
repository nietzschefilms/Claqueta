import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificar } from "@/lib/notificaciones";
import { diaSemana, fechaCDMX, minutosAhoraCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { planearDia } from "@/lib/claqueta/planeador";
import { avisosRutina } from "@/lib/claqueta/avisos";
import { eventoABloque } from "@/lib/claqueta/estudio";
import type { Bloque, Tarea } from "@/lib/claqueta/tipos";
import { estadoFijo, type GastoFijo } from "@/lib/claqueta/plan";
import { prefsDe } from "@/lib/notif-prefs";
import { aCentavos, pesos } from "@/lib/claqueta/dinero";

export const dynamic = "force-dynamic";

// Avisos de rutina. Lo llama pg_cron cada minuto (migración 0006):
//   select cron.schedule('claqueta-rutina', '* * * * *', ... net.http_post(.../api/cron/rutina) ...)
// Manda push 5 min antes de cada bloque y al empezar. avisos_enviados evita repetir.
export async function GET(req: Request) {
  if (!(await cronAutorizado(req))) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  const hoy = fechaCDMX();
  const ahora = minutosAhoraCDMX();
  const { data: personas } = await admin.from("perfiles").select("id, notif_prefs").eq("activo", true);
  let enviados = 0;

  for (const { id, notif_prefs } of personas ?? []) {
    const prefs = prefsDe(notif_prefs);
    // A las 9:00: cargos fijos que se cobran hoy (Claude, Meli+).
    if (ahora >= 9 * 60 && ahora < 9 * 60 + 3) {
      const [{ data: fijos }, { data: gastosMes }] = await Promise.all([
        admin.from("gastos_fijos").select("id, nombre, moneda, monto, monto_mxn, dia, creado_en").eq("user_id", id).eq("activo", true),
        admin.from("expenses").select("fijo_key").eq("user_id", id).is("anulado_at", null).like("fijo_key", `%:${hoy.slice(0, 7)}`)
      ]);
      const cobrados = new Set((gastosMes ?? []).map((g) => g.fijo_key as string));
      for (const f of (fijos ?? []) as GastoFijo[]) {
        const e = estadoFijo(f, hoy, f.creado_en ? fechaCDMX(f.creado_en) : hoy, cobrados);
        if (e.estado !== "pendiente" || e.fecha !== hoy) continue;
        const { error } = await admin.from("avisos_enviados").insert({ user_id: id, clave: `${hoy}:fijo:${f.id}` });
        if (error) continue;
        const monto = f.moneda === "USD" ? `US$${Number(f.monto)} (≈ ${pesos(aCentavos(f.monto_mxn) ?? 0)})` : pesos(aCentavos(f.monto_mxn) ?? 0);
        const r = await notificar(id, { titulo: `Hoy se cobra ${f.nombre}`, cuerpo: `${monto}. Cuando salga, anótalo en Dinero.`, href: "/app/dinero", categoria: "operativo", tag: `fijo-${f.id}`, urgente: true });
        await admin.from("avisos_enviados").update({ entregas: r.enviadas, error: r.error ?? null }).eq("user_id", id).eq("clave", `${hoy}:fijo:${f.id}`);
        enviados += 1;
      }
    }

    const [{ data: rutina }, { data: tareas }, { data: citas }] = await Promise.all([
      admin.from("routine_blocks").select("id, weekday, start_time, end_time, label, kind, areas, salon, piso, profesor, clave").eq("user_id", id).eq("weekday", diaSemana(hoy)),
      admin
        .from("tasks")
        .select("id, title, area, due_date, est_minutes, impact, status, done_at, repeat, notes, milestone_id, created_at, materia, dificultad")
        .eq("user_id", id)
        .is("archived_at", null)
        .or(`status.neq.hecho,done_at.gte.${sumarDias(hoy, -1)}T00:00:00Z`)
        .limit(500),
      // Citas del equipo de hoy a las que va (vacío = todo el equipo).
      admin.from("equipo_miembros").select("equipo_id").eq("user_id", id).then(async ({ data: eqs }) => {
        const ids = (eqs ?? []).map((e) => e.equipo_id as string);
        if (!ids.length) return { data: [] };
        return admin.from("eventos").select("id, fecha, inicio, fin, titulo, tipo, lugar, participantes").in("equipo_id", ids).eq("fecha", hoy).is("cancelado_at", null);
      })
    ]);
    const bloques = [
      ...((rutina ?? []) as Bloque[]),
      ...((citas ?? []) as { id: string; fecha: string; inicio: string; fin: string; titulo: string; tipo: string; lugar: string | null; participantes: string[] }[])
        .filter((e) => !e.participantes?.length || e.participantes.includes(id))
        .map(eventoABloque)
    ];
    if (!bloques.length) continue;

    const plan = planearDia(bloques as Bloque[], (tareas ?? []) as Tarea[], hoy);
    for (const a of avisosRutina(plan.bloques, ahora, hoy)) {
      // Si ya existe la clave, otra corrida lo mandó: se salta.
      const { error } = await admin.from("avisos_enviados").insert({ user_id: id, clave: a.clave });
      if (error) continue;
      const previo = a.clave.endsWith(":antes");
      const r = await notificar(id, {
        titulo: a.titulo,
        cuerpo: a.cuerpo,
        href: "/app",
        categoria: previo ? "rutina_previo" : "rutina",
        tag: "rutina",
        soloPush: true,
        urgente: true,
        ttlSegundos: 10 * 60,
        silencioso: previo ? !prefs.sonido_previo : !prefs.sonido_ahora
      });
      await admin.from("avisos_enviados").update({ entregas: r.enviadas, error: r.error ?? (r.apagada ? "categoría apagada" : null) }).eq("user_id", id).eq("clave", a.clave);
      enviados += 1;
    }
  }
  return NextResponse.json({ ok: true, enviados });
}

export const POST = GET;
