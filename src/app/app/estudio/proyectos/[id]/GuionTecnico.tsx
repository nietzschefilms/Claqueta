"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { agregarPlano, editarPlano } from "../../acciones";
import { escenasDe, type Linea } from "@/lib/claqueta/estudio";
import { ANGULOS, MOVIMIENTOS, TAMANOS, reglasRotas, siguienteToma } from "@/lib/claqueta/produccion";
import type { Plano } from "@/lib/claqueta/datos-estudio";
import { comprimir, subirCuadro } from "./Storyboard";
import { ReglasShotlist, type Reglas } from "./Rodaje";

const letra = (n: number) => String.fromCharCode(64 + Math.min(Math.max(n, 1), 26));
const nombreTamano = (v: string | null) => TAMANOS.find((t) => t.v === v)?.t ?? "";

// Chip grande, cómodo para el dedo en set.
function Chip({ activo, rojo, onClick, children, titulo }: { activo: boolean; rojo?: boolean; onClick: () => void; children: React.ReactNode; titulo?: string }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      title={titulo}
      onClick={onClick}
      className={`min-h-11 rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo ${
        activo ? (rojo ? "bg-rojo text-white" : "bg-tinta text-fondo") : rojo ? "bg-tinta/[0.06] text-muted line-through decoration-rojo/70" : "bg-tinta/[0.06] text-tinta hover:bg-tinta/[0.1]"
      }`}
    >
      {children}
    </button>
  );
}

