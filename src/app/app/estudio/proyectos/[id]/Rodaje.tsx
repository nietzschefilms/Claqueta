"use client";

import { useMemo, useState, useTransition } from "react";
import { agregarPlano, archivarPersona, archivarPlano, editarPlano, guardarLocacion, guardarPersona } from "../../acciones";
import { escenasDe, paginas, type Linea } from "@/lib/claqueta/estudio";
import { idsReparto } from "@/lib/claqueta/produccion";
import type { Locacion, PersonaProyecto, Plano } from "@/lib/claqueta/datos-estudio";
import { colorTira } from "./Produccion";

const TAMANOS = [
  { v: "GPG", t: "Gran plano general" },
  { v: "PG", t: "Plano general" },
  { v: "PC", t: "Plano conjunto" },
  { v: "PA", t: "Plano americano" },
  { v: "PM", t: "Plano medio" },
  { v: "PMC", t: "Plano medio corto" },
  { v: "PP", t: "Primer plano" },
  { v: "PPP", t: "Primerísimo primer plano" },
  { v: "PD", t: "Plano detalle" },
  { v: "INSERT", t: "Insert" },
  { v: "OTRO", t: "Otro" }
];
const MOVIMIENTOS = ["Fijo", "Paneo", "Tilt", "Dolly", "Travelling", "Steadicam", "Gimbal", "Mano", "Dron", "Grúa"];
const hm = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""}`);

function useGuardar() {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      const r = await f();
      setError(r.ok ? null : r.error ?? "No se guardó.");
    });
  return { error, pendiente, correr };
}

// ─── Lista de planos ─────────────────────────────────────────────────────
export function ListaPlanos({ proyectoId, lineas, planos }: { proyectoId: string; lineas: Linea[]; planos: Plano[] }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const { error, pendiente, correr } = useGuardar();
  const [enSet, setEnSet] = useState(false);
  if (!escenas.length) return <p className="tarjeta text-sm text-muted">Escribe escenas en el guion para armar su lista de planos.</p>;
  const total = planos.reduce((a, p) => a + p.minutos, 0);
  const filmados = planos.filter((p) => p.filmado).length;

  return (
    <div className="space-y-4">
      <div className="tarjeta flex flex-wrap items-center gap-4">
        <div>
          <p className="etiqueta">Planos</p>
          <p className="cifra text-2xl font-semibold">{planos.length}</p>
        </div>
        <div>
          <p className="etiqueta">Tiempo estimado</p>
          <p className="cifra text-2xl font-semibold">{hm(total)}</p>
        </div>
        <div className="min-w-[10rem] flex-1">
          <p className="etiqueta">Filmados</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-tinta/[0.08]">
            <div className="h-full rounded-full bg-rojo transition-all" style={{ width: `${planos.length ? (filmados / planos.length) * 100 : 0}%` }} />
          </div>
          <p className="cifra mt-1 text-xs text-muted">{filmados} de {planos.length}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={enSet} onChange={(e) => setEnSet(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--c-rojo))]" />
          Modo set
        </label>
      </div>
      {error && <p className="alerta-error">{error}</p>}
      {escenas.map((e) => {
        const ps = planos.filter((p) => p.escena_id === e.id).sort((a, b) => a.orden - b.orden);
        const min = ps.reduce((a, p) => a + p.minutos, 0);
        return (
          <section key={e.id} className={`rounded-tarjeta border ${colorTira(e)}`}>
            <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
              <h3 className="font-mono text-sm font-bold uppercase">
                {e.numero}. {e.texto}
              </h3>
              <span className="cifra text-xs text-muted">
                {paginas(e.octavos)} pág. · {ps.length} planos · {hm(min)}
              </span>
            </header>
            <ul className="mt-2 divide-y divide-borde/50">
              {ps.map((p) => (
                <li key={p.id} className={`flex flex-wrap items-center gap-2 px-4 py-2 ${p.filmado ? "opacity-60" : ""}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={p.filmado}
                    aria-label={`Plano ${e.numero}${String.fromCharCode(64 + p.numero)} filmado`}
                    onClick={() => correr(() => editarPlano(proyectoId, p.id, { filmado: !p.filmado }))}
                    className={`grid shrink-0 place-items-center rounded-full border-2 transition ${enSet ? "h-9 w-9" : "h-6 w-6"} ${p.filmado ? "border-rojo bg-rojo text-white" : "border-tinta/30"}`}
                  >
                    {p.filmado && "✓"}
                  </button>
                  <span className="cifra w-10 shrink-0 font-semibold">{e.numero}{String.fromCharCode(64 + Math.min(p.numero, 26))}</span>
                  {enSet && (
                    <span className="flex items-center gap-1.5 rounded-full bg-fondo/70 px-2 py-1">
                      <span className="cifra text-xs">T{p.tomas}</span>
                      <button type="button" aria-label="Sumar una toma" onClick={() => correr(() => editarPlano(proyectoId, p.id, { tomas: p.tomas + 1 }))} className="grid h-8 w-8 place-items-center rounded-full bg-tinta text-lg font-semibold text-fondo active:scale-90">
                        +
                      </button>
                      <select
                        value={p.toma_buena ?? ""}
                        onChange={(ev) => correr(() => editarPlano(proyectoId, p.id, { toma_buena: ev.target.value ? Number(ev.target.value) : null }))}
                        aria-label="Toma buena"
                        className="rounded-full bg-transparent px-1 text-xs"
                      >
                        <option value="">Buena</option>
                        {Array.from({ length: Math.max(p.tomas, 1) }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            T{i + 1} ✓
                          </option>
                        ))}
                      </select>
                    </span>
                  )}
                  <select defaultValue={p.tamano ?? ""} onChange={(ev) => correr(() => editarPlano(proyectoId, p.id, { tamano: ev.target.value || null }))} aria-label="Tamaño" className="rounded-full bg-fondo/60 px-2 py-1 text-xs">
                    <option value="">Tamaño</option>
                    {TAMANOS.map((t) => (
                      <option key={t.v} value={t.v} title={t.t}>
                        {t.v}
                      </option>
                    ))}
                  </select>
                  <select defaultValue={p.movimiento ?? ""} onChange={(ev) => correr(() => editarPlano(proyectoId, p.id, { movimiento: ev.target.value }))} aria-label="Movimiento" className="rounded-full bg-fondo/60 px-2 py-1 text-xs">
                    <option value="">Movimiento</option>
                    {MOVIMIENTOS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <input defaultValue={p.lente ?? ""} maxLength={20} placeholder="Lente" onBlur={(ev) => ev.target.value !== (p.lente ?? "") && correr(() => editarPlano(proyectoId, p.id, { lente: ev.target.value }))} aria-label="Lente" className="w-16 rounded-full bg-fondo/60 px-2 py-1 text-xs" />
                  <input defaultValue={p.descripcion} maxLength={400} placeholder="Qué se ve" onBlur={(ev) => ev.target.value !== p.descripcion && correr(() => editarPlano(proyectoId, p.id, { descripcion: ev.target.value }))} aria-label="Descripción" className="min-w-[10rem] flex-1 rounded-full bg-fondo/60 px-3 py-1 text-sm" />
                  <input type="number" min={1} max={600} defaultValue={p.minutos} onBlur={(ev) => Number(ev.target.value) !== p.minutos && correr(() => editarPlano(proyectoId, p.id, { minutos: Number(ev.target.value) }))} aria-label="Minutos" className="cifra w-16 rounded-full bg-fondo/60 px-2 py-1 text-right text-xs" />
                  <span className="text-[10px] text-muted">min</span>
                  <button type="button" aria-label="Quitar plano" onClick={() => correr(() => archivarPlano(proyectoId, p.id))} className="text-muted hover:text-tinta">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <NuevoPlano disabled={pendiente} onAgregar={(c) => correr(() => agregarPlano(proyectoId, e.id, c))} />
          </section>
        );
      })}
    </div>
  );
}

