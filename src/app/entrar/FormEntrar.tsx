"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CampoContrasena } from "@/components/CampoContrasena";

// Login con correo y contraseña (el patrón de Rompiendo Tabúes: sin magic
// link, porque los links se pierden entre WhatsApp y el correo).
export function FormEntrar() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const { error: err } = await createClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass
    });
    if (err) {
      setCargando(false);
      setError(
        /confirm/i.test(err.message)
          ? "Tu correo aún no está confirmado. Escríbenos para activarlo."
          : "Correo o contraseña incorrectos. Revisa y vuelve a intentar."
      );
      return;
    }
    window.location.href = "/app";
  }

  return (
    <form onSubmit={entrar} className="mt-4 space-y-4">
      {error && <p className="alerta-error" role="alert">{error}</p>}
      <label className="block">
        <span className="etiqueta">Correo</span>
        <input id="entrar-correo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="campo mt-1" />
      </label>
      <label className="block">
        <span className="etiqueta">Contraseña</span>
        <div className="mt-1">
          <CampoContrasena id="entrar-pass" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} className="campo" />
        </div>
      </label>
      <button type="submit" disabled={cargando} className="btn-primario mt-2 w-full py-3">
        {cargando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
