import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarDinero, cargarHitos, cargarRutina, cargarTareas } from "@/lib/claqueta/datos";
import { esperados, pesos } from "@/lib/claqueta/dinero";
import Link from "next/link";
import { diaSemana, fechaCDMX, fechaRelativa, minutosAHora, minutosAhoraCDMX } from "@/lib/claqueta/fechas";
import { lasTresDeHoy, planearDia, type BloquePlaneado } from "@/lib/claqueta/planeador";
import { puntaje } from "@/lib/claqueta/prioridad";
import { riesgoEK, EK_SEMANAS } from "@/lib/claqueta/ek";
import { FRENTES } from "@/lib/claqueta/frentes";
import type { Tarea } from "@/lib/claqueta/tipos";
import { CheckTarea } from "@/components/claqueta/CheckTarea";
import { BotonMoverManana } from "@/components/claqueta/AccionesTarea";
import { Anillo, ChipFrente, EtiquetaPrioridad, estiloFrente } from "@/components/claqueta/frente-ui";

export const metadata: Metadata = { title: "Hoy" };

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function duracion(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

const SEMAFORO = { "en-tiempo": "bg-ok", "atras-1": "bg-aviso", "atras-2": "bg-rojo" } as const;

// HOY · la hoja de llamado del día.
export default async function Hoy() {
  await requerirSesion();
  const hoy = fechaCDMX();
  const ahora = minutosAhoraCDMX();
  const [tareas, rutina, hitos, dinero] = await Promise.all([cargarTareas(hoy), cargarRutina(), cargarHitos("ek"), cargarDinero()]);
  const cobros = esperados(dinero.reglas, dinero.pagos, hoy);
  const cobroHoy = [...cobros.atrasados, ...cobros.hoy];
  const proximoCobro = cobros.proximos[0];

  const plan = planearDia(rutina.filter((b) => b.weekday === diaSemana(hoy)), tareas, hoy);
  const tres = lasTresDeHoy(tareas, hoy);
  const ek = riesgoEK(hitos, hoy);
  const [, mes, dia] = hoy.split("-").map(Number);
  const hechasHoy = tareas.filter((t) => t.status === "hecho" && t.done_at && fechaCDMX(t.done_at) === hoy).length;
  const pendientesPlan = plan.bloques.flatMap((b) => b.tareas).filter((t) => t.status !== "hecho").length + plan.noCupo.length;
  const minutosPlan = plan.bloques.reduce((a, b) => a + b.usados, 0);
  const actual = plan.bloques.find((b) => ahora >= b.inicio && ahora < b.fin);
  const siguiente = plan.bloques.find((b) => b.inicio > ahora);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ── Encabezado ── */}
      <header className="aparecer space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="etiqueta flex items-center gap-2 text-tinta">
            <span className="h-1.5 w-1.5 rounded-full bg-rojo" aria-hidden="true" />
            Hoja de llamado
          </p>
          <p className="cifra text-xs text-muted">{hoy.split("-").reverse().join(".")}</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="titulo text-[clamp(3.5rem,15vw,7.5rem)]">
            {DIAS[diaSemana(hoy)]}
            <span className="block text-[0.36em] leading-tight tracking-normal text-muted">
              {dia} de {MESES[mes - 1]}
            </span>
          </h1>
          <div className="flex flex-wrap gap-2 pb-1">
            <span className="pastilla">
              <span className={`h-2 w-2 rounded-full ${SEMAFORO[ek.semaforo]}`} aria-hidden="true" />
              EK · Sem {Math.min(ek.semana, EK_SEMANAS)}/{EK_SEMANAS} · {ek.texto}
            </span>
            <Link href="/app/dinero" className="pastilla transition hover:bg-superficie focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
              {cobroHoy.length > 0 ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
                  Cobro hoy · {cobroHoy.map((c) => `${c.regla.source} ${pesos(c.centavos)}`).join(" · ")}
                </>
              ) : proximoCobro ? (
                <span className="text-muted">$ Próximo · {proximoCobro.regla.source} {pesos(proximoCobro.centavos)} · {fechaRelativa(proximoCobro.fecha, hoy)}</span>
              ) : (
                <span className="text-muted">$ Dinero</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Ahora + resumen ── */}
      <div className="grid gap-4 lg:grid-cols-12">
        <TarjetaAhora actual={actual} siguiente={siguiente} ahora={ahora} />

        <section aria-label="Resumen del día" className="tarjeta aparecer grid grid-cols-3 items-center gap-2 p-4 lg:col-span-5 lg:p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <Anillo valor={hechasHoy} total={hechasHoy + pendientesPlan} tamano={64} grosor={6}>
              <span className="cifra text-lg font-semibold">{hechasHoy}</span>
            </Anillo>
            <span className="etiqueta">Hechas{pendientesPlan ? ` de ${hechasHoy + pendientesPlan}` : ""}</span>
          </div>
          <Dato titulo="Plan" valor={duracion(minutosPlan)} />
          <Dato titulo="No cupo" valor={String(plan.noCupo.length)} alerta={plan.noCupo.length > 0} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-5">
          {/* ── Las 3 de hoy ── */}
          <section aria-labelledby="tres" className="tarjeta aparecer p-0">
            <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
              <h2 id="tres" className="titulo text-2xl">Las 3 de hoy</h2>
              <span className="etiqueta">Por puntaje</span>
            </div>
            {tres.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Nada pendiente. Captura algo con el botón rojo.</p>
            ) : (
              <ol className="divide-y divide-borde/60">
                {tres.map((t, i) => (
                  <li key={t.id} className="flex items-start gap-4 px-5 py-4">
                    <span className="cifra w-7 shrink-0 pt-0.5 text-2xl font-medium leading-none text-muted/40">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-semibold leading-snug">{t.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <ChipFrente id={t.area} corto />
                        <EtiquetaPrioridad puntaje={puntaje(t, hoy)} />
                        <MetaTarea t={t} hoy={hoy} />
                      </div>
                    </div>
                    <CheckTarea id={t.id} hecha={false} titulo={t.title} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* ── No cupo hoy ── */}
          {plan.noCupo.length > 0 && (
            <section aria-labelledby="nocupo" className="tarjeta aparecer relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-1 bg-rojo" aria-hidden="true" />
              <h2 id="nocupo" className="titulo text-2xl text-acento">No cupo hoy</h2>
              <p className="mb-4 mt-1 text-sm text-muted">Vence hoy o ya venció y no entra en ningún bloque. Hazlo aparte o pásalo a mañana.</p>
              <ul className="space-y-3">
                {plan.noCupo.map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <CheckTarea id={t.id} hecha={false} titulo={t.title} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{t.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <ChipFrente id={t.area} corto />
                        <MetaTarea t={t} hoy={hoy} />
                      </div>
                    </div>
                    <BotonMoverManana id={t.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Línea de tiempo ── */}
        <section aria-labelledby="linea" className="tarjeta aparecer lg:col-span-7">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 id="linea" className="titulo text-2xl">Línea de tiempo</h2>
            <span className="cifra text-xs text-muted">{minutosAHora(ahora)}</span>
          </div>
          {plan.bloques.length === 0 ? (
            <p className="text-sm text-muted">Hoy no hay rutina. Día libre.</p>
          ) : (
            <ol className="relative">
              <span className="absolute bottom-3 left-[3.9rem] top-2 w-px bg-borde" aria-hidden="true" />
              {plan.bloques.map((bp) => (
                <Bloque key={bp.bloque.id} bp={bp} ahora={ahora} hoy={hoy} />
              ))}
            </ol>
          )}

          {plan.hechasFuera.length > 0 && (
            <div className="mt-4 border-t border-borde/60 pt-4">
              <p className="etiqueta mb-2">También hecho hoy</p>
              <ul className="space-y-2">
                {plan.hechasFuera.map((t) => (
                  <FilaTarea key={t.id} t={t} hoy={hoy} />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, alerta = false }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 border-l border-borde/60 text-center">
      <span className={`cifra grid h-16 place-items-center text-2xl font-semibold ${alerta ? "text-acento" : ""}`}>{valor}</span>
      <span className="etiqueta">{titulo}</span>
    </div>
  );
}

// Lo que toca en este momento, con cuánto va del bloque.
function TarjetaAhora({ actual, siguiente, ahora }: { actual?: BloquePlaneado; siguiente?: BloquePlaneado; ahora: number }) {
  const bp = actual ?? siguiente;
  const frente = bp?.bloque.areas[0];
  const avance = actual ? (ahora - actual.inicio) / (actual.fin - actual.inicio) : 0;
  const pendientes = bp ? bp.tareas.filter((t) => t.status !== "hecho") : [];

  return (
    <section
      aria-label={actual ? "Ahora" : "Lo que sigue"}
      style={frente ? estiloFrente(frente) : undefined}
      className="vidrio aparecer relative overflow-hidden rounded-tarjeta p-5 lg:col-span-7 lg:p-6"
    >
      {frente && <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[rgb(var(--fc)/0.22)] blur-3xl" aria-hidden="true" />}
      <div className="relative">
        <p className="etiqueta flex items-center gap-2">
          {actual ? (
            <>
              <span className="latido h-2 w-2 rounded-full bg-rojo" aria-hidden="true" />
              <span className="text-acento">Ahora</span>
            </>
          ) : siguiente ? (
            "Lo que sigue"
          ) : (
            "Día cerrado"
          )}
        </p>

        {bp ? (
          <>
            <h2 className="titulo mt-2 text-4xl lg:text-5xl">{bp.bloque.label}</h2>
            <p className="cifra mt-2 text-sm text-muted">
              {minutosAHora(bp.inicio)} – {minutosAHora(bp.fin)}
              {actual ? ` · quedan ${duracionCorta(actual.fin - ahora)}` : ` · empieza en ${duracionCorta(bp.inicio - ahora)}`}
            </p>
            {actual && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-tinta/10" role="progressbar" aria-label="Avance del bloque" aria-valuenow={Math.round(avance * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-rojo" style={{ width: `${Math.max(3, avance * 100)}%` }} />
              </div>
            )}
            {pendientes.length > 0 && (
              <ul className="mt-4 space-y-2">
                {pendientes.slice(0, 3).map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <CheckTarea id={t.id} hecha={false} titulo={t.title} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                    <span className="cifra shrink-0 text-[11px] text-muted">{duracionCorta(t.est_minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
            {bp.bloque.kind === "focus" && pendientes.length === 0 && (
              <p className="mt-3 text-sm text-muted">Nada pendiente en este bloque. Adelanta algo o descansa.</p>
            )}
          </>
        ) : (
          <>
            <h2 className="titulo mt-2 text-4xl lg:text-5xl">Corte<span className="text-rojo">.</span></h2>
            <p className="mt-2 text-sm text-muted">Ya no hay bloques hoy. Descansa; mañana se rueda.</p>
          </>
        )}
      </div>
    </section>
  );
}

function duracionCorta(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function Bloque({ bp, ahora, hoy }: { bp: BloquePlaneado; ahora: number; hoy: string }) {
  const enCurso = ahora >= bp.inicio && ahora < bp.fin;
  const pasado = ahora >= bp.fin;
  const frente = bp.bloque.areas[0];
  const fijo = bp.bloque.kind === "fixed";
  const lleno = bp.capacidad > 0 ? Math.min(1, bp.usados / bp.capacidad) : 0;

  return (
    <li className="relative grid grid-cols-[3.25rem_1fr] gap-4 pb-3" style={frente ? estiloFrente(frente) : undefined}>
      <div className="pt-3 text-right">
        <span className={`cifra text-xs ${enCurso ? "font-semibold text-acento" : pasado ? "text-muted/50" : "text-muted"}`}>{minutosAHora(bp.inicio)}</span>
      </div>
      <span
        className={`absolute left-[3.9rem] top-[1.05rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4 ring-superficie ${
          enCurso ? "latido bg-rojo" : fijo ? "bg-borde" : "bg-[rgb(var(--fc,var(--c-tinta)))]"
        }`}
        aria-hidden="true"
      />

      {fijo ? (
        <p className={`py-2.5 pl-2 text-sm text-muted ${pasado && !enCurso ? "opacity-50" : ""}`}>
          {bp.bloque.label}
          {enCurso && <AhoraPill />}
        </p>
      ) : (
        <div
          className={`ml-2 rounded-2xl border p-3.5 transition ${
            enCurso ? "border-rojo/40 bg-superficie/80 shadow-[0_10px_30px_-18px_rgb(255_0_0/0.6)]" : "border-[rgb(var(--fc,var(--c-borde))/0.25)] bg-[rgb(var(--fc,var(--c-tinta))/0.06)]"
          } ${pasado && !enCurso ? "opacity-60" : ""}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-lg font-bold uppercase leading-tight tracking-tight">
              {bp.bloque.label}
              {enCurso && <AhoraPill />}
            </p>
            <span className="cifra shrink-0 text-[11px] text-muted">
              {bp.usados}/{bp.capacidad} min{bp.flex ? " · libre" : ""}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-tinta/10" aria-hidden="true">
            <div className="h-full rounded-full bg-[rgb(var(--fc,var(--c-tinta)))]" style={{ width: `${lleno * 100}%` }} />
          </div>
          {bp.tareas.length === 0 ? (
            <p className="mt-2.5 text-sm text-muted">
              {bp.flex ? "Libre. Nada pendiente que acomodar." : `Sin pendientes de ${bp.bloque.areas.map((a) => FRENTES[a].corto).join(" y ")}. Adelanta algo o descansa.`}
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {bp.tareas.map((t) => (
                <FilaTarea key={t.id} t={t} hoy={hoy} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function AhoraPill() {
  return <span className="ml-2 inline-block rounded-full bg-rojo px-2 py-0.5 align-middle font-mono text-[9px] font-semibold tracking-wider text-white">AHORA</span>;
}

function MetaTarea({ t, hoy }: { t: Tarea; hoy: string }) {
  const vencida = t.due_date !== null && t.due_date < hoy && t.status !== "hecho";
  return (
    <span className="cifra text-[11px] text-muted">
      {t.due_date && <span className={vencida ? "font-semibold text-acento" : ""}>{vencida ? "venció " : ""}{fechaRelativa(t.due_date, hoy)} · </span>}
      {duracion(t.est_minutes)}
      {t.repeat === "weekly" && " · ↻"}
    </span>
  );
}

function FilaTarea({ t, hoy }: { t: Tarea; hoy: string }) {
  const hecha = t.status === "hecho";
  return (
    <li className="flex items-start gap-3">
      <CheckTarea id={t.id} hecha={hecha} titulo={t.title} />
      <div className="min-w-0 flex-1 pt-1">
        <p className={`text-sm leading-snug ${hecha ? "text-muted line-through decoration-rojo decoration-2" : "font-medium"}`}>{t.title}</p>
        {!hecha && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ChipFrente id={t.area} corto />
            <MetaTarea t={t} hoy={hoy} />
            {t.status === "haciendo" && <span className="rounded-full bg-rojo/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-acento">En curso</span>}
          </div>
        )}
      </div>
    </li>
  );
}
