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
  appleWebApp: { capable: true, title: MARCA.nombreCorto, statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  // App privada: fuera de buscadores.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
};

export const viewport: Viewport = {
  themeColor: MARCA.colorTema,
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
        {children}
        <InstalarApp />
        <ActualizarApp />
      </body>
    </html>
  );
}
