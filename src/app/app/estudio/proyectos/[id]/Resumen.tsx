"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { agregarAvance, agregarDocumento, archivarAvance, archivarDocumento, asignarPuesto, cargarAvanceBase, confirmarMiLlamado, editarAvance, quitarPuesto, registrarArchivo } from "./acciones-equipo";
import { createClient } from "@/lib/supabase/client";
import { PUESTOS, nombrePuesto, type Permisos } from "@/lib/claqueta/puestos";
import type { Avance, Documento, Evento, MiembroProyecto, PersonaProyecto } from "@/lib/claqueta/datos-estudio";

type Persona = { id: string; nombre: string };

const ESTADOS = [
  { v: "falta", t: "Falta", clase: "bg-rojo text-white" },
  { v: "en_proceso", t: "En proceso", clase: "bg-aviso text-tinta" },
  { v: "listo", t: "Listo", clase: "bg-ok text-white" }
] as const;

const fechaCorta = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function useAccion() {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await f();
      if (!r.ok) setError(r.error ?? "No se pudo.");
    });
  return { error, pendiente, correr };
}

export function Resumen({
  proyectoId,
  yo,
  personas,
  miembros,
  avance,
  documentos,
  eventos,
  llamados,
  permisos,
  hoy,
  herramientas = []
}: {
  proyectoId: string;
  yo: string;
  personas: Persona[];
  miembros: MiembroProyecto[];
  avance: Avance[];
  documentos: Documento[];
  eventos: Evento[];
  llamados: PersonaProyecto[];
  permisos: Permisos;
  hoy: string;
  herramientas?: { href: string; t: string; d: string; editas: boolean }[];
}) {
  const { error, pendiente, correr } = useAccion();
  const nombre = (id: string | null) => (id ? personas.find((p) => p.id === id)?.nombre.split(" ")[0] ?? "Alguien" : null);
  const listos = avance.filter((a) => a.estado === "listo").length;
  const pct = avance.length ? Math.round((listos / avance.length) * 100) : 0;
  const faltan = avance.filter((a) => a.estado === "falta");
  const misLlamados = llamados.filter((l) => l.user_id === yo && l.fecha && l.fecha >= hoy);

  return (
    <div className="space-y-6">
      {error && <p className="alerta-error" role="alert">{error}</p>}

      {misLlamados.map((l) => (
        <section key={l.id} className="tarjeta relative space-y-3 overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1 bg-rojo" aria-hidden="true" />
          <p className="etiqueta">Tu llamado · {l.rol}</p>
          <p className="titulo text-3xl capitalize">
            {fechaCorta(l.fecha!)} <span className="cifra">{l.llamado?.slice(0, 5) ?? "hora por definir"}</span>
          </p>
          {l.confirmacion === "confirmado" ? (
            <p className="text-sm font-semibold text-ok">Ya confirmaste. Gracias.</p>
          ) : l.confirmacion === "no_puede" ? (
            <p className="text-sm font-semibold text-rojo">Dijiste que no puedes. Producción ya sabe.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendiente} onClick={() => correr(() => confirmarMiLlamado(proyectoId, l.id, "confirmado"))} className="btn-rojo">
              Confirmo, ahí estaré
            </button>
            <button type="button" disabled={pendiente} onClick={() => correr(() => confirmarMiLlamado(proyectoId, l.id, "no_puede"))} className="btn-secundario">
              No puedo
            </button>
          </div>
        </section>
      ))}

      {/* Herramientas del proyecto, a un toque */}
      {herramientas.length > 0 && (
        <nav aria-label="Herramientas del proyecto">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {herramientas.map((h) => (
              <li key={h.href}>
                <Link
                  href={h.href}
                  className="tarjeta group flex h-full flex-col gap-1 p-4 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="titulo text-xl leading-tight">{h.t}</span>
                    <span aria-hidden="true" className="text-muted transition group-hover:translate-x-0.5 group-hover:text-tinta">→</span>
                  </span>
                  <span className="text-xs text-muted">{h.d}</span>
                  <span className={`mt-auto pt-1 text-[10px] font-semibold uppercase tracking-wider ${h.editas ? "text-rojo" : "text-muted"}`}>{h.editas ? "Tú editas" : "Solo ves"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Avance general */}
      <section className="tarjeta space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="etiqueta">Cómo vamos</p>
            <p className="titulo text-5xl">
              <span className="cifra">{pct}%</span> listo
            </p>
          </div>
          <p className="cifra text-sm text-muted">
            {listos} de {avance.length} cosas listas
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-tinta/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del proyecto">
          <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pct}%` }} />
        </div>
        {faltan.length > 0 && (
          <p className="text-sm">
            <span className="font-semibold text-rojo">Falta:</span> {faltan.map((a) => a.titulo).join(" · ")}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Lista de avance */}
        <section className="tarjeta p-0">
          <header className="px-5 pb-2 pt-5">
            <h3 className="titulo text-2xl">Lo que falta y lo que está listo</h3>
            <p className="text-sm text-muted">Toca el círculo para avanzar: Falta → En proceso → Listo. Al tomarlo quedas de responsable.</p>
          </header>
          {avance.length === 0 && (
            <div className="px-5 pb-5">
              <button type="button" disabled={pendiente} onClick={() => correr(() => cargarAvanceBase(proyectoId))} className="btn-secundario">
                Cargar la lista básica de producción
              </button>
            </div>
          )}
          <ul className="divide-y divide-borde/60">
            {avance.map((a) => {
              const sig = a.estado === "falta" ? "en_proceso" : a.estado === "en_proceso" ? "listo" : "falta";
              const vencido = a.fecha_limite && a.fecha_limite < hoy && a.estado !== "listo";
              return (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => correr(() => editarAvance(proyectoId, a.id, { estado: sig, ...(sig === "en_proceso" && !a.responsable ? { responsable: yo } : {}) }))}
                    aria-label={`${a.titulo}: ${ESTADOS.find((e) => e.v === a.estado)?.t}. Toca para pasar a ${ESTADOS.find((e) => e.v === sig)?.t}.`}
                    title="Toca para avanzar: Falta → En proceso → Listo"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo ${
                      a.estado === "listo" ? "border-ok bg-ok text-white" : a.estado === "en_proceso" ? "border-aviso" : "border-rojo"
                    }`}
                  >
                    {a.estado === "listo" && <span className="text-sm leading-none">✓</span>}
                    {a.estado === "en_proceso" && <span className="h-3.5 w-3.5 rounded-full bg-aviso" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold leading-tight ${a.estado === "listo" ? "text-muted line-through decoration-ok/60" : ""}`}>{a.titulo}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <select
                        value={a.responsable ?? ""}
                        disabled={pendiente}
                        onChange={(e) => correr(() => editarAvance(proyectoId, a.id, { responsable: e.target.value || null }))}
                        aria-label={`Quién trabaja en ${a.titulo}`}
                        className={`max-w-[11rem] cursor-pointer truncate rounded-full bg-transparent py-0.5 pr-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${a.responsable ? "text-tinta" : "text-muted"}`}
                      >
                        <option value="">Nadie lo ha tomado</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.id === yo ? "Yo" : p.nombre}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted" aria-hidden="true">·</span>
                      <input
                        type="date"
                        defaultValue={a.fecha_limite ?? ""}
                        aria-label={`Fecha límite de ${a.titulo}`}
                        onBlur={(e) => e.target.value !== (a.fecha_limite ?? "") && correr(() => editarAvance(proyectoId, a.id, { fecha_limite: e.target.value || null }))}
                        className={`w-[7.5rem] rounded-full bg-transparent py-0.5 font-mono focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${vencido ? "font-semibold text-rojo" : a.fecha_limite ? "text-tinta" : "text-muted"}`}
                      />
                      {vencido && <span className="font-semibold text-rojo">Vencido</span>}
                    </div>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline ${ESTADOS.find((e) => e.v === a.estado)?.clase}`}>{ESTADOS.find((e) => e.v === a.estado)?.t}</span>
                  <button type="button" aria-label={`Quitar ${a.titulo}`} onClick={() => correr(() => archivarAvance(proyectoId, a.id))} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-tinta/[0.06] hover:text-tinta">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <NuevoAvance onAgregar={(t) => correr(() => agregarAvance(proyectoId, t))} />
        </section>

        <div className="space-y-6">
          <EquipoProyecto proyectoId={proyectoId} yo={yo} personas={personas} miembros={miembros} puedeRepartir={permisos.productor} correr={correr} pendiente={pendiente} />
          <LineaTiempo avance={avance} eventos={eventos} hoy={hoy} nombre={nombre} />
          <Documentos proyectoId={proyectoId} yo={yo} documentos={documentos} direccion={permisos.direccion} correr={correr} pendiente={pendiente} />
        </div>
      </div>
    </div>
  );
}

function NuevoAvance({ onAgregar }: { onAgregar: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!t.trim()) return;
        onAgregar(t);
        setT("");
      }}
      className="flex gap-2 border-t border-borde/60 px-5 py-4"
    >
      <input value={t} onChange={(e) => setT(e.target.value)} maxLength={100} placeholder="Agregar algo que falta, ej. Rentar dron" aria-label="Algo que falta" className="campo rounded-full py-2 text-sm" />
      <button type="submit" className="btn-secundario shrink-0">Agregar</button>
    </form>
  );
}

type Correr = (f: () => Promise<{ ok: boolean; error?: string }>) => void;

function EquipoProyecto({ proyectoId, yo, personas, miembros, puedeRepartir, correr, pendiente }: { proyectoId: string; yo: string; personas: Persona[]; miembros: MiembroProyecto[]; puedeRepartir: boolean; correr: Correr; pendiente: boolean }) {
  const [quien, setQuien] = useState("");
  const [puesto, setPuesto] = useState("director");
  const conPuesto = personas.filter((p) => miembros.some((m) => m.user_id === p.id));
  const sinPuesto = personas.filter((p) => !miembros.some((m) => m.user_id === p.id));
  return (
    <section className="tarjeta space-y-3">
      <h3 className="titulo text-2xl">Equipo del proyecto</h3>
      {conPuesto.length === 0 && <p className="text-sm text-muted">Nadie tiene puesto todavía.</p>}
      <ul className="space-y-2">
        {conPuesto.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tinta text-xs font-bold text-fondo" aria-hidden="true">
              {p.nombre.slice(0, 1).toUpperCase()}
            </span>
            <span className="font-semibold">{p.id === yo ? "Tú" : p.nombre}</span>
            {miembros
              .filter((m) => m.user_id === p.id)
              .map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-tinta/[0.06] px-2.5 py-1 text-xs font-semibold">
                  {nombrePuesto(m.puesto)}
                  {puedeRepartir && (
                    <button type="button" aria-label={`Quitar puesto ${nombrePuesto(m.puesto)} a ${p.nombre}`} disabled={pendiente} onClick={() => correr(() => quitarPuesto(proyectoId, m.id))} className="text-muted hover:text-tinta">
                      ✕
                    </button>
                  )}
                </span>
              ))}
          </li>
        ))}
      </ul>
      {sinPuesto.length > 0 && <p className="text-xs text-muted">Del equipo sin puesto aquí: {sinPuesto.map((p) => (p.id === yo ? "tú" : p.nombre.split(" ")[0])).join(", ")}. Igual ven el proyecto.</p>}
      {puedeRepartir ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!quien) return;
            correr(() => asignarPuesto(proyectoId, quien, puesto));
          }}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <select value={quien} onChange={(e) => setQuien(e.target.value)} aria-label="Persona" className="campo rounded-full py-2 text-sm">
            <option value="">¿Quién?</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === yo ? "Yo" : p.nombre}
              </option>
            ))}
          </select>
          <select value={puesto} onChange={(e) => setPuesto(e.target.value)} aria-label="Puesto" className="campo rounded-full py-2 text-sm">
            {PUESTOS.map((x) => (
              <option key={x.v} value={x.v}>
                {x.t}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pendiente || !quien} className="btn-primario">Dar puesto</button>
        </form>
      ) : (
        <p className="text-xs text-muted">Los puestos los reparte el productor.</p>
      )}
      <p className="text-[11px] text-muted">Productor, director y asistente de dirección ven y editan el guion completo. Fotografía edita planos. El presupuesto solo lo ve el productor.</p>
    </section>
  );
}

