import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificar } from "@/lib/notificaciones";
import { diaSemana, fechaCDMX, minutosAhoraCDMX, sumarDias } from "@/lib/claqueta/fechas";
import { planearDia } from "@/lib/claqueta/planeador";
import { avisosRutina } from "@/lib/claqueta/avisos";
import type { Bloque, Tarea } from "@/lib/claqueta/tipos";

export const dynamic = "force-dynamic";

// Avisos de rutina. Lo llama pg_cron cada minuto (migración 0006):
//   select cron.schedule('claqueta-rutina', '* * * * *', ... net.http_post(.../api/cron/rutina) ...)
// Manda push 5 min antes de cada bloque y al empezar. avisos_enviados evita repetir.
export async function GET(req: Request) {
  if (!(await cronAutorizado(req))) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  const hoy = fechaCDMX();
  const ahora = minutosAhoraCDMX();
  const { data: personas } = await admin.from("perfiles").select("id").eq("activo", true);
  let enviados = 0;

  for (const { id } of personas ?? []) {
    const [{ data: bloques }, { data: tareas }] = await Promise.all([
      admin.from("routine_blocks").select("id, weekday, start_time, end_time, label, kind, areas, salon, piso, profesor, clave").eq("user_id", id).eq("weekday", diaSemana(hoy)),
      admin
        .from("tasks")
        .select("id, title, area, due_date, est_minutes, impact, status, done_at, repeat, notes, milestone_id, created_at, materia, dificultad")
        .eq("user_id", id)
        .is("archived_at", null)
        .or(`status.neq.hecho,done_at.gte.${sumarDias(hoy, -1)}T00:00:00Z`)
        .limit(500)
    ]);
    if (!bloques?.length) continue;

    const plan = planearDia(bloques as Bloque[], (tareas ?? []) as Tarea[], hoy);
    for (const a of avisosRutina(plan.bloques, ahora, hoy)) {
      // Si ya existe la clave, otra corrida lo mandó: se salta.
      const { error } = await admin.from("avisos_enviados").insert({ user_id: id, clave: a.clave });
      if (error) continue;
      await notificar(id, { titulo: a.titulo, cuerpo: a.cuerpo, href: "/app", categoria: "rutina", tag: "rutina", soloPush: true });
      enviados += 1;
    }
  }
  return NextResponse.json({ ok: true, enviados });
}

export const POST = GET;
