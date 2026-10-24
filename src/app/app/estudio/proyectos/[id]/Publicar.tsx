"use client";

import { useState, useTransition } from "react";
import { publicar } from "./acciones-publicar";
import type { Publicacion } from "@/lib/claqueta/datos-estudio";

type Tipo = "guion" | "shotlist" | "llamados";
const NOMBRE: Record<Tipo, string> = { guion: "el guion", shotlist: "el shotlist", llamados: "los llamados" };

// Nombres por id (las funciones no pueden pasar de servidor a cliente).
const quien = (nombres: Record<string, string>, id: string | null) => (id ? nombres[id] ?? "dirección" : "dirección");

const hace = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
};

// Barra de dirección: qué ve el equipo hoy y el botón para publicar lo nuevo.
export function BarraPublicar({ proyectoId, tipo, ultima, nombres }: { proyectoId: string; tipo: Tipo; ultima: Publicacion | null; nombres: Record<string, string> }) {
  const [abierta, setAbierta] = useState(false);
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <section className="tarjeta relative space-y-3 overflow-hidden print:hidden" aria-label={`Publicar ${NOMBRE[tipo]}`}>
      <span className="absolute inset-y-0 left-0 w-1 bg-rojo" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="etiqueta">Borrador de dirección</p>
          <p className="text-sm">
            {ultima ? (
              <>
                El equipo ve la <b>versión {ultima.version}</b>, publicada {hace(ultima.creado_en)} por {quien(nombres, ultima.publicado_por)}.
                {ultima.nota && <span className="text-muted"> “{ultima.nota}”</span>}
              </>
            ) : (
              <span className="text-muted">Aún no publicas {NOMBRE[tipo]}: el equipo no lo ve. Cuando esté listo, publícalo.</span>
            )}
          </p>
        </div>
        {!abierta && (
          <button type="button" onClick={() => { setAbierta(true); setMsg(null); }} className="btn-rojo shrink-0">
            Publicar al equipo
          </button>
        )}
      </div>
      {abierta && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await publicar(proyectoId, tipo, nota);
              setMsg({ ok: r.ok, t: r.ok ? r.mensaje ?? "Publicado." : r.error ?? "No se pudo." });
              if (r.ok) {
                setAbierta(false);
                setNota("");
              }
            });
          }}
          className="flex flex-wrap gap-2"
        >
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} placeholder="¿Qué cambió? (opcional), ej. nueva escena 4" aria-label="Qué cambió" className="campo min-w-0 flex-1 rounded-full py-2 text-sm" autoFocus />
          <button type="submit" disabled={pendiente} className="btn-rojo">{pendiente ? "Publicando…" : `Publicar v${(ultima?.version ?? 0) + 1}`}</button>
          <button type="button" onClick={() => setAbierta(false)} className="btn-secundario">Cancelar</button>
        </form>
      )}
      {msg && <p className={msg.ok ? "alerta-ok" : "alerta-error"} role={msg.ok ? "status" : "alert"}>{msg.t}</p>}
    </section>
  );
}

// Encabezado de lo publicado (para quien no edita).
export function SelloPublicado({ ultima, nombres, que }: { ultima: Publicacion; nombres: Record<string, string>; que: string }) {
  return (
    <p className="etiqueta flex flex-wrap items-center gap-2 print:hidden">
      <span className="rounded-full bg-ok/15 px-2.5 py-1 text-ok">{que} · versión {ultima.version}</span>
      <span className="normal-case tracking-normal text-muted">
        Publicado {hace(ultima.creado_en)} por {quien(nombres, ultima.publicado_por)}
        {ultima.nota ? ` · “${ultima.nota}”` : ""}
      </span>
    </p>
  );
}

type LineaPub = { tipo: string; texto: string };

