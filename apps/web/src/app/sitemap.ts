import type { MetadataRoute } from "next";
import { listCities } from "@/lib/catalog";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().PUBLIC_BASE_URL;
  const pages = ["", "/crear", "/posters"];
  const entries: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${base}/es${p}`,
    alternates: { languages: { es: `${base}/es${p}`, en: `${base}/en${p}` } },
  }));
  for (const c of await listCities()) {
    entries.push({
      url: `${base}/es/poster/${c.slug}`,
      alternates: { languages: { es: `${base}/es/poster/${c.slug}`, en: `${base}/en/poster/${c.slug}` } },
    });
  }
  return entries;
}
