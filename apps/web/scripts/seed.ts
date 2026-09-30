/**
 * Datos iniciales: precios por variante y ciudades del catálogo. Idempotente: no pisa precios ni
 * productUid que ya existan (edítalos en /admin/precios). Con --previews encola las miniaturas del catálogo.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { SEED_CITIES } from "../src/lib/catalog-seed";
import { DEFAULT_PRICES } from "../src/lib/pricing";
import { posterSpecSchema, specHash } from "../src/lib/spec";

const client = postgres(process.env.DATABASE_URL ?? "postgres://poster:poster@localhost:5432/poster", { max: 1 });
const db = drizzle({ client, schema });

let variants = 0;
for (const [finishId, byFormat] of Object.entries(DEFAULT_PRICES)) {
  for (const [formatId, priceCents] of Object.entries(byFormat)) {
    const res = await db
      .insert(schema.variants)
      .values({ formatId, finishId, priceCents: priceCents!, gelatoProductUid: finishId === "digital" ? null : `TODO-gelato-${finishId}-${formatId}` })
      .onConflictDoNothing()
      .returning();
    variants += res.length;
  }
}

let cities = 0;
for (const [i, c] of SEED_CITIES.entries()) {
  const res = await db
    .insert(schema.catalogCities)
    .values({ ...c, lat: String(c.lat), lon: String(c.lon), featured: c.featured ?? false, sortOrder: i })
    .onConflictDoNothing()
    .returning();
  cities += res.length;
}
console.log(`Variantes nuevas: ${variants} · ciudades nuevas: ${cities}`);

if (process.argv.includes("--previews")) {
  const all = await db.select().from(schema.catalogCities);
  let queued = 0;
  for (const c of all) {
    if (c.previewJobId) continue;
    const spec = posterSpecSchema.parse({
      center: { lat: Number(c.lat), lon: Number(c.lon) },
      widthMeters: c.widthMeters,
      formatId: "30x40",
      themeId: c.themeId,
      texts: { title: c.nameEs, subtitle: c.countryEs },
    });
    const [job] = await db.insert(schema.renderJobs).values({ kind: "preview", spec, specHash: await specHash(spec), priority: -5 }).returning();
    await db.update(schema.catalogCities).set({ previewJobId: job.id }).where(eq(schema.catalogCities.slug, c.slug));
    queued++;
  }
  console.log(`Miniaturas encoladas: ${queued}`);
}
await client.end();
