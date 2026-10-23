"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Logo } from "@/components/claqueta/Logo";
import { pedirAcceso } from "./acciones";

// Olvidé mi contraseña: un botón que le avisa a soporte. Soporte resetea y te
// manda tu acceso nuevo por WhatsApp. Siempre responde lo mismo, para no
// revelar quién tiene cuenta.
export default function Recuperar() {
  const [usuario, setUsuario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  function pedir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await pedirAcceso(usuario);
      if (!r.ok) return setError(r.error ?? "No se pudo. Intenta otra vez.");
      setEnviado(true);
    });
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-4 py-12">
      <Logo className="mx-auto mb-6 h-12 w-12" />
      <div className="tarjeta aparecer p-6">
        <h1 className="titulo text-4xl">¿Olvidaste tu contraseña?</h1>
        {enviado ? (
          <p className="alerta-ok mt-6">Listo, ya le avisamos a soporte. En un rato te llega por WhatsApp tu acceso nuevo. Al entrar pones tu contraseña.</p>
        ) : (
          <form onSubmit={pedir} className="mt-6 space-y-3">
            <p className="text-sm text-muted">Pon tu correo o tu celular y toca el botón. Soporte te resetea el acceso y te lo manda.</p>
            {error && <p className="alerta-error" role="alert">{error}</p>}
            <label className="block">
              <span className="etiqueta">Correo o celular</span>
              <input id="recuperar-correo" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="tu@correo.com o 55 1234 5678" className="campo mt-1" />
            </label>
            <button type="submit" disabled={cargando} className="btn-rojo w-full py-3">
              {cargando ? "Avisando..." : "Avisar a soporte"}
            </button>
          </form>
        )}
      </div>
      <Link href="/entrar" className="mt-5 text-center text-sm text-muted hover:underline">Volver a entrar</Link>
    </main>
  );
}
