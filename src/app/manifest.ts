import type { MetadataRoute } from "next";
import { MARCA } from "@/config/marca";

// Manifiesto de la PWA, armado desde src/config/marca.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA.nombre,
    short_name: MARCA.nombreCorto,
    description: MARCA.descripcion,
    lang: MARCA.idioma,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: MARCA.colorFondo,
    theme_color: MARCA.colorTema,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
