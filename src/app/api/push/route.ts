import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Guarda (o actualiza) la suscripcion push del dispositivo actual.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "sin sesion" }, { status: 401 });

  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    sub = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "cuerpo invalido" }, { status: 400 });
  }
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ ok: false, error: "suscripcion incompleta" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_suscripciones").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      agente: req.headers.get("user-agent")?.slice(0, 200) ?? null
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Borra la suscripcion de este dispositivo (al desactivar).
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "sin sesion" }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "cuerpo invalido" }, { status: 400 });
  }
  if (!body?.endpoint) return NextResponse.json({ ok: false, error: "falta endpoint" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("push_suscripciones").delete().eq("endpoint", body.endpoint).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
