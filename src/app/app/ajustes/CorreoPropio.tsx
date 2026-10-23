"use client";

import { useState, useTransition } from "react";
import { ponerMiCorreo } from "./acciones";

// Para quien entra con su celular: poner (o cambiar) su correo.
export function CorreoPropio() {
  const [correo, setCorreo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await ponerMiCorreo(correo);
          setMsg(r.ok ? { ok: true, t: "Listo. Ya puedes entrar con tu correo o con tu celular." } : { ok: false, t: r.error ?? "No se pudo." });
        });
      }}
      className="flex flex-wrap gap-2"
    >
      <input id="ajustes-correo" type="email" required autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" aria-label="Tu correo" className="campo flex-1" />
      <button type="submit" disabled={pendiente} className="btn-secundario">{pendiente ? "Guardando…" : "Poner mi correo"}</button>
      {msg && <p className={`w-full ${msg.ok ? "alerta-ok" : "alerta-error"}`} role={msg.ok ? "status" : "alert"}>{msg.t}</p>}
    </form>
  );
}
