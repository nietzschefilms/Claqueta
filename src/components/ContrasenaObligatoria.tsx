"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CampoContrasena } from "@/components/CampoContrasena";

// Popup obligatorio la primera vez que alguien entra con la contraseña temporal
// que le dio soporte. No se puede cerrar hasta que ponga una propia.
export function ContrasenaObligatoria() {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pass.length < 8) return setError("Usa al menos 8 caracteres.");
    if (pass !== pass2) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    const { error: err } = await createClient().auth.updateUser({ password: pass, data: { pwd_set: true } });
    setCargando(false);
    if (err) return setError("No se pudo guardar. Intenta con otra contraseña.");
    setListo(true);
    setTimeout(() => window.location.reload(), 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pass-titulo">
      <form onSubmit={guardar} className="tarjeta w-full max-w-sm space-y-3">
        <h2 id="pass-titulo" className="font-display text-xl font-semibold">Crea tu contraseña</h2>
        <p className="text-sm text-muted">Entraste con una contraseña temporal. Pon una tuya para seguir.</p>
        {error && <p className="alerta-error">{error}</p>}
        {listo ? (
          <p className="alerta-ok">Listo, contraseña guardada.</p>
        ) : (
          <>
            <CampoContrasena id="pass-nueva" autoComplete="new-password" required minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña nueva" className="campo" />
            <CampoContrasena id="pass-repite" autoComplete="new-password" required minLength={8} value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Repítela" className="campo" />
            <button type="submit" disabled={cargando} className="btn-primario w-full">{cargando ? "Guardando..." : "Guardar contraseña"}</button>
          </>
        )}
      </form>
    </div>
  );
}
