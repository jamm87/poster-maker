import { and, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { redirectTo } from "@/lib/http";
import { signedFileUrl } from "@/lib/storage";

/** Descarga de un producto digital: comprueba token del pedido, caducidad y límite; redirige a URL firmada. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; itemId: string; kind: string }> }) {
  const { token, itemId, kind } = await params;
  if (!["png", "pdf"].includes(kind) || !/^[0-9a-f-]{36}$/i.test(itemId)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ order: schema.orders, item: schema.orderItems, download: schema.downloads, job: schema.renderJobs })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .innerJoin(schema.downloads, eq(schema.downloads.orderItemId, schema.orderItems.id))
    .innerJoin(schema.renderJobs, eq(schema.renderJobs.id, schema.orderItems.renderJobId))
    .where(and(eq(schema.orderItems.id, itemId), eq(schema.orders.accessToken, token)));
  if (!row || row.order.status === "refunded") return new Response("Not found", { status: 404 });
  const file = row.job.output?.find((o) => o.role === (kind === "png" ? "print_png" : "print_pdf"));
  if (row.job.status !== "done" || !file) return new Response("Not ready", { status: 409 });
  if (row.download.expiresAt < new Date()) return new Response("Expired", { status: 410 });

  const updated = await db
    .update(schema.downloads)
    .set({ downloadCount: sql`${schema.downloads.downloadCount} + 1` })
    .where(and(eq(schema.downloads.id, row.download.id), lt(schema.downloads.downloadCount, schema.downloads.maxDownloads)))
    .returning({ id: schema.downloads.id });
  if (!updated.length) return new Response("Download limit reached", { status: 410 });

  const slug = row.item.title.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "poster";
  const url = await signedFileUrl(file.key, { ttlSeconds: 300, downloadName: `${slug}-${row.item.formatId}.${kind}` });
  return redirectTo(url, 302);
}
