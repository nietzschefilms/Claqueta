"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { cancelarEvento, crearEvento, type Resultado } from "./acciones";
import { horaAMinutos, minutosAHora, sumarDias } from "@/lib/claqueta/fechas";
import type { Ocupado } from "@/lib/claqueta/estudio";
import type { Evento } from "@/lib/claqueta/datos-estudio";

type Miembro = { id: string; nombre: string };

const TIPOS = [
  { v: "junta", t: "Junta" },
  { v: "rodaje", t: "Rodaje" },
  { v: "scouting", t: "Scouting" },
  { v: "llamada", t: "Llamada" },
  { v: "ensayo", t: "Ensayo" },
  { v: "entrega", t: "Entrega" },
  { v: "otro", t: "Otro" }
] as const;
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaCorto = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
};
const hhmm = (t: string) => t.slice(0, 5);

const chip = (on: boolean) =>
  `rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
    on ? "bg-tinta text-fondo shadow-[0_6px_16px_-8px_rgb(0_0_0/0.6)]" : "bg-tinta/[0.06] text-muted hover:text-tinta"
  }`;

// Agenda del equipo: el calendario de lo que viene y agendar. Las fechas se
// acuerdan en persona; aquí cada quien ve lo que le toca.
export function AgendaEquipo({ equipoId, eventos, ocupados, miembros, yo, hoy }: { equipoId: string; eventos: Evento[]; ocupados: Ocupado[]; miembros: Miembro[]; yo: string; hoy: string }) {
  const nombre = (id: string | null) => (id === yo ? "Tú" : miembros.find((m) => m.id === id)?.nombre.split(" ")[0] ?? "Alguien");
  const proximos = eventos.filter((e) => e.fecha >= hoy);
  const meToca = (e: Evento) => e.participantes.length === 0 || e.participantes.includes(yo);
  const [soloMios, setSoloMios] = useState(false);
  const lista = soloMios ? proximos.filter(meToca) : proximos;

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
      {/* ── Calendario ── */}
      <section aria-labelledby="proximos" className="tarjeta aparecer p-0 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-5">
          <h2 id="proximos" className="titulo text-2xl">Calendario</h2>
          <div className="flex gap-1.5" role="group" aria-label="Qué ver">
            <button type="button" aria-pressed={!soloMios} onClick={() => setSoloMios(false)} className={chip(!soloMios)}>
              Todo el equipo
            </button>
            <button type="button" aria-pressed={soloMios} onClick={() => setSoloMios(true)} className={chip(soloMios)}>
              Lo que me toca
            </button>
          </div>
        </div>
        {lista.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">{soloMios ? "No tienes nada agendado." : "Nada agendado todavía. Cuando acuerden una fecha, agéndala aquí."}</p>
        ) : (
          <ul className="divide-y divide-borde/60">
            {lista.map((e) => (
              <FilaEvento key={e.id} e={e} hoy={hoy} yo={yo} nombre={nombre} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Agendar ── */}
      <section aria-labelledby="agendar" className="tarjeta aparecer lg:col-span-5">
        <h2 id="agendar" className="titulo text-2xl">Agendar</h2>
        <p className="mt-1 text-sm text-muted">Ya que acordaron la fecha, ponla aquí: a cada quien le sale en su día con aviso.</p>
        <FormEvento key="vacio" equipoId={equipoId} miembros={miembros} yo={yo} hoy={hoy} inicial={null} ocupados={ocupados} />
      </section>
    </div>
  );
}

function FilaEvento({ e, hoy, yo, nombre }: { e: Evento; hoy: string; yo: string; nombre: (id: string | null) => string }) {
  const [seguro, setSeguro] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const van = e.participantes.length ? e.participantes.map(nombre).join(", ") : "Todo el equipo";
  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      <div className="w-14 shrink-0 text-center">
        <p className={`cifra text-[11px] uppercase ${e.fecha === hoy ? "font-semibold text-acento" : "text-muted"}`}>{e.fecha === hoy ? "hoy" : diaCorto(e.fecha).split(" ")[0]}</p>
        <p className="titulo text-2xl leading-none">{Number(e.fecha.slice(8))}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{e.titulo}</p>
        <p className="cifra mt-0.5 text-[11px] text-muted">
          {hhmm(e.inicio)}–{hhmm(e.fin)} · {TIPOS.find((t) => t.v === e.tipo)?.t ?? e.tipo}
          {e.lugar ? ` · ${e.lugar}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          Van: {van}
          {e.creado_por && e.creado_por !== yo ? ` · agendó ${nombre(e.creado_por)}` : ""}
        </p>
        {e.notas && <p className="mt-1 text-xs text-muted">{e.notas}</p>}
      </div>
      {seguro ? (
        <div className="flex shrink-0 gap-1">
          <button type="button" disabled={pendiente} onClick={() => iniciar(async () => void (await cancelarEvento(e.id)))} className="rounded-full bg-rojo px-3 py-1.5 text-xs font-semibold text-white">
            Cancelar cita
          </button>
          <button type="button" onClick={() => setSeguro(false)} className="rounded-full bg-tinta/[0.06] px-3 py-1.5 text-xs">
            No
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setSeguro(true)} aria-label={`Cancelar ${e.titulo}`} className="shrink-0 rounded-full px-2 py-1 text-xs text-muted hover:text-tinta">
          ✕
        </button>
      )}
    </li>
  );
}

function FormEvento({ equipoId, miembros, yo, hoy, inicial, ocupados = [] }: { equipoId: string; miembros: Miembro[]; yo: string; hoy: string; inicial: { fecha: string; inicio: string; fin: string } | null; ocupados?: Ocupado[] }) {
  const [van, setVan] = useState<string[]>([]);
  const [cuando, setCuando] = useState({ fecha: inicial?.fecha ?? hoy, inicio: inicial?.inicio ?? "", fin: inicial?.fin ?? "" });
  // Cruce con la escuela y lo demás: quién tiene clase u otra cita a esa hora.
  const choques = (() => {
    if (!cuando.fecha || !/^\d{2}:\d{2}/.test(cuando.inicio) || !/^\d{2}:\d{2}/.test(cuando.fin)) return [];
    const a = horaAMinutos(cuando.inicio.slice(0, 5));
    const b = horaAMinutos(cuando.fin.slice(0, 5));
    if (b <= a) return [];
    const quienes = van.length ? van : miembros.map((m) => m.id);
    const porPersona = new Map<string, Ocupado[]>();
    for (const o of ocupados) {
      if (o.fecha !== cuando.fecha || !quienes.includes(o.user_id) || o.tipo === "bloque") continue;
      if (horaAMinutos(o.inicio.slice(0, 5)) < b && horaAMinutos(o.fin.slice(0, 5)) > a) porPersona.set(o.user_id, [...(porPersona.get(o.user_id) ?? []), o]);
    }
    return [...porPersona.entries()].map(([u, os]) => ({
      quien: u === yo ? "Tú" : miembros.find((m) => m.id === u)?.nombre.split(" ")[0] ?? "Alguien",
      que: os.map((o) => `${o.tipo === "clase" ? "clase" : o.tipo === "evento" ? "otra cita" : "algo fijo"} ${o.inicio.slice(0, 5)}–${o.fin.slice(0, 5)}`).join(", ")
    }));
  })();
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearEvento, null);
  const [tipo, setTipo] = useState<string>("junta");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) {
      form.current?.reset();
      setVan([]);
    }
  }, [estado]);
  const alternar = (id: string) => setVan((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <form ref={form} action={enviar} className="mt-4 space-y-3">
      <input type="hidden" name="equipo_id" value={equipoId} />
      <input type="hidden" name="tipo" value={tipo} />
      {van.map((v) => (
        <input key={v} type="hidden" name="participantes" value={v} />
      ))}
      <input name="titulo" required maxLength={100} autoComplete="off" placeholder="¿Qué es? Ej. Junta con Bribona" aria-label="Nombre de la cita" className="campo rounded-full py-2.5 text-sm" />
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => (
          <button key={t.v} type="button" aria-pressed={tipo === t.v} onClick={() => setTipo(t.v)} className={chip(tipo === t.v)}>
            {t.t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 [&>input:first-child]:col-span-2">
        <input type="date" name="fecha" required min={hoy} defaultValue={inicial?.fecha ?? hoy} onChange={(e) => setCuando((c) => ({ ...c, fecha: e.target.value }))} aria-label="Fecha" className="campo rounded-full py-2.5 font-mono text-sm" />
        <input type="time" name="inicio" required defaultValue={inicial?.inicio ?? ""} onChange={(e) => setCuando((c) => ({ ...c, inicio: e.target.value }))} aria-label="Empieza" className="campo rounded-full py-2.5 font-mono text-sm" />
        <input type="time" name="fin" required defaultValue={inicial?.fin ?? ""} onChange={(e) => setCuando((c) => ({ ...c, fin: e.target.value }))} aria-label="Termina" className="campo rounded-full py-2.5 font-mono text-sm" />
      </div>
      {choques.length > 0 && (
        <div className="rounded-2xl border border-aviso/40 bg-aviso/10 px-4 py-3 text-sm" role="status">
          <p className="font-semibold">Ojo, a esa hora:</p>
          <ul className="mt-1 space-y-0.5">
            {choques.map((c) => (
              <li key={c.quien}>
                <b>{c.quien}</b> tiene {c.que}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cuando.inicio && cuando.fin && choques.length === 0 && cuando.fin > cuando.inicio && <p className="text-xs font-semibold text-ok">Todos libres a esa hora.</p>}
      <input name="lugar" maxLength={120} autoComplete="off" placeholder="Lugar (opcional): dirección o link de Meet" aria-label="Lugar" className="campo rounded-full py-2.5 text-sm" />
      {miembros.length > 1 && (
        <fieldset>
          <legend className="etiqueta">Quién va (nadie marcado = todos)</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {miembros.map((m) => (
              <button key={m.id} type="button" aria-pressed={van.includes(m.id)} onClick={() => alternar(m.id)} className={chip(van.includes(m.id))}>
                {m.id === yo ? "Yo" : m.nombre.split(" ")[0]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <textarea name="notas" maxLength={1000} rows={2} placeholder="Notas (opcional)" aria-label="Notas" className="campo rounded-2xl py-2.5 text-sm" />
      {estado?.error && <p className="alerta-error" role="alert">{estado.error}</p>}
      {estado?.ok && estado.mensaje && <p className="alerta-ok" role="status">{estado.mensaje}</p>}
      <button type="submit" disabled={enviando} className="btn-rojo w-full py-3">
        {enviando ? "Agendando…" : "Agendar para el equipo"}
      </button>
    </form>
  );
}
