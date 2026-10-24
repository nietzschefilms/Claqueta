/** @type {import('next').NextConfig} */

const dev = process.env.NODE_ENV !== "production";

// Cabeceras de seguridad (heredadas de Rompiendo Tabúes). La CSP limita de
// dónde carga la página scripts, estilos, imágenes y conexiones. Si un cliente
// necesita otro dominio (Stripe, YouTube, un CDN), agrégalo aquí.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // Playlists de Spotify en el perfil filmmaker.
  "frame-src 'self' https://open.spotify.com",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${dev ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "media-src 'self' blob: https://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Next 15 manda el <title>, el manifiesto y las etiquetas de Apple dentro del
  // <body> a los navegadores normales (streaming metadata). Safari de iPhone solo
  // los lee en el <head>: sin eso la app instalada no sabe su alcance y al
  // entrar abre todo en la vista de Safari con la X. Así van siempre en el <head>.
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      }
    ];
  }
};

export default nextConfig;
