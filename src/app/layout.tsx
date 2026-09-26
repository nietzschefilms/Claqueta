import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { MARCA } from "@/config/marca";
import { InstalarApp } from "@/components/PWA";
import { ActualizarApp } from "@/components/ActualizarApp";
import { scriptTema } from "@/components/Tema";

// Títulos en Archivo condensado, texto en Public Sans, horas y montos en Plex Mono.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: { default: MARCA.nombre, template: `%s · ${MARCA.nombreCorto}` },
  description: MARCA.descripcion,
  applicationName: MARCA.nombre,
  // black-translucent: la app se dibuja detrás de la hora y la Dynamic Island (pantalla completa).
  appleWebApp: { capable: true, title: MARCA.nombreCorto, statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  // App privada: fuera de buscadores.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F0EDE7" },
    { media: "(prefers-color-scheme: dark)", color: MARCA.colorTema }
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={MARCA.idioma} suppressHydrationWarning className={`${archivo.variable} ${publicSans.variable} ${plex.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-screen antialiased">
        <div className="ambiente" aria-hidden="true" />
        <div className="velo-estado" aria-hidden="true" />
        {children}
        <InstalarApp />
        <ActualizarApp />
      </body>
    </html>
  );
}
