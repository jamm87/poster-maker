import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Badge, statusTone, Table } from "@/components/admin";
import { requireAdmin } from "@/lib/admin";
import { THEME_IDS } from "@/lib/assets";
import { citySpec } from "@/lib/catalog";
import { db, schema } from "@/lib/db";
import { enqueueRender } from "@/lib/jobs";

export const dynamic = "force-dynamic";

async function toggle(formData: FormData) {
  "use server";
  await requireAdmin();
  const slug = String(formData.get("slug"));
  const field = String(formData.get("field")) as "active" | "featured";
  const [c] = await db.select().from(schema.catalogCities).where(eq(schema.catalogCities.slug, slug));
  if (c) await db.update(schema.catalogCities).set({ [field]: !c[field] }).where(eq(schema.catalogCities.slug, slug));
  revalidatePath("/admin/catalogo");
}

async function generatePreview(formData: FormData) {
  "use server";
  await requireAdmin();
  const slugs = formData.getAll("slug").map(String);
  const cities = await db.select().from(schema.catalogCities);
  for (const c of cities.filter((x) => slugs.includes("*") || slugs.includes(x.slug))) {
    const job = await enqueueRender(citySpec(c, "es"), "preview", { priority: -5 });
    await db.update(schema.catalogCities).set({ previewJobId: job.id }).where(eq(schema.catalogCities.slug, c.slug));
  }
  revalidatePath("/admin/catalogo");
}

async function addCity(formData: FormData) {
  "use server";
  await requireAdmin();
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = s("slug").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!slug || !s("nameEs") || !Number.isFinite(Number(s("lat"))) || !Number.isFinite(Number(s("lon")))) return;
  await db
    .insert(schema.catalogCities)
    .values({
      slug,
      nameEs: s("nameEs"),
      nameEn: s("nameEn") || s("nameEs"),
      countryEs: s("countryEs"),
      countryEn: s("countryEn") || s("countryEs"),
      lat: s("lat"),
      lon: s("lon"),
      widthMeters: Number(s("widthMeters")) || 8000,
      themeId: THEME_IDS.includes(s("themeId")) ? s("themeId") : "terracotta",
      sortOrder: 100,
    })
    .onConflictDoNothing();
  revalidatePath("/admin/catalogo");
}

async function updateCity(formData: FormData) {
  "use server";
  await requireAdmin();
  const slug = String(formData.get("slug"));
  await db
    .update(schema.catalogCities)
    .set({
      themeId: String(formData.get("themeId")),
      widthMeters: Number(formData.get("widthMeters")) || 8000,
      descriptionEs: String(formData.get("descriptionEs") ?? "") || null,
      descriptionEn: String(formData.get("descriptionEn") ?? "") || null,
    })
    .where(eq(schema.catalogCities.slug, slug));
  revalidatePath("/admin/catalogo");
}

export default async function CatalogAdmin() {
  const cities = await db.select().from(schema.catalogCities).orderBy(asc(schema.catalogCities.sortOrder));
  const jobs = await db.select({ id: schema.renderJobs.id, status: schema.renderJobs.status }).from(schema.renderJobs).where(eq(schema.renderJobs.kind, "preview"));
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Catálogo de ciudades</h1>
        <form action={generatePreview}>
          <input type="hidden" name="slug" value="*" />
          <button className="btn-secondary">Regenerar todas las miniaturas</button>
        </form>
      </div>
      <Table head={["Ciudad", "Tema / ancho (m) / descripción SEO", "Activa", "Destacada", "Miniatura"]}>
        {cities.map((c) => {
          const job = jobs.find((j) => j.id === c.previewJobId);
          return (
            <tr key={c.slug}>
              <td className="px-3 py-2">
                <a href={`/es/poster/${c.slug}`} className="font-medium underline" target="_blank">
                  {c.nameEs}
                </a>
                <p className="text-stone-500">{c.countryEs}</p>
              </td>
              <td className="px-3 py-2">
                <form action={updateCity} className="flex flex-wrap items-start gap-2">
                  <input type="hidden" name="slug" value={c.slug} />
                  <select name="themeId" defaultValue={c.themeId} className="input !w-36 !py-1 text-xs">
                    {THEME_IDS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <input name="widthMeters" type="number" defaultValue={c.widthMeters} className="input !w-24 !py-1 text-xs" />
                  <textarea name="descriptionEs" defaultValue={c.descriptionEs ?? ""} placeholder="Descripción ES" className="input !h-8 !w-48 !py-1 text-xs" />
                  <textarea name="descriptionEn" defaultValue={c.descriptionEn ?? ""} placeholder="Description EN" className="input !h-8 !w-48 !py-1 text-xs" />
                  <button className="underline">Guardar</button>
                </form>
              </td>
              {(["active", "featured"] as const).map((field) => (
                <td key={field} className="px-3 py-2">
                  <form action={toggle}>
                    <input type="hidden" name="slug" value={c.slug} />
                    <input type="hidden" name="field" value={field} />
                    <button className="underline">{c[field] ? "sí" : "no"}</button>
                  </form>
                </td>
              ))}
              <td className="px-3 py-2">
                {job ? <Badge tone={statusTone(job.status)}>{job.status}</Badge> : "—"}
                <form action={generatePreview}>
                  <input type="hidden" name="slug" value={c.slug} />
                  <button className="block underline">Generar</button>
                </form>
              </td>
            </tr>
          );
        })}
      </Table>

      <h2 className="mb-2 mt-8 font-semibold">Añadir ciudad</h2>
      <form action={addCity} className="grid max-w-3xl grid-cols-2 gap-2 rounded bg-white p-4 shadow-sm md:grid-cols-4">
        {[
          ["slug", "slug (url)"],
          ["nameEs", "Nombre ES"],
          ["nameEn", "Nombre EN"],
          ["countryEs", "País ES"],
          ["countryEn", "País EN"],
          ["lat", "Latitud"],
          ["lon", "Longitud"],
          ["widthMeters", "Ancho (m)"],
        ].map(([name, placeholder]) => (
          <input key={name} name={name} placeholder={placeholder} className="input" required={["slug", "nameEs", "lat", "lon"].includes(name)} />
        ))}
        <select name="themeId" className="input" defaultValue="terracotta">
          {THEME_IDS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button className="btn-primary">Añadir</button>
      </form>
    </>
  );
}
