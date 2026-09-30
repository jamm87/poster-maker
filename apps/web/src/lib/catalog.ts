import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { posterSpecSchema, type PosterSpec } from "./spec";
import { signedFileUrl } from "./storage";

export type City = typeof schema.catalogCities.$inferSelect;

export async function listCities(opts: { featuredOnly?: boolean } = {}): Promise<City[]> {
  const conds = [eq(schema.catalogCities.active, true)];
  if (opts.featuredOnly) conds.push(eq(schema.catalogCities.featured, true));
  return db
    .select()
    .from(schema.catalogCities)
    .where(and(...conds))
    .orderBy(asc(schema.catalogCities.sortOrder), asc(schema.catalogCities.slug));
}

export async function getCity(slug: string): Promise<City | undefined> {
  const [city] = await db.select().from(schema.catalogCities).where(eq(schema.catalogCities.slug, slug));
  return city?.active ? city : undefined;
}

export function cityName(city: City, locale: string) {
  return locale === "en" ? city.nameEn : city.nameEs;
}

export function citySpec(city: City, locale: string, themeId?: string): PosterSpec {
  return posterSpecSchema.parse({
    center: { lat: Number(city.lat), lon: Number(city.lon) },
    widthMeters: city.widthMeters,
    formatId: "30x40",
    themeId: themeId ?? city.themeId,
    texts: { title: cityName(city, locale), subtitle: locale === "en" ? city.countryEn : city.countryEs },
  });
}

/** URLs firmadas de las miniaturas (trabajos 'preview' terminados), por slug. */
export async function cityPreviewUrls(cities: City[]): Promise<Record<string, string>> {
  const ids = cities.map((c) => c.previewJobId).filter((x): x is string => !!x);
  if (!ids.length) return {};
  const jobs = await db.select().from(schema.renderJobs).where(inArray(schema.renderJobs.id, ids));
  const out: Record<string, string> = {};
  for (const c of cities) {
    const job = jobs.find((j) => j.id === c.previewJobId && j.status === "done");
    const file = job?.output?.[0];
    if (file) out[c.slug] = await signedFileUrl(file.key, { ttlSeconds: 24 * 3600 });
  }
  return out;
}
