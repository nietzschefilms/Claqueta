import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Regreso de los links de correo (recuperar contraseña, invitación).
// Soporta los dos formatos para que funcione aunque se abra en otra app:
//  · token_hash + type → verifyOtp (no depende del navegador que lo pidió)
//  · code              → exchangeCodeForSession (PKCE, mismo navegador)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origen = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") as EmailOtpType | null) ?? "recovery";
  const destino = type === "magiclink" ? "/app" : "/restablecer";

  const supabase = await createClient();

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origen}${destino}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origen}${destino}`);
  }
  return NextResponse.redirect(`${origen}/entrar?estado=recuperacion-invalida`);
}
