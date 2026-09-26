import { NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-auth";
import { notificarRoles } from "@/lib/notificaciones";

export const dynamic = "force-dynamic";

// EJEMPLO de cron. Cópialo para cada tarea programada del cliente
// (recordatorios de clase, cobros por vencer, resumen del día).
//
// Cómo programarlo en Supabase (SQL Editor), todos los días 7:00 am CDMX (13:00 UTC):
//   select cron.schedule('resumen-diario', '0 13 * * *', $$
//     select net.http_post(
//       url := 'https://TU-DOMINIO/api/cron/resumen-diario',
//       headers := jsonb_build_object('Authorization', 'Bearer ' ||
//         (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
//     );
//   $$);
export async function GET(req: Request) {
  if (!(await cronAutorizado(req))) return NextResponse.json({ ok: false }, { status: 401 });
  const avisados = await notificarRoles(["admin"], {
    titulo: "Buenos días",
    cuerpo: "Revisa lo pendiente de hoy.",
    href: "/app",
    categoria: "operativo",
    tag: "resumen-diario"
  });
  return NextResponse.json({ ok: true, avisados });
}

export const POST = GET;
