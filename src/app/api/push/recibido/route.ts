import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// El service worker avisa que le llegó un push (y si falló al mostrarlo).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  let b: { titulo?: string; tag?: string; error?: string | null } = {};
  try {
    b = await req.json();
  } catch {
    /* cuerpo vacío */
  }
  await supabase.from("avisos_recibidos").insert({
    user_id: user.id,
    titulo: b.titulo?.slice(0, 200) ?? null,
    tag: b.tag?.slice(0, 80) ?? null,
    error: b.error?.slice(0, 300) ?? null,
    agente: req.headers.get("user-agent")?.slice(0, 200) ?? null
  });
  return NextResponse.json({ ok: true });
}
