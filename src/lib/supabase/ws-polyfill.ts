import "server-only";
import WebSocket from "ws";

// La libreria de Supabase (realtime) pide un WebSocket nativo, que Node 22
// trae de fabrica pero Node 20 no. Aqui se lo damos, solo en el servidor,
// para que funcione igual en local con Node 20 y en Vercel.
// Aunque no uses realtime, el cliente se construye de todos modos.
const g = globalThis as unknown as { WebSocket?: unknown };
if (typeof g.WebSocket === "undefined") {
  g.WebSocket = WebSocket;
}
