"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { agregarRecordatorio, cancelarRecordatorio } from "@/app/app/tareas/acciones";

type Rec = { id: string; cuando: string; enviado_at: string | null };

const formato = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Avisos push extra para una tarea (además del día que vence). Va dentro de la hoja de editar.
export function RecordatoriosTarea({ tareaId, abierto }: { tareaId: string; abierto: boolean }) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [cuando, setCuando] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cargar = useCallback(async () => {
    const { data } = await createClient().from("recordatorios").select("id, cuando, enviado_at").eq("tarea_id", tareaId).order("cuando");
    setRecs((data ?? []) as Rec[]);
  }, [tareaId]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  const proximos = recs.filter((r) => !r.enviado_at);

  return (
    <fieldset>
      <legend className="etiqueta">Recordatorios</legend>
      {proximos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {proximos.map((r) => (
            <li key={r.id} className="flex items-center gap-1 rounded-full bg-tinta/[0.06] py-1 pl-3 pr-1 text-xs">
              <span aria-hidden="true">🔔</span>
              <span className="cifra capitalize">{formato(r.cuando)}</span>
              <button
                type="button"
                aria-label={`Cancelar recordatorio de ${formato(r.cuando)}`}
                onClick={() =>
                  iniciar(async () => {
                    await cancelarRecordatorio(r.id);
                    await cargar();
                  })
                }
                className="grid h-6 w-6 place-items-center rounded-full text-muted hover:text-tinta"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} aria-label="Día y hora del recordatorio" className="campo min-w-0 flex-1 rounded-full py-2 font-mono text-sm" />
        <button
          type="button"
          disabled={!cuando || pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await agregarRecordatorio(tareaId, cuando);
              setError(r.ok ? null : r.error ?? "No se guardó.");
              if (r.ok) {
                setCuando("");
                await cargar();
              }
            })
          }
          className="btn-secundario px-4"
        >
          + Aviso
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-acento">{error}</p>}
    </fieldset>
  );
}
