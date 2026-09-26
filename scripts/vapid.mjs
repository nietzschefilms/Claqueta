// Genera las llaves VAPID para las notificaciones push.
// Uso: npm run vapid  → copia las dos líneas a .env.local y a Vercel.
import webpush from "web-push";
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
