import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { prefsDe } from "@/lib/notif-prefs";
import { PushActivar } from "@/components/PushActivar";
import { BotonSalir } from "@/components/BotonSalir";
import { FormPerfil, PrefsNotif } from "./Formularios";

export const metadata: Metadata = { title: "Ajustes" };

export default async function Ajustes() {
  const s = await requerirSesion();
  const { data: p } = await createAdminClient().from("perfiles").select("nombre, telefono, notif_prefs").eq("id", s.userId).maybeSingle();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Ajustes</h1>

      <section className="tarjeta space-y-3">
        <h2 className="font-display text-lg font-semibold">Tus datos</h2>
        <p className="text-sm text-muted">{s.email}</p>
        <FormPerfil nombre={(p?.nombre as string) ?? ""} telefono={(p?.telefono as string) ?? ""} />
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="font-display text-lg font-semibold">Notificaciones</h2>
        <PushActivar />
        <PrefsNotif inicial={prefsDe(p?.notif_prefs)} />
      </section>

      <section className="tarjeta flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Sesión</h2>
          <p className="text-sm text-muted">Para cambiar tu contraseña, sal y usa ¿Olvidaste tu contraseña?</p>
        </div>
        <BotonSalir />
      </section>
    </div>
  );
}
