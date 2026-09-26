"use client";

import { useState, useTransition } from "react";
import { guardarPerfil, guardarPrefsNotif } from "./acciones";
import { CATEGORIAS, SONIDOS, type NotifPrefs } from "@/lib/notif-prefs";
import { sonarClaqueta, sonarEnSilencio, sonarEntrada } from "@/lib/sonido";
import { Interruptor } from "@/components/Interruptor";

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
    if (clave === "sonido_en_silencio") sonarEnSilencio(valor);
    setPrefs(nuevo);
    iniciar(async () => {
      await guardarPrefsNotif(nuevo);
    });
  }

  const fila = (clave: keyof NotifPrefs, label: string, desc: string, obligatoria = false) => (
    <li key={clave} className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted">{obligatoria ? `${desc} Siempre activos.` : desc}</p>
      </div>
      <Interruptor id={`notif-${clave}`} checked={prefs[clave]} disabled={obligatoria} onChange={(e) => cambiar(clave, e.target.checked)} aria-label={label} />
    </li>
  );

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-borde/60 border-t border-borde/60">{CATEGORIAS.map((c) => fila(c.clave, c.label, c.desc, c.obligatoria))}</ul>
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="etiqueta">Sonido</p>
          <span className="flex gap-1">
            <button type="button" onClick={() => { sonarEnSilencio(prefs.sonido_en_silencio); sonarEntrada(); }} className="enlace-mono">Entrada</button>
            <button type="button" onClick={() => { sonarEnSilencio(prefs.sonido_en_silencio); sonarClaqueta(); }} className="enlace-mono">Claqueta</button>
          </span>
        </div>
        <ul className="mt-1 divide-y divide-borde/60 border-t border-borde/60">{SONIDOS.map((x) => fila(x.clave, x.label, x.desc))}</ul>
      </div>
    </div>
  );
}
