import type { Metadata } from "next";
import { requerirSesion } from "@/lib/sesion";
import { cargarPerfil } from "@/lib/claqueta/datos";
import { cargarProspectos } from "@/lib/claqueta/datos-estudio";
import { fechaCDMX } from "@/lib/claqueta/fechas";
import { Radar } from "./Radar";

export const metadata: Metadata = { title: "Radar de spots" };

// RADAR · negocios recién abiertos sin video propio: a quién llamar, a quién ver en Instagram.
export default async function PaginaRadar() {
  const s = await requerirSesion();
  const perfil = await cargarPerfil(s.userId);
  const equipo = perfil.equipos.find((e) => e.frente === "nietzsche") ?? perfil.equipos[0];
  if (!equipo) return null;
  const prospectos = await cargarProspectos();
  const miembros = [{ id: s.userId, nombre: perfil.nombre || s.nombre || "Tú" }, ...perfil.companeros.filter((c) => c.equipo_id === equipo.id)];

  return (
    <div className="space-y-5">
      <details className="tarjeta aparecer group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="titulo block text-2xl">Cómo venderlo</span>
            <span className="text-sm text-muted">Spot de $14,000 · un día de rodaje · entrega en una semana</span>
          </span>
          <span className="text-muted transition group-open:rotate-90">›</span>
        </summary>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Ya vienen verificados", "Cada negocio se revisó: sin video propio en TikTok, YouTube ni prensa. Échale un ojo final a su IG; si ya tiene buen video, a Descartado y siguiente."],
            ["DM o ir a comer el mismo día", "Con restaurantes y bares el canal es DM de Instagram o presentarse y pedir al gerente. Con hoteles sí funciona el correo. Un DM corto con un reel de muestra vale más que una carta."],
            ["Precio cerrado, rápido", "$14,000: un día de rodaje, spot principal y cortes para reels y pauta. Es su semana de apertura: deciden rápido, no mandes cotizaciones eternas."]
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-tinta/[0.04] p-4">
              <span className="cifra text-xs text-acento">0{i + 1}</span>
              <p className="mt-1 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">Regla del Radar: nada de datos inventados. Si falta el correo o el dueño, se consigue en persona o por DM.</p>
      </details>
      <Radar inicial={prospectos} miembros={miembros} yo={s.userId} equipoId={equipo.id} hoy={fechaCDMX()} />
    </div>
  );
}