// GUION TÉCNICO · toma por toma desde el celular: escena, número, foto de
// "tu toma", tamaño, ángulo, movimiento y acción. Cada toma es un plano del
// shotlist y su foto es el cuadro del storyboard (no hay datos aparte).
export function GuionTecnico({ proyectoId, nombre, lineas, planos, reglas, puedeEditar }: { proyectoId: string; nombre: string; lineas: Linea[]; planos: Plano[]; reglas: Reglas; puedeEditar: boolean }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const rotas = reglasRotas(planos, reglas.max, reglas.permitidos);
  const formulario = useRef<HTMLElement>(null);
  const [editando, setEditando] = useState<Plano | null>(null);

  if (!escenas.length) return <p className="tarjeta text-sm text-muted">Escribe escenas en el guion para armar el guion técnico toma por toma.</p>;
  const conTomas = escenas.filter((e) => planos.some((p) => p.escena_id === e.id));
  const fueraSet = new Set(rotas.fuera);

  return (
    <div className="space-y-5">
      <div className="tarjeta flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <p className="etiqueta">Tomas</p>
          <p className={`cifra text-2xl font-semibold ${rotas.sobran ? "text-rojo" : ""}`}>
            {planos.length}
            {reglas.max !== null && <span className="text-base text-muted"> de {reglas.max}</span>}
          </p>
          {rotas.sobran > 0 && <p className="text-xs font-semibold text-rojo">Te pasaste por {rotas.sobran}</p>}
        </div>
        <div>
          <p className="etiqueta">Con foto</p>
          <p className="cifra text-2xl font-semibold">
            {planos.filter((p) => p.imagen).length}
            <span className="text-base text-muted"> de {planos.length}</span>
          </p>
        </div>
      </div>
      {(reglas.max !== null || reglas.permitidos?.length || reglas.editar) && (
        <div className="print:hidden">
          <ReglasShotlist proyectoId={proyectoId} reglas={reglas} fuera={rotas.fuera.length} />
        </div>
      )}

      {puedeEditar && (
        <section ref={formulario} className="print:hidden">
          <NuevaToma
            key={editando?.id ?? "nueva"}
            proyectoId={proyectoId}
            escenas={escenas}
            planos={planos}
            reglas={reglas}
            enElTope={rotas.enElTope}
            editando={editando}
            onListo={() => setEditando(null)}
          />
        </section>
      )}

      <div className="imprimible space-y-6">
        <p className="titulo hidden text-3xl print:block">{nombre} · Guion técnico</p>
        {conTomas.length === 0 && <p className="tarjeta text-sm text-muted">{puedeEditar ? "Aún no hay tomas. Arma la primera arriba: escena, foto y tamaño." : "Dirección aún no arma el guion técnico."}</p>}
        {conTomas.map((e) => {
          const ps = planos.filter((p) => p.escena_id === e.id).sort((a, b) => a.numero - b.numero || a.orden - b.orden);
          return (
            <section key={e.id} className="tarjeta break-inside-avoid p-0">
              <h3 className="border-b border-borde/60 px-4 py-3 font-mono text-sm font-bold uppercase">
                {e.numero}. {e.texto}
              </h3>
              {/* Celular: tarjetas. Pantalla grande e impresión: tabla. */}
              <ul className="divide-y divide-borde/50 md:hidden print:hidden">
                {ps.map((p) => (
                  <li key={p.id} className="flex gap-3 px-4 py-3">
                    <Miniatura p={p} etiqueta={`${e.numero}${letra(p.numero)}`} className="w-28 shrink-0 self-start" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold">
                          Toma <span className="cifra">{p.numero}</span> <span className="cifra text-xs text-muted">{e.numero}{letra(p.numero)}</span>
                        </p>
                        {puedeEditar && (
                          <button type="button" onClick={() => { setEditando(p); formulario.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="enlace-mono rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                            Editar
                          </button>
                        )}
                      </div>
                      <p className="flex flex-wrap gap-1 text-xs">
                        {p.tamano && <span className="cifra rounded-full bg-tinta/[0.08] px-2 py-0.5 font-semibold" title={nombreTamano(p.tamano)}>{p.tamano}</span>}
                        {p.angulo && <span className="rounded-full bg-tinta/[0.08] px-2 py-0.5">{p.angulo}</span>}
                        {p.movimiento && <span className={`rounded-full px-2 py-0.5 ${fueraSet.has(p.id) ? "bg-rojo font-semibold text-white" : "bg-tinta/[0.08]"}`}>{p.movimiento}</span>}
                      </p>
                      {p.descripcion ? <p className="text-sm leading-snug">{p.descripcion}</p> : <p className="text-xs text-muted">Sin acción</p>}
                      {fueraSet.has(p.id) && <p className="text-xs font-semibold text-rojo">Movimiento no permitido en este ejercicio</p>}
                    </div>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full text-left text-sm md:table print:table">
                <thead className="text-[11px] uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Toma</th>
                    <th className="py-2 pr-3">Foto</th>
                    <th className="py-2 pr-3">Tamaño</th>
                    <th className="py-2 pr-3">Ángulo</th>
                    <th className="py-2 pr-3">Movimiento</th>
                    <th className="py-2 pr-3">Acción</th>
                    {puedeEditar && <th className="py-2 pr-4 print:hidden"><span className="sr-only">Editar</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde/50">
                  {ps.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="px-4 py-2">
                        <span className="cifra text-lg font-semibold">{p.numero}</span>
                        <span className="cifra block text-[11px] text-muted">{e.numero}{letra(p.numero)}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <Miniatura p={p} etiqueta={`${e.numero}${letra(p.numero)}`} className="w-32" />
                      </td>
                      <td className="py-2 pr-3">
                        <span className="cifra font-semibold">{p.tamano ?? <span className="text-muted">·</span>}</span>
                        {p.tamano && <span className="block text-[11px] text-muted">{nombreTamano(p.tamano)}</span>}
                      </td>
                      <td className="py-2 pr-3">{p.angulo ?? <span className="text-muted">·</span>}</td>
                      <td className={`py-2 pr-3 ${fueraSet.has(p.id) ? "font-semibold text-rojo" : ""}`}>
                        {p.movimiento ?? <span className="text-muted">·</span>}
                        {fueraSet.has(p.id) && <span className="block text-[11px]">No permitido</span>}
                      </td>
                      <td className="py-2 pr-3 leading-snug">{p.descripcion || <span className="text-muted">Sin acción</span>}</td>
                      {puedeEditar && (
                        <td className="py-2 pr-4 text-right print:hidden">
                          <button type="button" onClick={() => { setEditando(p); formulario.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="enlace-mono rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Miniatura({ p, etiqueta, className }: { p: Plano; etiqueta: string; className: string }) {
  return (
    <div className={`relative aspect-video overflow-hidden rounded-xl border border-tinta/30 bg-tinta/[0.04] ${className}`}>
      {p.imagenUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imagenUrl} alt={`Toma ${etiqueta}: ${p.descripcion}`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full place-items-center text-[11px] text-muted">Sin foto</span>
      )}
    </div>
  );
}

// Formulario de una toma (nueva o para corregir), en el orden en que se piensa en set.
function NuevaToma({
  proyectoId,
  escenas,
  planos,
  reglas,
  enElTope,
  editando,
  onListo
}: {
  proyectoId: string;
  escenas: ReturnType<typeof escenasDe>;
  planos: Plano[];
  reglas: Reglas;
  enElTope: boolean;
  editando: Plano | null;
  onListo: () => void;
}) {
  const router = useRouter();
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [escenaId, setEscenaId] = useState(editando?.escena_id ?? escenas[0].id);
  const [numero, setNumero] = useState(editando?.numero ?? siguienteToma(planos, escenas[0].id));
  const [tamano, setTamano] = useState<string | null>(editando?.tamano ?? null);
  const [angulo, setAngulo] = useState<string | null>(editando?.angulo ?? null);
  const [movimiento, setMovimiento] = useState<string | null>(editando?.movimiento ?? null);
  const [accion, setAccion] = useState(editando?.descripcion ?? "");
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  // La foto en vista previa se libera al cambiarla o al salir.
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);

  const escena = escenas.find((e) => e.id === escenaId) ?? escenas[0];
  const repetida = planos.some((p) => p.escena_id === escenaId && p.numero === numero && p.id !== editando?.id);
  const prohibido = (m: string) => !!reglas.permitidos?.length && !reglas.permitidos.includes(m);
  const fotoActual = foto?.url ?? editando?.imagenUrl ?? null;

  const elegirFoto = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setPreparando(true);
    try {
      const blob = await comprimir(f);
      setFoto({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude leer esa foto. Prueba con otra.");
    } finally {
      setPreparando(false);
    }
  };

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setListo(null);
    if (!Number.isInteger(numero) || numero < 1 || numero > 999) return setError("El número de toma va de 1 a 999.");
    if (!tamano) return setError("Elige el tamaño del plano (paso 4).");
    if (accion.length > 400) return setError("La acción es muy larga. Déjala en 400 letras o menos.");
    setError(null);
    setGuardando(true);
    const campos = { numero, tamano, angulo: angulo ?? "", movimiento: movimiento ?? "", descripcion: accion.trim() };
    const sinRed = { ok: false, error: "No hay conexión. Revisa tu señal e intenta otra vez; la toma sigue aquí." } as const;
    const r: { ok: boolean; error?: string; id?: string } = await (editando ? editarPlano(proyectoId, editando.id, campos) : agregarPlano(proyectoId, escenaId, campos)).catch(() => sinRed);
    const id = editando?.id ?? r.id;
    if (!r.ok || !id) {
      setGuardando(false);
      return setError(r.error ?? "No se guardó la toma. Revisa tu conexión e intenta otra vez.");
    }
    let fallaFoto: string | null = null;
    if (foto) {
      try {
        await subirCuadro(proyectoId, id, foto.blob);
      } catch (e) {
        fallaFoto = e instanceof Error ? e.message : "No se subió la foto.";
      }
    }
    setGuardando(false);
    router.refresh();
    if (fallaFoto) {
      // La toma sí quedó: se puede volver a intentar la foto con "Editar".
      setError(`La toma ${numero} se guardó, pero la foto no: ${fallaFoto} Tócala en la lista con "Editar" para subirla otra vez.`);
      setFoto(null);
      if (editando) onListo();
      return;
    }
    if (editando) return onListo();
    // Lista para la siguiente: misma escena, número que sigue, sin foto.
    setListo(`Toma ${numero} guardada.`);
    setNumero(numero + 1);
    setFoto(null);
    setAccion("");
    setAngulo(null);
    setMovimiento(null);
  };

  const paso = (n: number, t: string) => (
    <p className="etiqueta mb-2">
      <span className="cifra mr-1.5 text-tinta">{n}</span>
      {t}
    </p>
  );

  return (
    <form onSubmit={guardar} className="tarjeta space-y-5" noValidate>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="titulo text-2xl">{editando ? `Corregir toma ${editando.numero}` : "Nueva toma"}</h3>
        {editando && (
          <button type="button" onClick={onListo} className="enlace-mono rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">
            Cancelar
          </button>
        )}
      </div>

      <div>
        {paso(1, "Escena")}
        <select
          value={escenaId}
          disabled={!!editando}
          onChange={(e) => {
            setEscenaId(e.target.value);
            setNumero(siguienteToma(planos, e.target.value));
          }}
          aria-label="Escena"
          className="campo font-mono text-sm uppercase disabled:opacity-60"
        >
          {escenas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.numero}. {e.texto}
            </option>
          ))}
        </select>
      </div>

      <div>
        {paso(2, "Toma")}
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Toma anterior" onClick={() => setNumero((n) => Math.max(1, n - 1))} className="btn-secundario h-11 w-11 px-0 text-lg">
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={Number.isFinite(numero) ? numero : ""}
            onChange={(e) => setNumero(Number(e.target.value))}
            aria-label="Número de toma"
            className="campo cifra w-24 text-center text-2xl font-semibold"
          />
          <button type="button" aria-label="Toma siguiente" onClick={() => setNumero((n) => Math.min(999, n + 1))} className="btn-secundario h-11 w-11 px-0 text-lg">
            +
          </button>
          <span className="cifra text-sm text-muted">
            {escena.numero}
            {letra(numero)}
          </span>
        </div>
        {repetida && <p className="mt-1.5 text-xs font-semibold text-aviso">Ya hay una toma {numero} en esta escena. Cambia el número si es otra.</p>}
        {!editando && enElTope && reglas.max !== null && (
          <p className="mt-1.5 text-xs font-semibold text-rojo">
            Ya tienes {planos.length} de {reglas.max} planos. Esta toma pasa el tope del ejercicio.
          </p>
        )}
      </div>

      <div>
        {paso(3, "Tu toma")}
        <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-2xl border-2 border-tinta/80 bg-tinta/[0.04]">
          {fotoActual ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoActual} alt={`Vista previa de la toma ${numero}`} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center px-6 text-center text-sm text-muted">Párate donde va la cámara y toma la foto como se vería el cuadro.</span>
          )}
          <span className="cifra absolute left-2 top-2 rounded-md bg-fondo/90 px-1.5 py-0.5 text-xs font-bold text-tinta">
            {escena.numero}
            {letra(numero)}
          </span>
          {preparando && <span className="absolute inset-0 grid place-items-center bg-fondo/60 text-sm font-semibold">Preparando foto…</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => camara.current?.click()} disabled={preparando} className="btn-rojo">
            {fotoActual ? "Tomar otra foto" : "Tomar foto"}
          </button>
          <button type="button" onClick={() => galeria.current?.click()} disabled={preparando} className="btn-secundario">
            De la galería
          </button>
          {foto && (
            <button type="button" onClick={() => setFoto(null)} className="btn-secundario">
              Quitar foto nueva
            </button>
          )}
        </div>
        <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; elegirFoto(f); }} />
        <input ref={galeria} type="file" accept="image/*" className="hidden" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; elegirFoto(f); }} />
      </div>

      <div>
        {paso(4, "Tamaño")}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
          {TAMANOS.map((t) => (
            <button
              key={t.v}
              type="button"
              aria-pressed={tamano === t.v}
              onClick={() => setTamano(t.v)}
              className={`min-h-14 rounded-2xl px-2 py-2 text-left transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo ${tamano === t.v ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-tinta hover:bg-tinta/[0.1]"}`}
            >
              <span className="cifra block text-sm font-bold">{t.v}</span>
              <span className={`block text-[10px] leading-tight ${tamano === t.v ? "text-fondo/80" : "text-muted"}`}>{t.t}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        {paso(5, "Ángulo")}
        <div className="flex flex-wrap gap-1.5">
          {ANGULOS.map((a) => (
            <Chip key={a} activo={angulo === a} onClick={() => setAngulo((x) => (x === a ? null : a))}>
              {a}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        {paso(6, "Movimiento")}
        <div className="flex flex-wrap gap-1.5">
          {MOVIMIENTOS.map((m) => (
            <Chip key={m} activo={movimiento === m} rojo={prohibido(m)} titulo={prohibido(m) ? "No permitido en este ejercicio" : undefined} onClick={() => setMovimiento((x) => (x === m ? null : m))}>
              {m}
            </Chip>
          ))}
        </div>
        {movimiento && prohibido(movimiento) && (
          <p className="mt-1.5 text-xs font-semibold text-rojo">
            {movimiento} no vale en este ejercicio. Solo: {reglas.permitidos!.join(", ")}.
          </p>
        )}
      </div>

      <div>
        {paso(7, "Acción")}
        <textarea
          value={accion}
          onChange={(e) => setAccion(e.target.value)}
          maxLength={400}
          rows={2}
          placeholder="Qué pasa en la toma. Ej. Juan entra y deja las llaves"
          aria-label="Acción"
          className="campo resize-none text-sm"
        />
        <p className="cifra mt-1 text-right text-[11px] text-muted">{accion.length}/400</p>
      </div>

      {error && <p className="alerta-error" role="alert">{error}</p>}
      {listo && <p className="text-sm font-semibold text-ok" role="status">{listo} Sigue la {numero}.</p>}
      <button type="submit" disabled={guardando || preparando} className="btn-primario w-full sm:w-auto">
        {guardando ? "Guardando…" : editando ? "Guardar cambios" : `Guardar toma ${Number.isFinite(numero) ? numero : ""}`}
      </button>
    </form>
  );
}
