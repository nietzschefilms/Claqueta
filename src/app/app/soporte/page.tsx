import type { Metadata } from "next";
import { requerirSoporte } from "@/lib/sesion";
import { ROLES } from "@/config/marca";
import { buscarCuentas } from "./acciones";
import { PanelSoporte } from "./PanelSoporte";
import { Encabezado } from "@/components/Encabezado";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Soporte" };

export default async function Soporte() {
  const s = await requerirSoporte();
  const { cuentas } = await buscarCuentas("");
  // Invitaciones preparadas (frentes, horario, equipo) que aún no tienen cuenta.
  const { data: inv } = await createAdminClient().from("invitaciones").select("correo, nombre, frentes").is("aplicada_en", null).order("creado_en");
  const invitaciones = (inv ?? []) as { correo: string; nombre: string | null; frentes: string[] | null }[];
  const roles = Object.entries(ROLES).map(([clave, v]) => ({ clave, label: v.label }));

  return (
    <div className="space-y-5">
      <Encabezado etiqueta="Cuentas y accesos" titulo="Soporte" />
      <p className="-mt-2 text-sm text-muted">Crea cuentas, resetea accesos y asigna roles. Nadie se borra: se desactiva.</p>
      <PanelSoporte inicial={cuentas} roles={roles} yo={s.userId} invitaciones={invitaciones} />
    </div>
  );
}
