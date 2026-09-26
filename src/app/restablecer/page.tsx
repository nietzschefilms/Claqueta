"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CampoContrasena } from "@/components/CampoContrasena";
import { errorContrasena, MIN_CONTRASENA } from "@/lib/contrasena";

// Crear contraseña nueva después del link de recuperación.
export default function Restablecer() {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [haySesion, setHaySesion] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let vivo = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (vivo && session) setHaySesion(true);
    });
    // Dale un momento al cliente para leer el token del link y revisa.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (vivo) setHaySesion(!!data.session);
    }, 700);
    return () => {
      vivo = false;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const invalida = errorContrasena(pass);
    if (invalida) return setError(invalida);
    if (pass !== pass2) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    const { error: err } = await createClient().auth.updateUser({ password: pass, data: { pwd_set: true } });
    setCargando(false);
    if (err) return setError("No se pudo guardar. El link pudo haber vencido; pide uno nuevo.");
    setListo(true);
    setTimeout(() => (window.location.href = "/app"), 1200);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-4 py-12">
      <div className="tarjeta aparecer p-6">
      {haySesion === false ? (
        <>
          <h1 className="titulo text-4xl">Este link ya no sirve</h1>
          <p className="mt-2 text-muted">Puede que haya vencido. Pide uno nuevo.</p>
          <Link href="/recuperar" className="btn-primario mt-6">Pedir otro link</Link>
        </>
      ) : listo ? (
        <p className="alerta-ok">Contraseña guardada. Entrando...</p>
      ) : (
        <>
          <h1 className="titulo text-4xl">Crea tu contraseña nueva</h1>
          <p className="mt-1 text-sm text-muted">Al menos {MIN_CONTRASENA} caracteres, con minúsculas, mayúsculas y un número.</p>
          <form onSubmit={guardar} className="mt-6 space-y-3">
            {error && <p className="alerta-error" role="alert">{error}</p>}
            <CampoContrasena id="restablecer-pass" autoComplete="new-password" required minLength={MIN_CONTRASENA} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña nueva" className="campo" />
            <CampoContrasena id="restablecer-pass2" autoComplete="new-password" required minLength={MIN_CONTRASENA} value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Repítela" className="campo" />
            <button type="submit" disabled={cargando || haySesion === null} className="btn-primario w-full">
              {cargando ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        </>
      )}
      </div>
    </main>
  );
}
