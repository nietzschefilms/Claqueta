import type { Metadata } from "next";
import { requerirSoporte } from "@/lib/sesion";
import { ROLES } from "@/config/marca";
import { buscarCuentas } from "./acciones";
import { PanelSoporte } from "./PanelSoporte";

export const metadata: Metadata = { title: "Soporte" };

export default async function Soporte() {
  const s = await requerirSoporte();
  const { cuentas } = await buscarCuentas("");
  const roles = Object.entries(ROLES).map(([clave, v]) => ({ clave, label: v.label }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Soporte</h1>
        <p className="mt-1 text-sm text-muted">Crea cuentas, resetea accesos y asigna roles. Nadie se borra: se desactiva.</p>
      </div>
      <PanelSoporte inicial={cuentas} roles={roles} yo={s.userId} />
    </div>
  );
}
