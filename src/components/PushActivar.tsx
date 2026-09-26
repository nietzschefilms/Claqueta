"use client";

import { useEffect, useState } from "react";
import { enviarPushPrueba } from "@/app/app/ajustes/acciones";
import { suscribir } from "@/lib/push/cliente";

const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Estado = "cargando" | "no-soportado" | "sin-clave" | "bloqueado" | "activo" | "inactivo" | "ocupado";

// Activar / desactivar notificaciones push en ESTE dispositivo.
// En iPhone solo funciona con la app instalada en la pantalla de inicio.
export function PushActivar() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setEstado("no-soportado");
      return;
    }
    if (!CLAVE) return setEstado("sin-clave");
    if (Notification.permission === "denied") return setEstado("bloqueado");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? "activo" : "inactivo"))
      .catch(() => setEstado("inactivo"));
  }, []);

  async function activar() {
    setEstado("ocupado");
    setMsg("");
    try {
      const r = await suscribir();
      if (r !== "activo") return setEstado(r);
      setEstado("activo");
      setMsg("Listo. Te llegarán los avisos importantes.");
    } catch {
      setEstado("inactivo");
      setMsg("No se pudo activar. Intenta de nuevo.");
    }
  }

  async function desactivar() {
    setEstado("ocupado");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setEstado("inactivo");
      setMsg("");
    } catch {
      setEstado("activo");
    }
  }

  if (estado === "cargando") return null;
  if (estado === "no-soportado")
    return <p className="text-sm text-muted">Este navegador no recibe notificaciones. En iPhone, instala la app en tu pantalla de inicio y ábrela desde ahí.</p>;
  if (estado === "sin-clave") return <p className="text-sm text-muted">Las notificaciones aún no están configuradas en esta app.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {estado === "activo" ? (
          <>
            <span className="text-sm font-semibold text-ok">Activadas en este dispositivo</span>
            <button
              onClick={async () => {
                setMsg("Enviando prueba...");
                const r = await enviarPushPrueba();
                setMsg(r.enviadas > 0 ? "Prueba enviada. Revisa tu notificación." : "No llegó. Desactiva y vuelve a activar.");
              }}
              className="btn-secundario"
            >
              Enviar prueba
            </button>
            <button onClick={desactivar} className="btn-secundario">Desactivar</button>
          </>
        ) : (
          <button onClick={activar} disabled={estado === "ocupado" || estado === "bloqueado"} className="btn-primario">
            {estado === "ocupado" ? "Un momento..." : "Activar notificaciones"}
          </button>
        )}
      </div>
      {estado === "bloqueado" && <p className="mt-2 text-sm text-muted">Están bloqueadas en tu navegador. Actívalas en los ajustes del sitio.</p>}
      {msg && <p className="mt-2 text-sm text-muted" role="status">{msg}</p>}
    </div>
  );
}
