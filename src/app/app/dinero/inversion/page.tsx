import Link from "next/link";
import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { cargarDinero, cargarPerfil } from "@/lib/claqueta/datos";
import { fechaCDMX } from "@/lib/claqueta/fechas";
import { aCentavos, avanceContrato } from "@/lib/claqueta/dinero";
import { estimadoMes } from "@/lib/claqueta/impuestos";
import { fondoInversion, semaforo, type Semaforo } from "@/lib/claqueta/inversion";
import { Encabezado } from "@/components/Encabezado";
import { Inversion, type Item } from "./Inversion";

export const metadata: Metadata = { title: "Inversión Nietzsche" };

// INVERSIÓN NIETZSCHE · la lista de equipo de la productora y el fondo (EK) que la paga.
export default async function PaginaInversion() {
  const s = await requerirSesion();
  const perfil = await cargarPerfil(s.userId);
  const hoy = fechaCDMX();
  const supabase = await createClient();
  const [{ pagos, contratos, cuentas }, itemsR, ajustesR] = await Promise.all([
    cargarDinero(),
    supabase
      .from("inversion_items")
      .select("id, nombre, categoria, precio, cantidad, prioridad, retorno, rentable, link, tienda, nota, estado, precio_real, comprado_en, orden")
      .order("prioridad")
      .order("orden"),
    supabase.from("inversion_ajustes").select("contrato_id, ya_gastado, reserva_pct, iva_aparte").maybeSingle()
  ]);
  if (itemsR.error) throw new Error(`No se pudo leer la lista: ${itemsR.error.message}`);
  const items = (itemsR.data ?? []) as Item[];
  const ajustes = ajustesR.data ?? { contrato_id: null, ya_gastado: "0", reserva_pct: "10", iva_aparte: false };

  const contrato = contratos.find((c) => c.id === ajustes.contrato_id) ?? contratos[0] ?? null;
  const resico = perfil.resicoDesde ?? undefined;
  const abonos = contrato ? pagos.filter((p) => p.contract_id === contrato.id).map((p) => ({ centavos: aCentavos(p.amount) ?? 0, mes: p.date.slice(0, 7) })) : [];
  const baseDelMes = new Map([...new Set(abonos.map((a) => a.mes))].map((m) => [m, estimadoMes(pagos, m, resico).base]));
  const avance = contrato ? avanceContrato(contrato, pagos, hoy) : null;
  const invertido = items.filter((i) => i.estado === "comprado").reduce((a, i) => a + (aCentavos(i.precio_real ?? 0) ?? 0), 0);

  const fondo = fondoInversion({
    abonos,
    total: contrato ? aCentavos(contrato.total) ?? 0 : 0,
    yaGastado: aCentavos(ajustes.ya_gastado) ?? 0,
    reservaPct: Number(ajustes.reserva_pct),
    ivaAparte: !!ajustes.iva_aparte,
    invertido,
    mesesRestantes: avance?.mesesRestantes ?? null,
    baseDelMes
  });
  const sem: Record<string, Semaforo> = Object.fromEntries(semaforo(items, fondo, hoy));

  return (
    <div className="space-y-6">
      <Encabezado etiqueta="Dinero · productora" titulo="Inversión Nietzsche">
        <Link href="/app/dinero" className="btn-secundario">
          <span aria-hidden="true">←</span> Dinero
        </Link>
      </Encabezado>
      <Inversion
        items={items}
        semaforo={sem}
        fondo={fondo}
        ajustes={{ ya_gastado: String(ajustes.ya_gastado), reserva_pct: String(ajustes.reserva_pct), iva_aparte: !!ajustes.iva_aparte }}
        cuentas={cuentas.filter((c) => ["debito", "efectivo", "credito"].includes(c.tipo)).map((c) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo }))}
        resico={!!perfil.resicoDesde}
        hoy={hoy}
        contrato={contrato?.client ?? null}
      />
    </div>
  );
}
