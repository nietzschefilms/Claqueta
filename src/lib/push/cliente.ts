// Suscripción push de ESTE dispositivo (lado del navegador).
const CLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSoportado() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!CLAVE;
}

// En iPhone solo hay push con la app instalada en la pantalla de inicio.
export function esAppInstalada() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

async function guardar(sub: PushSubscription) {
  const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
  if (!r.ok) throw new Error("no se guardó");
}

// Pide permiso (si hace falta), crea la suscripción y la guarda en el servidor.
export async function suscribir(): Promise<"activo" | "bloqueado" | "inactivo"> {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso === "denied" ? "bloqueado" : "inactivo";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToUint8(CLAVE as string) }));
  await guardar(sub);
  return "activo";
}

// Al abrir la app: si ya hay suscripción, la vuelve a guardar (por si cambió o
// el servidor la perdió). Devuelve si este dispositivo recibe avisos.
export async function confirmarSuscripcion(): Promise<boolean> {
  if (!pushSoportado() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;
  await guardar(sub).catch(() => {});
  return true;
}
