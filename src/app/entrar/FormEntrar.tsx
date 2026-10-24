"use client";

import { useState } from "react";
import { CampoContrasena } from "@/components/CampoContrasena";
import { identificadorDeAcceso } from "@/lib/acceso";
import { entrar as entrarServidor } from "./acciones";

// Login con correo (o celular) y contraseña (el patrón de Rompiendo Tabúes: sin magic
// link, porque los links se pierden entre WhatsApp y el correo).
export function FormEntrar() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identificadorDeAcceso(email)) return setError("Escribe tu correo o tu celular a 10 dígitos.");
    setCargando(true);
    const r = await entrarServidor(email, pass);
    if (!r.ok) {
      setCargando(false);
      setError(r.error ?? "No se pudo entrar. Intenta otra vez.");
      return;
    }
    window.location.href = "/app";
  }

  return (
    <form onSubmit={entrar} className="mt-4 space-y-4">
      {error && <p className="alerta-error" role="alert">{error}</p>}
      <label className="block">
        <span className="etiqueta">Correo o celular</span>
        <input id="entrar-correo" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com o 55 1234 5678" className="campo mt-1" />
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
