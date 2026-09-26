"use client";

import { useState, useTransition } from "react";
import { guardarPerfil, guardarPrefsNotif } from "./acciones";
import { CATEGORIAS, type NotifPrefs } from "@/lib/notif-prefs";

export function FormPerfil({ nombre, telefono }: { nombre: string; telefono: string }) {
  const [n, setN] = useState(nombre);
  const [t, setT] = useState(telefono);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await guardarPerfil({ nombre: n, telefono: t });
          setMsg(r.ok ? { ok: true, texto: "Guardado." } : { ok: false, texto: r.error ?? "No se pudo guardar." });
        });
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="block">
        <span className="etiqueta">Nombre</span>
        <input id="perfil-nombre" value={n} onChange={(e) => setN(e.target.value)} className="campo mt-1" autoComplete="name" />
      </label>
      <label className="block">
        <span className="etiqueta">Teléfono</span>
        <input id="perfil-telefono" value={t} onChange={(e) => setT(e.target.value)} className="campo mt-1" inputMode="tel" autoComplete="tel" />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pendiente} className="btn-primario">{pendiente ? "Guardando..." : "Guardar"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-ok" : "text-peligro"}`} role="status">{msg.texto}</span>}
      </div>
    </form>
  );
}

export function PrefsNotif({ inicial }: { inicial: NotifPrefs }) {
  const [prefs, setPrefs] = useState(inicial);
  const [, iniciar] = useTransition();

  function cambiar(clave: keyof NotifPrefs, valor: boolean) {
    const nuevo = { ...prefs, [clave]: valor };
    setPrefs(nuevo);
    iniciar(async () => {
      await guardarPrefsNotif(nuevo);
    });
  }

  return (
    <ul className="divide-y divide-borde border-t border-borde">
      {CATEGORIAS.map((c) => (
        <li key={c.clave} className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-semibold">{c.label}</p>
            <p className="text-xs text-muted">{c.obligatoria ? `${c.desc} Siempre activas.` : c.desc}</p>
          </div>
          <input
            id={`notif-${c.clave}`}
            type="checkbox"
            className="h-5 w-5 accent-[rgb(var(--c-primario))]"
            checked={prefs[c.clave]}
            disabled={c.obligatoria}
            onChange={(e) => cambiar(c.clave, e.target.checked)}
            aria-label={c.label}
          />
        </li>
      ))}
    </ul>
  );
}
