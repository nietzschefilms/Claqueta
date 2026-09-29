"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cancelarEvento, crearEvento, type Resultado } from "./acciones";
import { huecosEnComun, type Ocupado } from "@/lib/claqueta/estudio";
import { minutosAHora, sumarDias } from "@/lib/claqueta/fechas";
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

// Agenda del equipo: buscar un hueco de los dos, agendar y ver lo próximo.
export function AgendaEquipo({ equipoId, eventos, ocupados, miembros, yo, hoy, ahora }: { equipoId: string; eventos: Evento[]; ocupados: Ocupado[]; miembros: Miembro[]; yo: string; hoy: string; ahora: number }) {
  const [duracion, setDuracion] = useState(60);
  const [margen, setMargen] = useState(true);
  const [elegido, setElegido] = useState<{ fecha: string; inicio: string; fin: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const nombre = (id: string | null) => (id === yo ? "Tú" : miembros.find((m) => m.id === id)?.nombre.split(" ")[0] ?? "Alguien");

  const fechas = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i)), [hoy]);
  const huecos = useMemo(
    () => huecosEnComun(ocupados, fechas, { duracion, margen: margen ? 30 : 0, ahora: { fecha: hoy, minutos: ahora } }),
    [ocupados, fechas, duracion, margen, hoy, ahora]
  );
  const porDia = fechas.map((f) => ({ fecha: f, huecos: huecos.filter((h) => h.fecha === f) }));

  const elegir = (fecha: string, inicio: number) => {
    setElegido({ fecha, inicio: minutosAHora(inicio), fin: minutosAHora(Math.min(inicio + duracion, 23 * 60 + 59)) });
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const proximos = eventos.filter((e) => e.fecha >= hoy);

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
      {/* ── Huecos ── */}
      <section aria-labelledby="huecos" className="tarjeta aparecer lg:col-span-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="huecos" className="titulo text-2xl">¿Cuándo podemos?</h2>
          <span className="etiqueta">Libres los {miembros.length || 2} · 7 días</span>
        </div>
        <p className="mt-1 text-sm text-muted">Horas donde nadie tiene clase, fijo ni cita. Toca una para agendar.</p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {[30, 60, 90, 120, 180].map((m) => (
            <button key={m} type="button" aria-pressed={duracion === m} onClick={() => setDuracion(m)} className={`cifra ${chip(duracion === m)}`}>
              {m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h 30` : `${m / 60} h`}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={margen} onChange={(e) => setMargen(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-rojo))]" />
            30 min de traslado
          </label>
        </div>
        <ol className="mt-4 space-y-3">
          {porDia.map(({ fecha, huecos: hs }) => (
            <li key={fecha} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3">
              <span className={`cifra pt-2 text-xs ${fecha === hoy ? "font-semibold text-acento" : "text-muted"}`}>{fecha === hoy ? "hoy" : diaCorto(fecha)}</span>
              {hs.length === 0 ? (
                <span className="pt-2 text-xs text-muted/70">Sin hueco de {duracion} min</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {hs.map((h) => (
                    <button
                      key={`${h.fecha}-${h.inicio}`}
                      type="button"
                      onClick={() => elegir(h.fecha, h.inicio)}
                      title={h.pisaBloques ? "Pisa un bloque de foco de alguien (se puede mover)" : "Libre para todos"}
                      className={`cifra rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo ${
                        h.pisaBloques ? "border-aviso/40 bg-aviso/10" : "border-ok/40 bg-ok/10"
                      }`}
                    >
                      {minutosAHora(h.inicio)}–{minutosAHora(h.fin)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ok/60" aria-hidden="true" /> libre total</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-aviso/70" aria-hidden="true" /> pisa un bloque de foco (se mueve)</span>
        </p>
      </section>

      {/* ── Agendar + próximos ── */}
      <div className="min-w-0 space-y-6 lg:col-span-5">
        <section ref={formRef} aria-labelledby="agendar" className="tarjeta aparecer">
          <h2 id="agendar" className="titulo text-2xl">Agendar</h2>
          <FormEvento key={elegido ? `${elegido.fecha}${elegido.inicio}` : "vacio"} equipoId={equipoId} miembros={miembros} yo={yo} hoy={hoy} inicial={elegido} />
        </section>

        <section aria-labelledby="proximos" className="tarjeta aparecer p-0">
          <h2 id="proximos" className="titulo px-5 pb-2 pt-5 text-2xl">Próximo</h2>
          {proximos.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Nada agendado. Busca un hueco y aparten la hora.</p>
          ) : (
            <ul className="divide-y divide-borde/60">
              {proximos.map((e) => (
                <FilaEvento key={e.id} e={e} hoy={hoy} yo={yo} nombre={nombre} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function FilaEvento({ e, hoy, yo, nombre }: { e: Evento; hoy: string; yo: string; nombre: (id: string | null) => string }) {
  const [seguro, setSeguro] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const van = e.participantes.length ? e.participantes.map(nombre).join(", ") : "Los dos";
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

function FormEvento({ equipoId, miembros, yo, hoy, inicial }: { equipoId: string; miembros: Miembro[]; yo: string; hoy: string; inicial: { fecha: string; inicio: string; fin: string } | null }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearEvento, null);
  const [tipo, setTipo] = useState<string>("junta");
  const [van, setVan] = useState<string[]>([]);
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
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <input type="date" name="fecha" required min={hoy} defaultValue={inicial?.fecha ?? hoy} aria-label="Fecha" className="campo rounded-full py-2.5 font-mono text-sm" />
        <input type="time" name="inicio" required defaultValue={inicial?.inicio ?? ""} aria-label="Empieza" className="campo rounded-full py-2.5 font-mono text-sm" />
        <input type="time" name="fin" required defaultValue={inicial?.fin ?? ""} aria-label="Termina" className="campo rounded-full py-2.5 font-mono text-sm" />
      </div>
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
