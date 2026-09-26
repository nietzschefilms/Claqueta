import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { prefsDe } from "@/lib/notif-prefs";
import { PushActivar } from "@/components/PushActivar";
import { BotonSalir } from "@/components/BotonSalir";
import { FormPerfil, PrefsNotif } from "./Formularios";
import Link from "next/link";
import { Encabezado } from "@/components/Encabezado";

export const metadata: Metadata = { title: "Ajustes" };

export default async function Ajustes() {
  const s = await requerirSesion();
  const { data: p } = await createAdminClient().from("perfiles").select("nombre, telefono, notif_prefs").eq("id", s.userId).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Encabezado etiqueta="Tu cuenta" titulo="Ajustes" />

      <section className="tarjeta space-y-3">
        <h2 className="titulo text-2xl">Tus datos</h2>
        <p className="text-sm text-muted">{s.email}</p>
        <FormPerfil nombre={(p?.nombre as string) ?? ""} telefono={(p?.telefono as string) ?? ""} />
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="titulo text-2xl">Notificaciones</h2>
        <PushActivar />
        <PrefsNotif inicial={prefsDe(p?.notif_prefs)} />
      </section>

      {s.esSoporte && (
        <Link href="/app/soporte" className="tarjeta flex items-center justify-between gap-3 transition hover:bg-superficie/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo md:hidden">
          <span>
            <span className="titulo block text-2xl">Soporte</span>
            <span className="text-sm text-muted">Cuentas, accesos y roles.</span>
          </span>
          <span aria-hidden="true" className="text-xl text-muted">→</span>
        </Link>
      )}

      <section className="tarjeta flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="titulo text-2xl">Sesión</h2>
          <p className="text-sm text-muted">Para cambiar tu contraseña, sal y usa ¿Olvidaste tu contraseña?</p>
        </div>
        <BotonSalir />
      </section>
    </div>
  );
}
