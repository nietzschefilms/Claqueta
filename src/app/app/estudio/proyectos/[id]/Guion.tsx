"use client";

import { Courier_Prime } from "next/font/google";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { aFountain, escenasDe, NOMBRE_TIPO, nombrePersonaje, ordenEntre, paginas, pareceEscena, resumenGuion, rotarTipo, SIGUIENTE, type Linea, type TipoLinea } from "@/lib/claqueta/estudio";
import { importarFountain, renumerarGuion } from "../../acciones";

const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

type Presente = { user: string; nombre: string; linea: string | null; escribiendo: boolean };

// Cada tipo con su lugar en la página, como en Final Draft.
const ESTILO: Record<TipoLinea, string> = {
  escena: "mt-7 font-bold uppercase",
  accion: "mt-3",
  personaje: "mt-4 uppercase md:ml-[37%] ml-[28%] w-auto",
  parentesis: "md:ml-[30%] ml-[20%] md:w-[40%] italic",
  dialogo: "md:ml-[20%] ml-[12%] md:w-[60%] w-[80%]",
  transicion: "mt-4 uppercase text-right",
  nota: "mt-3 rounded-lg bg-aviso/10 px-2 text-[0.85em] italic text-muted"
};

const ATAJOS: TipoLinea[] = ["escena", "accion", "personaje", "parentesis", "dialogo", "transicion", "nota"];
const COLORES = ["#FF0000", "#3F7FBF", "#2E9E6A", "#C98A1B"];