function NuevoPlano({ onAgregar, disabled }: { onAgregar: (c: { tamano: string | null; descripcion: string; minutos: number; movimiento: string }) => void; disabled: boolean }) {
  const [tamano, setTamano] = useState("PM");
  const [descripcion, setDescripcion] = useState("");
  const [minutos, setMinutos] = useState(20);
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        onAgregar({ tamano, descripcion, minutos, movimiento: "" });
        setDescripcion("");
      }}
      className="flex flex-wrap gap-2 px-4 pb-3 pt-2"
    >
      <select value={tamano} onChange={(e) => setTamano(e.target.value)} aria-label="Tamaño del plano nuevo" className="campo w-auto rounded-full py-1.5 text-xs">
        {TAMANOS.map((t) => (
          <option key={t.v} value={t.v}>
            {t.v} · {t.t}
          </option>
        ))}
      </select>
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={400} placeholder="Nuevo plano: qué se ve" aria-label="Descripción del plano nuevo" className="campo min-w-[10rem] flex-1 rounded-full py-1.5 text-xs" />
      <input type="number" min={1} max={600} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} aria-label="Minutos estimados" className="campo cifra w-20 rounded-full py-1.5 text-right text-xs" />
      <button type="submit" disabled={disabled} className="rounded-full bg-tinta px-4 text-xs font-semibold text-fondo">
        + Plano
      </button>
    </form>
  );
}

