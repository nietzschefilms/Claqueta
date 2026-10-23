"use client";

import { useState, useTransition } from "react";
import { archivarPersona } from "../../acciones";
import { confirmarMiLlamado, guardarLlamado } from "./acciones-equipo";
import type { Confirmacion, PersonaProyecto } from "@/lib/claqueta/datos-estudio";

type Persona = { id: string; nombre: string };

const ESTADO: Record<Confirmacion, { t: string; clase: string }> = {
  falta: { t: "Falta quién", clase: "bg-rojo text-white" },
  pendiente: { t: "Sin confirmar", clase: "bg-aviso text-tinta" },
  confirmado: { t: "Confirmado", clase: "bg-ok text-white" },
  no_puede: { t: "No puede", clase: "bg-tinta text-fondo" }
};
const PUESTOS_CREW = ["Director", "Asistente de dirección", "Director de fotografía", "Asistente de cámara", "Gaffer", "Sonidista", "Arte", "Vestuario", "Maquillaje", "Script", "Asistente de producción", "Foto fija"];
const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// Mensaje listo para WhatsApp (para quien no tiene cuenta en Claqueta).
function ligaWhatsApp(p: PersonaProyecto, proyecto: string) {
  const tel = (p.telefono ?? "").replace(/\D/g, "");
  if (tel.length < 10) return null;
  const numero = tel.length === 10 ? `52${tel}` : tel;
  const cuando = p.fecha ? `el ${fechaCorta(p.fecha)}` : "(fecha por confirmar)";
  const hora = p.llamado ? ` a las ${p.llamado.slice(0, 5)}` : "";
  const texto = `Hola ${p.nombre.split(" ")[0]}, te escribo de Nietzsche Studios. Llamado para ${proyecto}${p.tipo === "reparto" ? ` (${p.rol})` : ` como ${p.rol}`}: ${cuando}${hora}. ¿Me confirmas que puedes?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function Llamados({ proyectoId, nombre, yo, personas, equipo, diasRodaje, puedeEditar }: { proyectoId: string; nombre: string; yo: string; personas: PersonaProyecto[]; equipo: Persona[]; diasRodaje: string[]; puedeEditar: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await f();
      if (!r.ok) setError(r.error ?? "No se pudo.");
    });

  const crew = personas.filter((p) => p.tipo === "crew");
  const reparto = personas.filter((p) => p.tipo === "reparto");
  const confirmados = personas.filter((p) => p.confirmacion === "confirmado").length;
  const faltanActores = reparto.filter((p) => p.confirmacion === "falta");

  const Fila = ({ p }: { p: PersonaProyecto }) => {
    const wa = ligaWhatsApp(p, nombre);
    const ligado = equipo.find((e) => e.id === p.user_id);
    return (
      <li className="space-y-2 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">
              {p.nombre}
              {ligado && <span className="ml-2 rounded-full bg-tinta/[0.06] px-2 py-0.5 text-[10px] font-semibold">Equipo</span>}
            </p>
            <p className="text-xs text-muted">{p.rol}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ESTADO[p.confirmacion].clase}`}>{ESTADO[p.confirmacion].t}</span>
        </div>
        {puedeEditar ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="date"
              list={`dias-${proyectoId}`}
              defaultValue={p.fecha ?? ""}
              aria-label={`Día de llamado de ${p.nombre}`}
              onBlur={(e) => e.target.value !== (p.fecha ?? "") && correr(() => guardarLlamado(proyectoId, p.id, { fecha: e.target.value || null }))}
              className="campo w-auto rounded-full py-1.5 font-mono text-xs"
            />
            <input type="time" defaultValue={p.llamado?.slice(0, 5) ?? ""} aria-label={`Hora de llamado de ${p.nombre}`} onBlur={(e) => e.target.value !== (p.llamado?.slice(0, 5) ?? "") && correr(() => guardarLlamado(proyectoId, p.id, { llamado: e.target.value || null }))} className="campo w-auto rounded-full py-1.5 font-mono text-xs" />
            <input defaultValue={p.telefono ?? ""} inputMode="tel" maxLength={40} placeholder="WhatsApp" aria-label={`Teléfono de ${p.nombre}`} onBlur={(e) => e.target.value !== (p.telefono ?? "") && correr(() => guardarLlamado(proyectoId, p.id, { telefono: e.target.value }))} className="campo w-32 rounded-full py-1.5 text-xs" />
            <select value={p.user_id ?? ""} aria-label={`Cuenta de ${p.nombre}`} onChange={(e) => correr(() => guardarLlamado(proyectoId, p.id, { user_id: e.target.value || null }))} className="campo w-auto rounded-full py-1.5 text-xs">
              <option value="">Sin cuenta en Claqueta</option>
              {equipo.map((e) => (
                <option key={e.id} value={e.id}>Es {e.id === yo ? "yo" : e.nombre}</option>
              ))}
            </select>
            <select value={p.confirmacion} aria-label={`Confirmación de ${p.nombre}`} onChange={(e) => correr(() => guardarLlamado(proyectoId, p.id, { confirmacion: e.target.value }))} className="campo w-auto rounded-full py-1.5 text-xs">
              {(Object.keys(ESTADO) as Confirmacion[]).map((k) => (
                <option key={k} value={k}>{ESTADO[k].t}</option>
              ))}
            </select>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secundario px-3 py-1.5 text-xs">
                Mandar por WhatsApp
              </a>
            )}
            <button type="button" aria-label={`Quitar a ${p.nombre}`} onClick={() => correr(() => archivarPersona(proyectoId, p.id))} className="ml-auto text-muted hover:text-tinta">✕</button>
          </div>
        ) : (
          <p className="cifra text-xs text-muted">
            {p.fecha ? fechaCorta(p.fecha) : "Día por definir"} · {p.llamado?.slice(0, 5) ?? "hora por definir"}
          </p>
        )}
        {p.user_id === yo && p.confirmacion !== "confirmado" && (
          <div className="flex gap-2">
            <button type="button" disabled={pendiente} onClick={() => correr(() => confirmarMiLlamado(proyectoId, p.id, "confirmado"))} className="btn-rojo px-4 py-1.5">Confirmo</button>
            <button type="button" disabled={pendiente} onClick={() => correr(() => confirmarMiLlamado(proyectoId, p.id, "no_puede"))} className="btn-secundario px-4 py-1.5">No puedo</button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <section className="tarjeta flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta">Llamados</p>
          <p className="titulo text-4xl">
            <span className="cifra">{confirmados}</span> de <span className="cifra">{personas.length}</span> confirmados
          </p>
        </div>
        {faltanActores.length > 0 && <p className="text-sm font-semibold text-rojo">Casting abierto: {faltanActores.map((a) => a.rol).join(", ")}</p>}
      </section>
      {error && <p className="alerta-error" role="alert">{error}</p>}
      {/* Los días de rodaje salen como sugerencia en el calendario. */}
      <datalist id={`dias-${proyectoId}`}>
        {diasRodaje.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <section className="tarjeta p-0">
        <header className="px-5 pb-2 pt-5">
          <h3 className="titulo text-2xl">Crew call</h3>
          <p className="text-sm text-muted">Si la persona tiene cuenta, ligala: le llega el aviso y confirma desde su app. Si no, mándale el llamado por WhatsApp.</p>
        </header>
        <ul className="divide-y divide-borde/60">
          {crew.map((p) => <Fila key={p.id} p={p} />)}
          {crew.length === 0 && <li className="px-5 pb-4 text-sm text-muted">Aún no hay crew en este proyecto.</li>}
        </ul>
        {puedeEditar && <NuevoLlamado tipo="crew" equipo={equipo} yo={yo} onAgregar={(c) => correr(() => guardarLlamado(proyectoId, null, c))} />}
      </section>

      <section className="tarjeta p-0">
        <header className="px-5 pb-2 pt-5">
          <h3 className="titulo text-2xl">Casting y reparto</h3>
          <p className="text-sm text-muted">Abre un personaje aunque no tengas a nadie (queda como Falta quién) y cuando lo consigas, pon su nombre.</p>
        </header>
        <ul className="divide-y divide-borde/60">
          {reparto.map((p) => <Fila key={p.id} p={p} />)}
          {reparto.length === 0 && <li className="px-5 pb-4 text-sm text-muted">Aún no hay personajes con actor.</li>}
        </ul>
        {puedeEditar && <NuevoLlamado tipo="reparto" equipo={equipo} yo={yo} onAgregar={(c) => correr(() => guardarLlamado(proyectoId, null, c))} />}
      </section>
      {!puedeEditar && <p className="text-xs text-muted">Los llamados los arma dirección y producción. Si te ligaron a uno, confírmalo aquí.</p>}
    </div>
  );
}

function NuevoLlamado({ tipo, equipo, yo, onAgregar }: { tipo: "crew" | "reparto"; equipo: Persona[]; yo: string; onAgregar: (c: { tipo: "crew" | "reparto"; nombre: string; rol: string; user_id?: string | null; confirmacion?: string }) => void }) {
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("");
  const [cuenta, setCuenta] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const quien = cuenta ? equipo.find((x) => x.id === cuenta)?.nombre ?? nombre : nombre;
        if (!rol.trim()) return;
        if (tipo === "crew" && !quien.trim()) return;
        onAgregar({ tipo, nombre: quien.trim() || "Por definir", rol, user_id: cuenta || null, confirmacion: tipo === "reparto" && !quien.trim() ? "falta" : "pendiente" });
        setNombre("");
        setRol("");
        setCuenta("");
      }}
      className="space-y-2 border-t border-borde/60 px-5 py-4"
    >
      {tipo === "crew" && (
        <div className="flex flex-wrap gap-1.5">
          {PUESTOS_CREW.map((p) => (
            <button key={p} type="button" aria-pressed={rol === p} onClick={() => setRol(p)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${rol === p ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"}`}>
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input value={rol} onChange={(e) => setRol(e.target.value)} maxLength={80} placeholder={tipo === "crew" ? "Puesto" : "Personaje, ej. MARÍA"} aria-label={tipo === "crew" ? "Puesto" : "Personaje"} className="campo rounded-full py-2 text-sm" />
        {tipo === "crew" && (
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} aria-label="Del equipo" className="campo rounded-full py-2 text-sm">
            <option value="">Alguien de fuera</option>
            {equipo.map((x) => (
              <option key={x.id} value={x.id}>{x.id === yo ? "Yo" : x.nombre}</option>
            ))}
          </select>
        )}
        {!cuenta && <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder={tipo === "crew" ? "Nombre" : "Actor/actriz (vacío = falta)"} aria-label="Nombre" className="campo rounded-full py-2 text-sm" />}
        <button type="submit" className="btn-primario">{tipo === "crew" ? "Agregar al crew" : "Abrir personaje"}</button>
      </div>
    </form>
  );
}
