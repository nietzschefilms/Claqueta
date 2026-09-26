import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MARCA } from "@/config/marca";
import { InstalarApp } from "@/components/PWA";
import { ActualizarApp } from "@/components/ActualizarApp";
import { scriptTema } from "@/components/Tema";

export const metadata: Metadata = {
  title: { default: MARCA.nombre, template: `%s · ${MARCA.nombreCorto}` },
  description: MARCA.descripcion,
  applicationName: MARCA.nombre,
  appleWebApp: { capable: true, title: MARCA.nombreCorto, statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
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
    <html lang={MARCA.idioma} suppressHydrationWarning>
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