// Editor de guion en vivo. Cada elemento es una fila en la base; lo que escribe
// uno le llega al otro al instante (broadcast) y se guarda solo (cada 400 ms).
export function Guion({ proyectoId, nombreProyecto, inicial, yo, miembros }: { proyectoId: string; nombreProyecto: string; inicial: Linea[]; yo: string; miembros: { id: string; nombre: string }[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [lineas, setLineas] = useState<Linea[]>(() => [...inicial].sort((a, b) => a.orden - b.orden));
  const [foco, setFoco] = useState<string | null>(null);
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [guardado, setGuardado] = useState<"ok" | "guardando" | "error">("ok");
  const [importar, setImportar] = useState(false);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const pendientes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const canal = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cursorPendiente = useRef<{ id: string; pos: number } | null>(null);
  const focoRef = useRef<string | null>(null);
  focoRef.current = foco;
  const miNombre = miembros.find((m) => m.id === yo)?.nombre.split(" ")[0] ?? "Yo";
  const color = (user: string) => COLORES[Math.max(0, miembros.findIndex((m) => m.id === user)) % COLORES.length];

  // ─── Tiempo real ─────────────────────────────────────────────────────
  const aplicarRemota = useCallback((l: Partial<Linea> & { id: string; borrado?: boolean }) => {
    setLineas((ls) => {
      if (l.borrado) return ls.filter((x) => x.id !== l.id);
      const i = ls.findIndex((x) => x.id === l.id);
      if (i < 0) {
        if (l.orden === undefined || l.tipo === undefined) return ls;
        return [...ls, { id: l.id, orden: l.orden, tipo: l.tipo, texto: l.texto ?? "" }].sort((a, b) => a.orden - b.orden);
      }
      // No piso lo que estoy escribiendo yo en esa misma línea.
      if (focoRef.current === l.id && pendientes.current.has(l.id)) return ls;
      const n = [...ls];
      n[i] = { ...n[i], ...(l.texto !== undefined ? { texto: l.texto } : {}), ...(l.tipo ? { tipo: l.tipo } : {}), ...(l.orden !== undefined ? { orden: l.orden } : {}) };
      return n.sort((a, b) => a.orden - b.orden);
    });
  }, []);

  useEffect(() => {
    const ch = supabase.channel(`guion:${proyectoId}`, { config: { presence: { key: yo }, broadcast: { self: false } } });
    ch.on("broadcast", { event: "linea" }, ({ payload }) => aplicarRemota(payload as Linea & { borrado?: boolean }))
      .on("postgres_changes", { event: "*", schema: "public", table: "guion_lineas", filter: `proyecto_id=eq.${proyectoId}` }, (p) => {
        const n = p.new as (Linea & { borrado_at: string | null; editado_por: string | null }) | undefined;
        if (!n?.id || n.editado_por === yo) return;
        aplicarRemota({ id: n.id, orden: n.orden, tipo: n.tipo, texto: n.texto, borrado: !!n.borrado_at });
      })
      .on("presence", { event: "sync" }, () => {
        const estado = ch.presenceState<Presente>();
        setPresentes(Object.values(estado).flatMap((v) => v.slice(0, 1)).filter((p) => p.user !== yo));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ user: yo, nombre: miNombre, linea: focoRef.current, escribiendo: false });
      });
    canal.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, proyectoId, yo, miNombre, aplicarRemota]);

  const anunciar = (linea: string | null, escribiendo: boolean) => canal.current?.track({ user: yo, nombre: miNombre, linea, escribiendo }).catch(() => {});

  // ─── Guardado ────────────────────────────────────────────────────────
  // Cambios pendientes por línea: se juntan (tipo + texto) y se mandan juntos.
  const porGuardar = useRef(new Map<string, Partial<Linea>>());
  // Líneas recién creadas: sus cambios esperan a que exista la fila.
  const creando = useRef(new Map<string, PromiseLike<unknown>>());
  const guardar = (id: string, cambios: Partial<Linea>) => {
    const previo = pendientes.current.get(id);
    if (previo) clearTimeout(previo);
    porGuardar.current.set(id, { ...(porGuardar.current.get(id) ?? {}), ...cambios });
    setGuardado("guardando");
    pendientes.current.set(
      id,
      setTimeout(async () => {
        await creando.current.get(id);
        const datos = porGuardar.current.get(id) ?? {};
        porGuardar.current.delete(id);
        const { error } = await supabase.from("guion_lineas").update(datos).eq("id", id);
        pendientes.current.delete(id);
        setGuardado(error ? "error" : pendientes.current.size ? "guardando" : "ok");
        anunciar(focoRef.current, false);
      }, 400)
    );
  };

  const emitir = (l: Partial<Linea> & { id: string; borrado?: boolean }) => canal.current?.send({ type: "broadcast", event: "linea", payload: l });

  const cambiarTexto = (l: Linea, texto: string) => {
    let tipo = l.tipo;
    if (tipo === "accion" && pareceEscena(texto) && /^(int|ext|i\/e)\.?\s/i.test(texto)) tipo = "escena";
    setLineas((ls) => ls.map((x) => (x.id === l.id ? { ...x, texto, tipo } : x)));
    emitir({ id: l.id, texto, tipo });
    guardar(l.id, tipo !== l.tipo ? { texto, tipo } : { texto });
    anunciar(l.id, true);
  };

  const cambiarTipo = (l: Linea, tipo: TipoLinea) => {
    setLineas((ls) => ls.map((x) => (x.id === l.id ? { ...x, tipo } : x)));
    emitir({ id: l.id, tipo });
    guardar(l.id, { tipo, texto: refs.current.get(l.id)?.value ?? l.texto });
  };

  const insertarDespues = async (l: Linea, tipo: TipoLinea, texto = "") => {
    const i = lineas.findIndex((x) => x.id === l.id);
    const sig = lineas[i + 1];
    let orden = ordenEntre(l.orden, sig?.orden ?? null);
    if (sig && Math.abs(sig.orden - l.orden) < 1e-6) {
      await renumerarGuion(proyectoId);
      const { data } = await supabase.from("guion_lineas").select("id, orden, tipo, texto").eq("proyecto_id", proyectoId).is("borrado_at", null).order("orden");
      const nuevas = (data ?? []) as Linea[];
      setLineas(nuevas);
      const j = nuevas.findIndex((x) => x.id === l.id);
      orden = ordenEntre(nuevas[j]?.orden ?? null, nuevas[j + 1]?.orden ?? null);
    }
    const nueva: Linea = { id: crypto.randomUUID(), orden, tipo, texto };
    setLineas((ls) => [...ls, nueva].sort((a, b) => a.orden - b.orden));
    cursorPendiente.current = { id: nueva.id, pos: 0 };
    emitir(nueva);
    setGuardado("guardando");
    const alta = supabase.from("guion_lineas").insert({ ...nueva, proyecto_id: proyectoId }).then((r) => r);
    creando.current.set(nueva.id, alta);
    const { error } = await alta;
    creando.current.delete(nueva.id);
    setGuardado(error ? "error" : pendientes.current.size ? "guardando" : "ok");
  };

  const borrar = (l: Linea, enfocar: { id: string; pos: number } | null) => {
    setLineas((ls) => ls.filter((x) => x.id !== l.id));
    cursorPendiente.current = enfocar;
    emitir({ id: l.id, borrado: true });
    const previo = pendientes.current.get(l.id);
    if (previo) clearTimeout(previo);
    pendientes.current.delete(l.id);
    porGuardar.current.delete(l.id);
    Promise.resolve(creando.current.get(l.id))
      .then(() => supabase.from("guion_lineas").update({ borrado_at: new Date().toISOString() }).eq("id", l.id))
      .then(({ error }) => error && setGuardado("error"));
  };

  // Poner el cursor donde toca después de insertar o borrar.
  useLayoutEffect(() => {
    const c = cursorPendiente.current;
    if (!c) return;
    const el = refs.current.get(c.id);
    if (el) {
      el.focus();
      const pos = c.pos < 0 ? el.value.length : c.pos;
      el.setSelectionRange(pos, pos);
      cursorPendiente.current = null;
    }
  });

  // ─── Teclado tipo Final Draft ────────────────────────────────────────
  const tecla = (e: React.KeyboardEvent<HTMLTextAreaElement>, l: Linea) => {
    const el = e.currentTarget;
    const i = lineas.findIndex((x) => x.id === l.id);
    if ((e.metaKey || e.ctrlKey) && /^[1-7]$/.test(e.key)) {
      e.preventDefault();
      cambiarTipo(l, ATAJOS[Number(e.key) - 1]);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      cambiarTipo(l, rotarTipo(l.tipo, e.shiftKey));
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const antes = el.value.slice(0, el.selectionStart);
      const despues = el.value.slice(el.selectionEnd);
      if (!el.value.trim() && l.tipo !== "accion") {
        cambiarTipo(l, "accion");
        return;
      }
      if (despues) {
        cambiarTexto(l, antes);
        insertarDespues(l, l.tipo, despues);
      } else {
        insertarDespues(l, SIGUIENTE[l.tipo]);
      }
      return;
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && i > 0) {
      e.preventDefault();
      const prev = lineas[i - 1];
      if (!el.value) {
        borrar(l, { id: prev.id, pos: -1 });
      } else {
        const pos = prev.texto.length;
        cambiarTexto(prev, prev.texto + el.value);
        borrar(l, { id: prev.id, pos });
      }
      return;
    }
    if (e.key === "ArrowUp" && el.selectionStart === 0 && i > 0) {
      e.preventDefault();
      cursorPendiente.current = { id: lineas[i - 1].id, pos: -1 };
      setFoco(lineas[i - 1].id);
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length && i < lineas.length - 1) {
      e.preventDefault();
      cursorPendiente.current = { id: lineas[i + 1].id, pos: 0 };
      setFoco(lineas[i + 1].id);
    }
  };

  // ─── Derivados ───────────────────────────────────────────────────────
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const numero = useMemo(() => new Map(escenas.map((e) => [e.id, e.numero])), [escenas]);
  const resumen = useMemo(() => resumenGuion(escenas), [escenas]);
  const personajes = resumen.personajes.map((p) => p.nombre);
  const lineaFoco = lineas.find((l) => l.id === foco);
  const sugerencias = lineaFoco?.tipo === "personaje" ? personajes.filter((p) => p !== nombrePersonaje(lineaFoco.texto) && p.startsWith(nombrePersonaje(lineaFoco.texto))).slice(0, 6) : [];
  const quienEn = (id: string) => presentes.filter((p) => p.linea === id);

  const descargar = () => {
    const blob = new Blob([aFountain(lineas, nombreProyecto)], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nombreProyecto.replace(/[^\w\-áéíóúñ ]/gi, "").trim() || "guion"}.fountain`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        {/* Barra: quién está, estado de guardado, exportar */}
        <div className="vidrio sticky top-[60px] z-20 mb-3 flex flex-wrap items-center gap-2 rounded-3xl px-3 py-2 md:top-3 print:hidden">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
            {presentes.length ? (
              presentes.map((p) => (
                <span key={p.user} className="flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: color(p.user) }}>
                  {p.nombre}
                  {p.escribiendo ? " escribiendo…" : " aquí"}
                </span>
              ))
            ) : (
              <span className="text-muted">Solo tú aquí</span>
            )}
          </span>
          <span className={`cifra ml-auto text-[11px] ${guardado === "error" ? "font-semibold text-acento" : "text-muted"}`}>
            {guardado === "ok" ? "Guardado" : guardado === "guardando" ? "Guardando…" : "Sin guardar: revisa tu conexión"}
          </span>
          <button type="button" onClick={() => setImportar((v) => !v)} className="enlace-mono">Importar</button>
          <button type="button" onClick={descargar} className="enlace-mono">.fountain</button>
          <button type="button" onClick={() => window.print()} className="enlace-mono">PDF</button>
        </div>

        {importar && <Importar proyectoId={proyectoId} onListo={async () => {
          const { data } = await supabase.from("guion_lineas").select("id, orden, tipo, texto").eq("proyecto_id", proyectoId).is("borrado_at", null).order("orden");
          setLineas((data ?? []) as Linea[]);
          setImportar(false);
        }} />}

        {/* Tipo de la línea actual (en celular no hay Tab) */}
        <div className="sin-barra sticky top-[112px] z-10 -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 md:top-[60px] print:hidden">
          {ATAJOS.map((t, n) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => lineaFoco && cambiarTipo(lineaFoco, t)}
              aria-pressed={lineaFoco?.tipo === t}
              title={`${NOMBRE_TIPO[t]} (Ctrl/⌘ ${n + 1})`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${lineaFoco?.tipo === t ? "bg-tinta text-fondo" : "bg-superficie/80 text-muted hover:text-tinta"}`}
            >
              {NOMBRE_TIPO[t]}
            </button>
          ))}
          {sugerencias.map((p) => (
            <button key={p} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => lineaFoco && cambiarTexto(lineaFoco, p)} className="shrink-0 rounded-full bg-rojo/10 px-3 py-1.5 text-[11px] font-semibold text-acento">
              {p}
            </button>
          ))}
        </div>

        {/* La hoja */}
        <div className={`${courier.className} hoja-guion mx-auto max-w-[8.5in] rounded-2xl bg-[#FBFAF7] px-5 py-8 text-[15px] leading-[1.35] text-[#111] shadow-[0_20px_60px_-30px_rgb(0_0_0/0.5)] md:px-[1in] md:py-[1in] md:text-[16px]`}>
          <p className="mb-8 text-center font-bold uppercase underline">{nombreProyecto}</p>
          {lineas.map((l) => {
            const aqui = quienEn(l.id);
            return (
              <div key={l.id} className={`relative ${ESTILO[l.tipo]}`}>
                {l.tipo === "escena" && <span className="absolute -left-9 top-0 hidden text-[0.85em] text-[#999] md:block">{numero.get(l.id)}</span>}
                {aqui.length > 0 && (
                  <span className="absolute -left-3 top-0 h-full w-1 rounded-full md:-left-5" style={{ background: color(aqui[0].user) }} aria-hidden="true">
                    <span className="absolute -top-4 left-0 whitespace-nowrap rounded px-1 font-sans text-[10px] font-semibold text-white" style={{ background: color(aqui[0].user) }}>
                      {aqui[0].nombre}
                    </span>
                  </span>
                )}
                <div className="flex">
                  {l.tipo === "parentesis" && <span aria-hidden="true">(</span>}
                  <AutoTexto
                    ref={(el) => {
                      if (el) refs.current.set(l.id, el);
                      else refs.current.delete(l.id);
                    }}
                    valor={l.texto}
                    tipo={l.tipo}
                    onCambio={(t) => cambiarTexto(l, l.tipo === "parentesis" ? t.replace(/^\(|\)$/g, "") : t)}
                    onKeyDown={(e) => tecla(e, l)}
                    onFocus={() => {
                      setFoco(l.id);
                      anunciar(l.id, false);
                    }}
                    placeholder={l.tipo === "escena" ? "INT. LUGAR - DÍA" : l.tipo === "personaje" ? "PERSONAJE" : l.tipo === "dialogo" ? "Diálogo" : l.tipo === "accion" && lineas.length <= 2 ? "Escribe la acción. Enter: siguiente elemento · Tab: cambiar tipo" : ""}
                  />
                  {l.tipo === "parentesis" && <span aria-hidden="true">)</span>}
                </div>
              </div>
            );
          })}
          {lineas.length === 0 && (
            <button type="button" onClick={() => insertarDespues({ id: "", orden: 0, tipo: "accion", texto: "" }, "escena")} className="text-[#999] underline">
              Empezar el guion
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-muted print:hidden">
          Enter: siguiente elemento · Tab / Shift+Tab: cambiar tipo · Ctrl/⌘ 1-7: tipo directo · Escribe &quot;INT.&quot; o &quot;EXT.&quot; y se vuelve escena
        </p>
      </div>

      {/* Navegador de escenas y resumen */}
      <aside className="space-y-4 print:hidden xl:sticky xl:top-6 xl:self-start">
        <section className="tarjeta p-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div><dt className="etiqueta">Escenas</dt><dd className="cifra text-xl font-semibold">{resumen.escenas}</dd></div>
            <div><dt className="etiqueta">Páginas</dt><dd className="cifra text-xl font-semibold">{paginas(resumen.octavos) || "0"}</dd></div>
            <div><dt className="etiqueta">≈ Min</dt><dd className="cifra text-xl font-semibold">{resumen.minutos}</dd></div>
          </dl>
        </section>
        <section className="tarjeta p-0">
          <h3 className="etiqueta px-4 pt-4">Escenas</h3>
          <ol className="max-h-[50vh] overflow-y-auto py-2">
            {escenas.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    const el = refs.current.get(e.id);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    el?.focus();
                  }}
                  className={`flex w-full gap-2 px-4 py-1.5 text-left text-xs hover:bg-tinta/[0.05] ${foco && (e.id === foco || e.lineas.some((x) => x.id === foco)) ? "bg-tinta/[0.06] font-semibold" : ""}`}
                >
                  <span className="cifra w-5 shrink-0 text-muted">{e.numero}</span>
                  <span className="min-w-0 flex-1 truncate uppercase">{e.texto || "Escena sin nombre"}</span>
                  <span className="cifra shrink-0 text-muted">{paginas(e.octavos)}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        {resumen.personajes.length > 0 && (
          <section className="tarjeta p-4">
            <h3 className="etiqueta">Personajes</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {resumen.personajes.map((p) => (
                <li key={p.nombre} className="flex justify-between gap-2">
                  <span className="truncate">{p.nombre}</span>
                  <span className="cifra text-xs text-muted">{p.escenas} esc.</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}

// Textarea que crece con el texto (una por elemento del guion).
function AutoTexto({ valor, tipo, onCambio, onKeyDown, onFocus, placeholder, ref }: { valor: string; tipo: TipoLinea; onCambio: (t: string) => void; onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void; onFocus: () => void; placeholder: string; ref: (el: HTMLTextAreaElement | null) => void }) {
  const interno = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = interno.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor, tipo]);
  return (
    <textarea
      ref={(el) => {
        interno.current = el;
        ref(el);
      }}
      value={valor}
      rows={1}
      spellCheck
      onChange={(e) => onCambio(e.target.value.replace(/\n/g, " "))}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      placeholder={placeholder}
      aria-label={NOMBRE_TIPO[tipo]}
      className={`block w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit] outline-none placeholder:text-[#bbb] focus:bg-[#FF0000]/[0.03] ${tipo === "escena" || tipo === "personaje" || tipo === "transicion" ? "uppercase" : ""} ${tipo === "transicion" ? "text-right" : ""}`}
    />
  );
}

function Importar({ proyectoId, onListo }: { proyectoId: string; onListo: () => void }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<{ error?: string; mensaje?: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  return (
    <div className="tarjeta mb-4 space-y-3 print:hidden">
      <p className="text-sm">Pega un guion en Fountain o texto plano (Final Draft, Highland y WriterSolo lo exportan). Se agrega al final.</p>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} className="campo rounded-2xl font-mono text-xs" placeholder={"INT. TAQUERÍA - NOCHE\n\nEl TAQUERO voltea la tortilla.\n\nTAQUERO\n¿Con todo, joven?"} />
      {estado?.error && <p className="alerta-error">{estado.error}</p>}
      {estado?.mensaje && <p className="alerta-ok">{estado.mensaje}</p>}
      <div className="flex gap-2">
        <input
          type="file"
          accept=".fountain,.txt,text/plain"
          aria-label="Archivo de guion"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setTexto(await f.text());
          }}
          className="min-w-0 flex-1 text-xs"
        />
        <button
          type="button"
          disabled={cargando || !texto.trim()}
          onClick={async () => {
            setCargando(true);
            const r = await importarFountain(proyectoId, texto);
            setCargando(false);
            setEstado(r);
            if (r.ok) onListo();
          }}
          className="btn-primario"
        >
          {cargando ? "Importando…" : "Importar"}
        </button>
      </div>
    </div>
  );
}
