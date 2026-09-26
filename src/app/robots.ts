import type { MetadataRoute } from "next";

// App privada: ningún buscador la indexa.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
