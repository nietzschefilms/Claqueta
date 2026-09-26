// Service worker (heredado de Rompiendo Tabúes).
// Instalación PWA, caché del cascarón y notificaciones push.
// Sube el número de CACHE si cambias qué se precachea.
const CACHE = "app-cache-v2";
// No precacheamos el manifiesto ni los iconos: deben leerse siempre frescos
// para que el ícono y el start_url se actualicen sin quedar pegados.
const ESENCIALES = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ESENCIALES)).catch(() => {})
  );
  // Activarse de inmediato: así los arreglos llegan sin que el usuario tenga
  // que tocar nada, y nunca se queda sirviendo una versión vieja.
  self.skipWaiting();
});

// La app pide activar la versión nueva (botón "Actualizar").
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((llaves) =>
      Promise.all(llaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // No cacheamos rutas privadas ni de datos, ni el manifiesto/iconos (siempre frescos).
  if (
    url.pathname.startsWith("/app") || url.pathname.startsWith("/api") || url.pathname.startsWith("/auth") ||
    url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/")
  ) {
    return;
  }

  const esNavegacion = req.mode === "navigate";

  // PÁGINAS (navegación): SIEMPRE red primero. Así el HTML es fresco y nunca
  // pide archivos (JS/CSS) viejos que ya no existen tras un despliegue (eso
  // causaba el error de hidratación y el "Ups, un tropiezo"). Solo si NO hay
  // red, cae al caché para no dejar pantalla en blanco.
  if (esNavegacion) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error())
    );
    return;
  }

  // ARCHIVOS estáticos (JS/CSS con hash inmutable, imágenes): caché primero y
  // revalida por detrás. Como el HTML fresco pide los nombres correctos, esto
  // ya no sirve versiones incompatibles.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cacheado = await cache.match(req);
      const desdeRed = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
          return res;
        })
        .catch(() => null);
      if (cacheado) return cacheado;
      const res = await desdeRed;
      return res || Response.error();
    })
  );
});

// --- Notificaciones push ---
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: "Aviso", cuerpo: event.data ? event.data.text() : "" };
  }
  const titulo = datos.titulo || "Aviso";
  const opciones = {
    body: datos.cuerpo || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: datos.url || "/app" },
    tag: datos.tag || undefined,
    renotify: Boolean(datos.tag),
    // Avisos previos (5 min antes) pueden llegar sin sonido si así se eligió en Ajustes.
    silent: Boolean(datos.silencioso),
    // Vibración suave para que se sienta (el sonido lo pone el sistema).
    vibrate: [60, 40, 60]
  };
  // Muestra el aviso y reporta al servidor que llegó (diagnóstico).
  event.waitUntil(
    (async () => {
      let error = null;
      try {
        await self.registration.showNotification(titulo, opciones);
      } catch (e) {
        error = String((e && e.message) || e);
      }
      try {
        await fetch("/api/push/recibido", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ titulo, tag: datos.tag || null, error })
        });
      } catch {
        /* sin red: no pasa nada */
      }
    })()
  );
});

// Al tocar la notificacion: abrir o enfocar la app en la ruta indicada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      for (const c of clientes) {
        if ("focus" in c) {
          c.navigate(destino).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
