import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/es/carrito", "/en/carrito", "/es/pedido", "/en/pedido"] },
    sitemap: `${env().PUBLIC_BASE_URL}/sitemap.xml`,
  };
}