// ─── Reparto, crew y locaciones ──────────────────────────────────────────
const PUESTOS = ["Director", "Productor", "Director de fotografía", "Asistente de cámara", "Gaffer", "Sonidista", "Director de arte", "Maquillaje", "Vestuario", "Asistente de producción", "Editor"];

export function Gente({ proyectoId, lineas, personas, locaciones }: { proyectoId: string; lineas: Linea[]; personas: PersonaProyecto[]; locaciones: Locacion[] }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const ids = useMemo(() => idsReparto(escenas), [escenas]);
  const { error, correr } = useGuardar();
  const reparto = personas.filter((p) => p.tipo === "reparto");
  const crew = personas.filter((p) => p.tipo === "crew");
  const lugares = [...new Set(escenas.map((e) => e.slug.lugar))];

  return (
    <div className="space-y-6">
      {error && <p className="alerta-error">{error}</p>}
      <section className="tarjeta p-0">
        <header className="px-5 pb-2 pt-5">
          <h3 className="titulo text-2xl">Reparto</h3>
          <p className="text-sm text-muted">Los personajes salen del guion con su ID (1 = el que más sale). Pon quién lo hace, su teléfono y su llamado.</p>
        </header>
        {ids.size === 0 && <p className="px-5 pb-5 text-sm text-muted">Aún no hay personajes con diálogo en el guion.</p>}
        <ul className="divide-y divide-borde/60">
          {[...ids.entries()].map(([personaje, id]) => {
            const actor = reparto.find((r) => r.rol === personaje);
            const enEscenas = escenas.filter((e) => e.personajes.includes(personaje)).map((e) => e.numero);
            return (
              <li key={personaje} className="grid gap-2 px-5 py-3 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.2fr)_9rem_6.5rem]">
                <span className="cifra grid h-8 w-8 place-items-center rounded-full bg-tinta text-sm font-semibold text-fondo">{id}</span>
                <div>
                  <p className="font-semibold">{personaje}</p>
                  <p className="cifra text-[11px] text-muted">Escenas {enEscenas.join(", ")}</p>
                </div>
                <input defaultValue={actor?.nombre ?? ""} maxLength={80} placeholder="¿Quién lo hace?" aria-label={`Actor de ${personaje}`} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== actor?.nombre) correr(() => guardarPersona(proyectoId, actor?.id ?? null, actor ? { nombre: v } : { tipo: "reparto", nombre: v, rol: personaje })); }} className="campo rounded-full py-2 text-sm" />
                <input defaultValue={actor?.telefono ?? ""} maxLength={40} placeholder="Teléfono" inputMode="tel" disabled={!actor} aria-label={`Teléfono de ${personaje}`} onBlur={(e) => actor && e.target.value !== (actor.telefono ?? "") && correr(() => guardarPersona(proyectoId, actor.id, { telefono: e.target.value }))} className="campo rounded-full py-2 text-sm disabled:opacity-40" />
                <input type="time" defaultValue={actor?.llamado?.slice(0, 5) ?? ""} disabled={!actor} aria-label={`Llamado de ${personaje}`} onBlur={(e) => actor && e.target.value !== (actor.llamado?.slice(0, 5) ?? "") && correr(() => guardarPersona(proyectoId, actor.id, { llamado: e.target.value || null }))} className="campo rounded-full py-2 font-mono text-sm disabled:opacity-40" />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="tarjeta p-0">
        <header className="px-5 pb-2 pt-5">
          <h3 className="titulo text-2xl">Crew</h3>
        </header>
        <ul className="divide-y divide-borde/60">
          {crew.map((c) => (
            <li key={c.id} className="grid items-center gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_6.5rem_2rem]">
              <div>
                <p className="font-semibold">{c.nombre}</p>
                <p className="text-xs text-muted">{c.rol}</p>
              </div>
              <input defaultValue={c.correo ?? ""} maxLength={120} placeholder="Correo" inputMode="email" aria-label={`Correo de ${c.nombre}`} onBlur={(e) => e.target.value !== (c.correo ?? "") && correr(() => guardarPersona(proyectoId, c.id, { correo: e.target.value }))} className="campo rounded-full py-2 text-sm" />
              <input defaultValue={c.telefono ?? ""} maxLength={40} placeholder="Teléfono" inputMode="tel" aria-label={`Teléfono de ${c.nombre}`} onBlur={(e) => e.target.value !== (c.telefono ?? "") && correr(() => guardarPersona(proyectoId, c.id, { telefono: e.target.value }))} className="campo rounded-full py-2 text-sm" />
              <input type="time" defaultValue={c.llamado?.slice(0, 5) ?? ""} aria-label={`Llamado de ${c.nombre}`} onBlur={(e) => e.target.value !== (c.llamado?.slice(0, 5) ?? "") && correr(() => guardarPersona(proyectoId, c.id, { llamado: e.target.value || null }))} className="campo rounded-full py-2 font-mono text-sm" />
              <button type="button" aria-label={`Quitar a ${c.nombre}`} onClick={() => correr(() => archivarPersona(proyectoId, c.id))} className="text-muted hover:text-tinta">
                ✕
              </button>
            </li>
          ))}
        </ul>
        <NuevoCrew onAgregar={(nombre, rol) => correr(() => guardarPersona(proyectoId, null, { tipo: "crew", nombre, rol }))} />
      </section>

      <section className="space-y-3">
        <h3 className="titulo text-2xl">Locaciones</h3>
        {lugares.length === 0 && <p className="tarjeta text-sm text-muted">Salen de los encabezados de escena (INT. CAFÉ - DÍA).</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {lugares.map((l) => {
            const loc = locaciones.find((x) => x.lugar === l);
            const g = (campo: keyof Locacion, valor: string) => valor !== ((loc?.[campo] as string | null) ?? "") && correr(() => guardarLocacion(proyectoId, l, { [campo]: valor }));
            return (
              <article key={l} className="tarjeta space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-mono text-sm font-bold uppercase">{l}</h4>
                  <select defaultValue={loc?.permiso ?? "pendiente"} onChange={(e) => g("permiso", e.target.value)} aria-label={`Permiso de ${l}`} className={`rounded-full px-2 py-1 text-xs font-semibold ${loc?.permiso === "aprobado" || loc?.permiso === "no_necesita" ? "bg-ok/15" : "bg-aviso/15"}`}>
                    <option value="pendiente">Permiso pendiente</option>
                    <option value="solicitado">Permiso solicitado</option>
                    <option value="aprobado">Permiso aprobado</option>
                    <option value="no_necesita">No necesita permiso</option>
                  </select>
                </div>
                <input defaultValue={loc?.direccion ?? ""} maxLength={200} placeholder="Dirección" aria-label={`Dirección de ${l}`} onBlur={(e) => g("direccion", e.target.value)} className="campo rounded-full py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input defaultValue={loc?.contacto ?? ""} maxLength={80} placeholder="Contacto" aria-label={`Contacto de ${l}`} onBlur={(e) => g("contacto", e.target.value)} className="campo rounded-full py-2 text-sm" />
                  <input defaultValue={loc?.telefono ?? ""} maxLength={40} placeholder="Teléfono" inputMode="tel" aria-label={`Teléfono de ${l}`} onBlur={(e) => g("telefono", e.target.value)} className="campo rounded-full py-2 text-sm" />
                </div>
                <input defaultValue={loc?.estacionamiento ?? ""} maxLength={200} placeholder="Estacionamiento y carga" aria-label={`Estacionamiento de ${l}`} onBlur={(e) => g("estacionamiento", e.target.value)} className="campo rounded-full py-2 text-sm" />
                <input defaultValue={loc?.hospital ?? ""} maxLength={200} placeholder="Hospital más cercano" aria-label={`Hospital cercano a ${l}`} onBlur={(e) => g("hospital", e.target.value)} className="campo rounded-full py-2 text-sm" />
                {loc?.direccion && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(loc.direccion)}`} target="_blank" rel="noopener noreferrer" className="enlace-mono inline-block">
                    Ver en mapa →
                  </a>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NuevoCrew({ onAgregar }: { onAgregar: (nombre: string, rol: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nombre.trim() || !rol.trim()) return;
        onAgregar(nombre, rol);
        setNombre("");
        setRol("");
      }}
      className="space-y-2 border-t border-borde/60 px-5 py-4"
    >
      <div className="flex flex-wrap gap-1.5">
        {PUESTOS.map((p) => (
          <button key={p} type="button" aria-pressed={rol === p} onClick={() => setRol(p)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${rol === p ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Nombre" aria-label="Nombre del crew" className="campo min-w-0 flex-1 rounded-full py-2 text-sm" />
        <input value={rol} onChange={(e) => setRol(e.target.value)} maxLength={80} placeholder="Puesto" aria-label="Puesto" className="campo min-w-0 flex-1 rounded-full py-2 text-sm" />
        <button type="submit" className="btn-primario">Agregar</button>
      </div>
    </form>
  );
}
