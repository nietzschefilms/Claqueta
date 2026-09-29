"use client";

import { useMemo, useState, useTransition } from "react";
import { guardarReporte } from "../../acciones";
import { escenasDe, type Linea } from "@/lib/claqueta/estudio";
import { resumenDia } from "@/lib/claqueta/produccion";
import type { Plano, ReporteRodaje, RodajeEscena } from "@/lib/claqueta/datos-estudio";

const hm = (min: number | null) => (min === null ? "—" : `${Math.floor(Math.abs(min) / 60)} h ${String(Math.abs(min) % 60).padStart(2, "0")}`);
const fechaLarga = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// REPORTE DIARIO · lo que de verdad pasó en el set: horas, planos, tomas e incidentes.
export function Reporte({ proyectoId, nombre, lineas, rodaje, planos, reportes, rodajesAgenda, hoy }: { proyectoId: string; nombre: string; lineas: Linea[]; rodaje: RodajeEscena[]; planos: Plano[]; reportes: ReporteRodaje[]; rodajesAgenda: { fecha: string; inicio: string; fin: string }[]; hoy: string }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const diaDe = useMemo(() => new Map(rodaje.map((r) => [r.escena_id, r.dia])), [rodaje]);
  const dias = useMemo(() => [...new Set([...rodaje.map((r) => r.dia).filter((d): d is string => !!d), ...reportes.map((r) => r.fecha), hoy])].sort(), [rodaje, reportes, hoy]);
  const [fecha, setFecha] = useState(dias.includes(hoy) && rodaje.some((r) => r.dia === hoy) ? hoy : dias.find((d) => d >= hoy) ?? dias[dias.length - 1]);
  const [cambios, setCambios] = useState<Record<string, Partial<ReporteRodaje>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const base = reportes.find((r) => r.fecha === fecha) ?? null;
  const rep = { llamado: null, primera_toma: null, comida_inicio: null, comida_fin: null, fin: null, clima: null, incidentes: null, notas: null, ...base, ...cambios[fecha] };
  const agenda = rodajesAgenda.find((e) => e.fecha === fecha);
  const r = resumenDia(fecha, escenas, diaDe, planos, rep, agenda?.fin.slice(0, 5) ?? null);
  const numeroDia = dias.filter((d) => rodaje.some((x) => x.dia === d)).indexOf(fecha) + 1;

  const guardar = (campo: keyof ReporteRodaje, valor: string) => {
    if (String(rep[campo] ?? "").slice(0, campo === "clima" || campo === "incidentes" || campo === "notas" ? undefined : 5) === valor) return;
    setCambios((c) => ({ ...c, [fecha]: { ...c[fecha], [campo]: valor || null } }));
    iniciar(async () => {
      const res = await guardarReporte(proyectoId, fecha, { [campo]: valor });
      setError(res.ok ? null : res.error ?? "No se guardó.");
    });
  };

  const hora = (campo: "llamado" | "primera_toma" | "comida_inicio" | "comida_fin" | "fin", t: string) => (
    <label className="block">
      <span className="etiqueta">{t}</span>
      <input key={`${fecha}-${campo}`} type="time" defaultValue={rep[campo]?.slice(0, 5) ?? ""} onBlur={(e) => guardar(campo, e.target.value)} className="campo cifra mt-1 rounded-full py-2 text-sm" />
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="sin-barra -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          {dias.map((d) => (
            <button key={d} type="button" aria-pressed={fecha === d} onClick={() => setFecha(d)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold capitalize ${fecha === d ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"}`}>
              {d === hoy ? "Hoy" : new Date(`${d}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => window.print()} className="btn-secundario ml-auto">
          Imprimir / PDF
        </button>
      </div>
      {error && <p className="alerta-error">{error}</p>}

      <article className="imprimible space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="etiqueta">Reporte diario de rodaje{numeroDia > 0 ? ` · día ${numeroDia}` : ""}</p>
            <h3 className="titulo text-3xl">{nombre}</h3>
            <p className="text-sm capitalize text-muted">{fechaLarga(fecha)}</p>
          </div>
          {pendiente && <span className="text-xs text-muted print:hidden">Guardando…</span>}
        </header>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Dato t="Escenas" v={`${r.escenasCompletas} de ${r.escenasProgramadas}`} bien={r.escenasProgramadas > 0 && r.escenasCompletas === r.escenasProgramadas} />
          <Dato t="Planos" v={`${r.planosFilmados} de ${r.planosProgramados}`} nota={r.planosExtra ? `+${r.planosExtra} adelantados` : undefined} bien={r.planosProgramados > 0 && r.planosFilmados === r.planosProgramados} />
          <Dato t="Tomas" v={String(r.tomas)} />
          <Dato t="Jornada" v={hm(r.jornada)} nota={r.extra === null ? (agenda ? `Programado hasta ${agenda.fin.slice(0, 5)}` : undefined) : r.extra > 0 ? `${hm(r.extra)} extra` : r.extra < 0 ? `${hm(r.extra)} antes` : "A tiempo"} mal={r.extra !== null && r.extra > 0} />
        </dl>

        <section className="tarjeta grid grid-cols-2 gap-3 md:grid-cols-5">
          {hora("llamado", "Llamado")}
          {hora("primera_toma", "Primera toma")}
          {hora("comida_inicio", "Comida")}
          {hora("comida_fin", "Regreso")}
          {hora("fin", "Fin (wrap)")}
          <p className="col-span-2 text-xs text-muted md:col-span-5">
            {r.arranque !== null && `De llamado a primera toma: ${hm(r.arranque)}. `}
            {r.comida !== null && `Comida: ${r.comida} min. `}
            Estimado por planos: {hm(r.minutosEstimados)}.
          </p>
        </section>

        {r.pendientes.length > 0 && (
          <section className="tarjeta relative overflow-hidden">
            <span className="absolute inset-y-0 left-0 w-1 bg-rojo" aria-hidden="true" />
            <h4 className="titulo text-xl">Quedó pendiente</h4>
            <p className="cifra mt-1 text-sm">{r.pendientes.map((p) => p.plano).join(" · ")}</p>
            <p className="mt-1 text-xs text-muted">Pásalos a otro día en Plan de rodaje, o márcalos en Planos cuando se filmen.</p>
          </section>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="etiqueta">Clima</span>
            <input key={`${fecha}-clima`} defaultValue={rep.clima ?? ""} maxLength={80} placeholder="Soleado, nublado, lluvia a las 17:00…" onBlur={(e) => guardar("clima", e.target.value)} className="campo mt-1 rounded-full py-2 text-sm" />
          </label>
          <label className="block md:col-span-2">
            <span className="etiqueta">Incidentes</span>
            <input key={`${fecha}-inc`} defaultValue={rep.incidentes ?? ""} maxLength={2000} placeholder="Retrasos, equipo dañado, permisos, accidentes…" onBlur={(e) => guardar("incidentes", e.target.value)} className="campo mt-1 rounded-full py-2 text-sm" />
          </label>
          <label className="block md:col-span-3">
            <span className="etiqueta">Notas</span>
            <textarea key={`${fecha}-notas`} defaultValue={rep.notas ?? ""} maxLength={2000} rows={3} placeholder="Lo que hay que saber para mañana o para edición." onBlur={(e) => guardar("notas", e.target.value)} className="campo mt-1 rounded-2xl py-2 text-sm" />
          </label>
        </section>

        {planos.some((p) => p.filmado_en === fecha) && (
          <section className="tarjeta p-0">
            <h4 className="titulo px-5 pb-2 pt-5 text-xl">Filmado este día</h4>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-1 text-left font-medium">Plano</th>
                  <th className="py-1 text-left font-medium">Qué</th>
                  <th className="py-1 text-right font-medium">Tomas</th>
                  <th className="px-5 py-1 text-right font-medium">Buena</th>
                </tr>
              </thead>
              <tbody>
                {escenas.flatMap((e) =>
                  planos
                    .filter((p) => p.escena_id === e.id && p.filmado_en === fecha)
                    .map((p) => (
                      <tr key={p.id} className="border-t border-borde/50">
                        <td className="cifra px-5 py-1.5 font-semibold">{e.numero}{String.fromCharCode(64 + Math.min(p.numero, 26))}</td>
                        <td className="py-1.5">{p.descripcion || p.tamano || "—"}</td>
                        <td className="cifra py-1.5 text-right">{p.tomas || "—"}</td>
                        <td className="cifra px-5 py-1.5 text-right">{p.toma_buena ? `T${p.toma_buena}` : "—"}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </section>
        )}
      </article>
    </div>
  );
}

function Dato({ t, v, nota, bien, mal }: { t: string; v: string; nota?: string; bien?: boolean; mal?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${mal ? "bg-rojo/10" : bien ? "bg-ok/10" : "bg-tinta/[0.05]"}`}>
      <dt className="etiqueta">{t}</dt>
      <dd className="cifra mt-1 text-2xl font-semibold">{v}</dd>
      {nota && <dd className={`text-xs ${mal ? "font-semibold text-acento" : "text-muted"}`}>{nota}</dd>}
    </div>
  );
}
