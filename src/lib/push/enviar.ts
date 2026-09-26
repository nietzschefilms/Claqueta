import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { MARCA } from "@/config/marca";

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || `mailto:${MARCA.correoSoporte}`;

let configurado = false;
function config() {
  if (configurado) return true;
  if (!PUB || !PRIV) return false;
  webpush.setVapidDetails(SUBJECT, PUB, PRIV);
  configurado = true;
  return true;
}

// Texto CORTO: título breve y una línea de cuerpo (se lee en la pantalla
// bloqueada). `tag` agrupa avisos del mismo tipo para no llenar la pantalla.
export type Aviso = { titulo: string; cuerpo?: string; url?: string; tag?: string };

// Manda un push a todos los dispositivos de una persona.
// Silencioso si push no está configurado o la persona no lo activó.
export async function enviarPush(userId: string, aviso: Aviso) {
  if (!config()) return { ok: false as const, error: "push no configurado", enviadas: 0 };
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_suscripciones")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return { ok: true as const, enviadas: 0 };

  const cuerpo = JSON.stringify(aviso);
  let enviadas = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo);
      enviadas++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      // Suscripción muerta (desinstaló o bloqueó): se limpia para no reintentar.
      if (code === 404 || code === 410) {
        await admin.from("push_suscripciones").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return { ok: true as const, enviadas };
}
