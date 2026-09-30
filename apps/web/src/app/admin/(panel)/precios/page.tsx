import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Table } from "@/components/admin";
import { requireAdmin } from "@/lib/admin";
import { formats } from "@/lib/assets";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const formatId = String(formData.get("formatId"));
  const finishId = String(formData.get("finishId"));
  const euros = Number(String(formData.get("price")).replace(",", "."));
  const uid = String(formData.get("uid") ?? "").trim() || null;
  const active = formData.get("active") === "on";
  if (!Number.isFinite(euros) || euros <= 0) return;
  const values = { formatId, finishId, priceCents: Math.round(euros * 100), gelatoProductUid: uid, active, updatedAt: new Date() };
  const [existing] = await db
    .select()
    .from(schema.variants)
    .where(and(eq(schema.variants.formatId, formatId), eq(schema.variants.finishId, finishId)));
  if (existing) {
    await db.update(schema.variants).set(values).where(and(eq(schema.variants.formatId, formatId), eq(schema.variants.finishId, finishId)));
  } else {
    await db.insert(schema.variants).values(values);
  }
  revalidatePath("/admin/precios");
}

export default async function PricesPage() {
  const rows = await db.select().from(schema.variants);
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Precios y productos de Gelato</h1>
      <p className="mb-4 max-w-3xl text-xs text-stone-600">
        Precios en euros con IVA incluido. Para cada variante física indica el <strong>productUid</strong> de Gelato (búscalo en el catálogo de
        Gelato o con su API de productos; ver infra/DEPLOY.md). Mientras empiece por «TODO», los pedidos físicos de esa variante quedarán en
        «needs_attention». Desmarca «activa» para ocultar una combinación.
      </p>
      <Table head={["Acabado", "Formato", "Precio (€)", "productUid de Gelato", "Activa", ""]}>
        {formats.finishes.flatMap((fin) =>
          formats.formats.map((fmt) => {
            const v = rows.find((r) => r.formatId === fmt.id && r.finishId === fin.id);
            return (
              <tr key={`${fin.id}-${fmt.id}`} className={v?.active ? "" : "opacity-60"}>
                <td className="px-3 py-2">{fin.id}</td>
                <td className="px-3 py-2">{fmt.label}</td>
                <td colSpan={4} className="px-3 py-2">
                  <form action={save} className="flex items-center gap-3">
                    <input type="hidden" name="formatId" value={fmt.id} />
                    <input type="hidden" name="finishId" value={fin.id} />
                    <input name="price" defaultValue={v ? (v.priceCents / 100).toFixed(2) : ""} placeholder="—" className="input !w-24 !py-1" />
                    {fin.physical ? (
                      <input
                        name="uid"
                        defaultValue={v?.gelatoProductUid ?? ""}
                        className={`input !w-96 !py-1 font-mono text-[11px] ${v?.gelatoProductUid?.startsWith("TODO") ? "!border-amber-500" : ""}`}
                      />
                    ) : (
                      <span className="w-96 text-stone-400">(descarga digital)</span>
                    )}
                    <input type="checkbox" name="active" defaultChecked={v?.active ?? false} />
                    <button className="underline">Guardar</button>
                  </form>
                </td>
              </tr>
            );
          }),
        )}
      </Table>
    </>
  );
}
