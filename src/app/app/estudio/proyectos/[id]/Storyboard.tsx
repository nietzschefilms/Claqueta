"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ponerImagenPlano } from "../../acciones";
import { escenasDe, type Linea } from "@/lib/claqueta/estudio";
import type { Plano } from "@/lib/claqueta/datos-estudio";

const letra = (n: number) => String.fromCharCode(64 + Math.min(Math.max(n, 1), 26));

// Foto o dibujo → JPG de máximo 1600 px (pesa poco en datos del celular).
async function comprimir(archivo: File): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error("No pude leer esa imagen."));
      i.src = url;
    });
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) throw new Error("No pude convertir la imagen.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// STORYBOARD · un cuadro por plano, en el orden del guion. Se imprime como PDF.
export function Storyboard({ proyectoId, nombre, lineas, planos }: { proyectoId: string; nombre: string; lineas: Linea[]; planos: Plano[] }) {
  const escenas = useMemo(() => escenasDe(lineas), [lineas]);
  const conPlanos = escenas.filter((e) => planos.some((p) => p.escena_id === e.id));
  const cuadros = planos.filter((p) => p.imagen).length;

  if (!planos.length) return <p className="tarjeta text-sm text-muted">Primero arma la lista de planos (pestaña Planos). Cada plano se vuelve un cuadro del storyboard.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">
          {cuadros} de {planos.length} cuadros. Toca un cuadro para tomar foto, subir un dibujo o una referencia.
        </p>
        <button type="button" onClick={() => window.print()} className="btn-secundario">
          Imprimir / PDF
        </button>
      </div>
      <div className="imprimible space-y-8">
        <p className="titulo hidden text-3xl print:block">{nombre} · Storyboard</p>
        {conPlanos.map((e) => (
          <section key={e.id} className="break-inside-avoid">
            <h3 className="mb-3 font-mono text-sm font-bold uppercase">
              {e.numero}. {e.texto}
            </h3>
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
              {planos
                .filter((p) => p.escena_id === e.id)
                .sort((a, b) => a.orden - b.orden)
                .map((p) => (
                  <Cuadro key={p.id} proyectoId={proyectoId} p={p} etiqueta={`${e.numero}${letra(p.numero)}`} />
                ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function Cuadro({ proyectoId, p, etiqueta }: { proyectoId: string; p: Plano; etiqueta: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [estado, setEstado] = useState<"listo" | "subiendo" | "error">("listo");
  const [error, setError] = useState<string | null>(null);
  const src = vista ?? p.imagenUrl ?? null;

  const subir = async (archivo: File) => {
    setEstado("subiendo");
    setError(null);
    try {
      const blob = await comprimir(archivo);
      setVista(URL.createObjectURL(blob));
      const ruta = `${proyectoId}/${p.id}-${Date.now()}.jpg`;
      const { error: e } = await createClient().storage.from("storyboard").upload(ruta, blob, { contentType: "image/jpeg", upsert: false });
      if (e) throw new Error("No se subió la imagen. Revisa tu conexión.");
      const r = await ponerImagenPlano(proyectoId, p.id, ruta);
      if (!r.ok) throw new Error(r.error ?? "No se guardó la imagen.");
      setEstado("listo");
      router.refresh();
    } catch (err) {
      setEstado("error");
      setVista(null);
      setError(err instanceof Error ? err.message : "No se pudo subir.");
    }
  };

  return (
    <li className="break-inside-avoid">
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        aria-label={src ? `Cambiar cuadro del plano ${etiqueta}` : `Agregar cuadro al plano ${etiqueta}`}
        className="group relative block aspect-video w-full overflow-hidden rounded-2xl border-2 border-tinta/80 bg-tinta/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo print:rounded-none"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Cuadro ${etiqueta}: ${p.descripcion}`} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-center text-xs text-muted">
            <span>
              <span className="block text-3xl font-light">+</span>
              Foto, dibujo o referencia
            </span>
          </span>
        )}
        <span className="cifra absolute left-2 top-2 rounded-md bg-fondo/90 px-1.5 py-0.5 text-xs font-bold text-tinta">{etiqueta}</span>
        {p.filmado && <span className="absolute right-2 top-2 rounded-md bg-rojo px-1.5 py-0.5 text-[10px] font-bold text-white">FILMADO</span>}
        {estado === "subiendo" && <span className="absolute inset-0 grid place-items-center bg-fondo/60 text-sm font-semibold">Subiendo…</span>}
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = "";
          if (f) subir(f);
        }}
      />
      <p className="mt-2 text-xs">
        <span className="cifra font-semibold">{[p.tamano, p.movimiento, p.lente].filter(Boolean).join(" · ") || "Sin datos de cámara"}</span>
      </p>
      {p.descripcion && <p className="text-sm leading-snug">{p.descripcion}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-acento">{error}</p>}
    </li>
  );
}
