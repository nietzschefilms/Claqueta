"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearProyecto, type Resultado } from "../acciones";

const TIPOS = [
  { v: "spot", t: "Spot" },
  { v: "corto", t: "Corto" },
  { v: "videoclip", t: "Videoclip" },
  { v: "documental", t: "Documental" },
  { v: "serie", t: "Serie" },
  { v: "otro", t: "Otro" }
];

export function NuevoProyecto({ equipoId, prospectos }: { equipoId: string; prospectos: { id: string; nombre: string }[] }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(crearProyecto, null);
  const [tipo, setTipo] = useState("spot");
  const router = useRouter();
  useEffect(() => {
    if (estado?.ok && estado.id) router.push(`/app/estudio/proyectos/${estado.id}`);
  }, [estado, router]);

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="equipo_id" value={equipoId} />
      <input type="hidden" name="tipo" value={tipo} />
      <input name="nombre" required maxLength={100} autoComplete="off" placeholder="Nombre, ej. Spot Bribona" aria-label="Nombre del proyecto" className="campo rounded-full py-2.5 text-sm" />
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.v}
            type="button"
            aria-pressed={tipo === t.v}
            onClick={() => setTipo(t.v)}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${tipo === t.v ? "bg-tinta text-fondo" : "bg-tinta/[0.06] text-muted hover:text-tinta"}`}
          >
            {t.t}
          </button>
        ))}
      </div>
      <input name="cliente" maxLength={100} autoComplete="off" placeholder="Cliente (opcional)" aria-label="Cliente" className="campo rounded-full py-2.5 text-sm" />
      {prospectos.length > 0 && (
        <select name="prospecto_id" defaultValue="" aria-label="Viene del Radar" className="campo rounded-full py-2.5 text-sm">
          <option value="">¿Viene del Radar? (opcional)</option>
          {prospectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      )}
      {estado?.error && <p className="alerta-error" role="alert">{estado.error}</p>}
      <button type="submit" disabled={enviando} className="btn-rojo w-full py-3">
        {enviando ? "Creando…" : "Crear y abrir guion"}
      </button>
    </form>
  );
}