// Guion publicado, con formato de guion (solo lectura).
export function GuionPublicado({ ultima, nombres }: { ultima: Publicacion | null; nombres: Record<string, string> }) {
  if (!ultima) return <p className="tarjeta text-sm text-muted">Dirección todavía no publica el guion. Cuando lo haga te llega un aviso.</p>;
  const lineas = ((ultima.contenido as { lineas?: LineaPub[] }).lineas ?? []) as LineaPub[];
  let escena = 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SelloPublicado ultima={ultima} nombres={nombres} que="Guion" />
        <button type="button" onClick={() => window.print()} className="btn-secundario print:hidden">Imprimir / PDF</button>
      </div>
      <article className="imprimible mx-auto max-w-[44rem] rounded-tarjeta bg-[#fbfaf7] px-6 py-10 font-mono text-[13px] leading-[1.55] text-[#111] shadow-suave md:px-16">
        {lineas.map((l, i) => {
          if (l.tipo === "escena") escena += 1;
          const base = "whitespace-pre-wrap break-words";
          switch (l.tipo) {
            case "escena":
              return (
                <p key={i} className={`${base} mt-6 flex gap-3 font-bold uppercase`}>
                  <span className="w-6 shrink-0 text-right text-[#777]">{escena}</span>
                  {l.texto}
                </p>
              );
            case "personaje":
              return <p key={i} className={`${base} ml-[38%] mt-4 uppercase`}>{l.texto}</p>;
            case "parentesis":
              return <p key={i} className={`${base} ml-[30%] mr-[25%] italic`}>{l.texto}</p>;
            case "dialogo":
              return <p key={i} className={`${base} ml-[22%] mr-[18%]`}>{l.texto}</p>;
            case "transicion":
              return <p key={i} className={`${base} mt-4 text-right uppercase`}>{l.texto}</p>;
            case "nota":
              return <p key={i} className={`${base} mt-3 rounded bg-yellow-100 px-2 py-1 text-[#665]`}>{l.texto}</p>;
            default:
              return <p key={i} className={`${base} mt-3`}>{l.texto}</p>;
          }
        })}
      </article>
    </div>
  );
}

type PlanoPub = { numero: number; tamano: string | null; angulo: string | null; movimiento: string | null; lente: string | null; descripcion: string; minutos: number };

// Shotlist publicado (solo lectura).
export function ShotlistPublicado({ ultima, nombres }: { ultima: Publicacion | null; nombres: Record<string, string> }) {
  if (!ultima) return <p className="tarjeta text-sm text-muted">Dirección todavía no publica el shotlist. Cuando lo haga te llega un aviso.</p>;
  const escenas = ((ultima.contenido as { escenas?: { numero: number; encabezado: string; planos: PlanoPub[] }[] }).escenas ?? []);
  const total = escenas.reduce((a, e) => a + e.planos.reduce((b, p) => b + p.minutos, 0), 0);
  const nPlanos = escenas.reduce((a, e) => a + e.planos.length, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SelloPublicado ultima={ultima} nombres={nombres} que="Shotlist" />
        <span className="cifra text-sm text-muted">
          {nPlanos} planos · ≈ {Math.floor(total / 60)} h {total % 60} min
        </span>
      </div>
      {escenas.map((e) => (
        <section key={e.numero} className="tarjeta p-0">
          <h3 className="px-5 pb-2 pt-4 font-mono text-sm font-bold uppercase">
            {e.numero}. {e.encabezado}
          </h3>
          <ul className="divide-y divide-borde/60">
            {e.planos.map((p) => (
              <li key={p.numero} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 px-5 py-3">
                <span className="cifra font-semibold">{e.numero}{String.fromCharCode(64 + Math.min(p.numero, 26))}</span>
                <span className="min-w-0">
                  <span className="block text-sm">{p.descripcion || "Sin descripción"}</span>
                  <span className="block text-xs text-muted">{[p.tamano, p.angulo, p.movimiento, p.lente].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="cifra text-xs text-muted">{p.minutos} min</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