function LineaTiempo({ avance, eventos, hoy, nombre }: { avance: Avance[]; eventos: Evento[]; hoy: string; nombre: (id: string | null) => string | null }) {
  const hitos = [
    ...avance.filter((a) => a.fecha_limite).map((a) => ({ id: a.id, fecha: a.fecha_limite!, titulo: a.titulo, detalle: a.responsable ? nombre(a.responsable) : null, listo: a.estado === "listo", tipo: "avance" })),
    ...eventos.map((e) => ({ id: e.id, fecha: e.fecha, titulo: e.titulo, detalle: `${e.inicio.slice(0, 5)}${e.lugar ? ` · ${e.lugar}` : ""}`, listo: e.fecha < hoy, tipo: e.tipo }))
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return (
    <section className="tarjeta space-y-3">
      <h3 className="titulo text-2xl">Línea del tiempo</h3>
      {hitos.length === 0 ? (
        <p className="text-sm text-muted">Ponle fecha a lo que falta (o agenda juntas y rodajes en Estudio) y aquí sale en orden.</p>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-borde pl-4">
          {hitos.map((h, i) => {
            const marcaHoy = h.fecha >= hoy && (i === 0 || hitos[i - 1].fecha < hoy);
            return (
              <li key={`${h.tipo}-${h.id}`} className="relative">
                {marcaHoy && <p className="etiqueta -ml-4 mb-2 flex items-center gap-2 text-rojo"><span className="h-2 w-2 rounded-full bg-rojo" aria-hidden="true" /> Hoy</p>}
                <span className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ${h.listo ? "bg-ok" : h.fecha < hoy ? "bg-rojo" : "bg-tinta"}`} aria-hidden="true" />
                <p className="cifra text-[11px] uppercase text-muted">{fechaCorta(h.fecha)}{h.tipo !== "avance" ? ` · ${h.tipo}` : ""}</p>
                <p className={`text-sm font-semibold ${h.listo ? "text-muted" : ""}`}>{h.titulo}</p>
                {h.detalle && <p className="text-xs text-muted">{h.detalle}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Documentos({ proyectoId, yo, documentos, direccion, correr, pendiente }: { proyectoId: string; yo: string; documentos: Documento[]; direccion: boolean; correr: Correr; pendiente: boolean }) {
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [privado, setPrivado] = useState(false);
  return (
    <section className="tarjeta space-y-3">
      <h3 className="titulo text-2xl">Documentos</h3>
      {documentos.length === 0 && <p className="text-sm text-muted">Pega links de Drive, PDFs, moodboards, referencias o contratos.</p>}
      <ul className="space-y-1.5">
        {documentos.map((d) => (
          <li key={d.id} className="flex items-center gap-2">
            {d.ruta && <span className="rounded bg-tinta/[0.08] px-1.5 py-0.5 font-mono text-[10px] uppercase">{d.tipo_archivo?.includes("pdf") ? "PDF" : "Archivo"}</span>}
            <a href={d.url ?? "#"} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold underline decoration-tinta/30 underline-offset-2">
              {d.titulo}
            </a>
            {d.solo_direccion && <span className="rounded-full bg-tinta/[0.06] px-2 py-0.5 text-[10px] font-semibold">Dirección</span>}
            {(d.creado_por === yo || direccion) && (
              <button type="button" aria-label={`Quitar ${d.titulo}`} disabled={pendiente} onClick={() => correr(() => archivarDocumento(proyectoId, d.id))} className="text-muted hover:text-tinta">
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <SubirArchivo proyectoId={proyectoId} privado={privado} correr={correr} pendiente={pendiente} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          correr(async () => {
            const r = await agregarDocumento(proyectoId, titulo, url, privado);
            if (r.ok) {
              setTitulo("");
              setUrl("");
            }
            return r;
          });
        }}
        className="space-y-2"
      >
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} placeholder="Nombre, ej. Moodboard" aria-label="Nombre del documento" className="campo rounded-full py-2 text-sm" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={600} inputMode="url" placeholder="https://drive.google.com/..." aria-label="Link del documento" className="campo rounded-full py-2 text-sm" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {direccion ? (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
              Solo para dirección
            </label>
          ) : (
            <span />
          )}
          <button type="submit" disabled={pendiente || !titulo || !url} className="btn-secundario">Agregar link</button>
        </div>
      </form>
    </section>
  );
}

// Sube un archivo (PDF del guion, contratos, referencias) al bucket privado.
function SubirArchivo({ proyectoId, privado, correr, pendiente }: { proyectoId: string; privado: boolean; correr: Correr; pendiente: boolean }) {
  const [subiendo, setSubiendo] = useState(false);
  return (
    <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-borde px-4 py-3 text-sm font-semibold text-muted transition hover:border-tinta/40 hover:text-tinta ${subiendo || pendiente ? "opacity-60" : ""}`}>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,.docx"
        className="sr-only"
        disabled={subiendo || pendiente}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 25 * 1024 * 1024) return correr(async () => ({ ok: false, error: "El archivo pesa más de 25 MB." }));
          setSubiendo(true);
          const limpio = f.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-100) || "archivo";
          const ruta = `${proyectoId}/${Date.now()}-${limpio}`;
          const { error } = await createClient().storage.from("proyecto-docs").upload(ruta, f, { contentType: f.type || "application/octet-stream", upsert: false });
          setSubiendo(false);
          if (error) return correr(async () => ({ ok: false, error: "No se subió. Revisa que sea PDF, imagen, texto o Word de menos de 25 MB." }));
          correr(() => registrarArchivo(proyectoId, f.name.replace(/\.[^.]+$/, "").slice(0, 100), ruta, f.type, privado));
        }}
      />
      {subiendo ? "Subiendo…" : "Subir archivo (PDF, imagen, Word)"}
    </label>
  );
}
