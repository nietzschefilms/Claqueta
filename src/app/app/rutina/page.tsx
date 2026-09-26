import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarRutina } from "@/lib/claqueta/datos";
import { diaSemana, fechaCDMX, horaAMinutos, minutosAHora } from "@/lib/claqueta/fechas";
import { Encabezado } from "@/components/Encabezado";
import { EditorBloque } from "./EditorBloque";

export const metadata: Metadata = { title: "Rutina" };

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];
const hhmm = (t: string) => minutosAHora(horaAMinutos(t));

// RUTINA · los bloques de cada día. Toca uno para cambiarlo.
export default async function Rutina({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  await requerirSesion();
  const { dia } = await searchParams;
  const hoy = diaSemana(fechaCDMX());
  const elegido = dia !== undefined && /^[0-6]$/.test(dia) ? Number(dia) : hoy;
  const rutina = await cargarRutina();
  const bloques = rutina.filter((b) => b.weekday === elegido).sort((a, b) => horaAMinutos(a.start_time) - horaAMinutos(b.start_time));
  const ultimo = bloques.at(-1);
  const sugerencia = ultimo ? hhmm(ultimo.end_time) : "09:00";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Encabezado etiqueta="Tu semana tipo" titulo="Rutina">
        <Link href="/app/semana" className="btn-secundario"><span aria-hidden="true">←</span> Semana</Link>
      </Encabezado>

      <nav aria-label="Elegir día" className="vidrio grid grid-cols-7 gap-1 rounded-full p-1">
        {ORDEN.map((d) => (
          <Link
            key={d}
            href={`/app/rutina?dia=${d}`}
            aria-current={d === elegido ? "page" : undefined}
            className={`rounded-full py-2 text-center text-xs font-semibold transition ${d === elegido ? "bg-tinta text-fondo" : "text-muted hover:text-tinta"} ${d === hoy && d !== elegido ? "text-acento" : ""}`}
          >
            {DIAS[d]}
          </Link>
        ))}
      </nav>

      <section aria-label={`Bloques del ${DIAS[elegido]}`} className="tarjeta space-y-1.5 p-3">
        {bloques.length === 0 && <p className="px-2 py-3 text-sm text-muted">Sin bloques este día.</p>}
        {bloques.map((b) => (
          <EditorBloque
            key={`${b.id}-${b.start_time}-${b.end_time}-${b.label}-${b.areas.join()}`}
            b={{ id: b.id, weekday: b.weekday, inicio: hhmm(b.start_time), fin: hhmm(b.end_time), label: b.label, kind: b.kind, areas: b.areas, salon: b.salon }}
          />
        ))}
        <EditorBloque
          key={`nuevo-${elegido}-${bloques.length}`}
          nuevo
          b={{ weekday: elegido, inicio: sugerencia, fin: minutosAHora(Math.min(23 * 60 + 59, horaAMinutos(sugerencia) + 60)), label: "", kind: "focus", areas: [] }}
        />
      </section>
      <p className="text-center text-xs text-muted">Los cambios aplican a todas las semanas. Hoy y los avisos se actualizan al momento.</p>
    </div>
  );
}
