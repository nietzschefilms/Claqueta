"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Pide el link para crear una contraseña nueva. Siempre responde lo mismo,
// exista o no el correo, para no revelar quién tiene cuenta.
export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    const origen = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await createClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${origen}/auth/callback`
    });
    setCargando(false);
    setEnviado(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="font-display text-3xl font-bold">Recupera tu acceso</h1>
      {enviado ? (
        <p className="alerta-ok mt-6">Si ese correo tiene cuenta, te llegó un link para crear tu contraseña nueva. Revisa también spam.</p>
      ) : (
        <form onSubmit={pedir} className="mt-6 space-y-3">
          <label className="block">
            <span className="etiqueta">Tu correo</span>
            <input id="recuperar-correo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="campo mt-1" />
          </label>
          <button type="submit" disabled={cargando} className="btn-primario w-full">
            {cargando ? "Enviando..." : "Mandarme el link"}
          </button>
        </form>
      )}
      <Link href="/entrar" className="mt-4 text-center text-sm text-muted hover:underline">Volver a entrar</Link>
    </main>
  );
}
