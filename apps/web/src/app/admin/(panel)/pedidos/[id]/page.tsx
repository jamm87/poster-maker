import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Badge, dt, statusTone, Table } from "@/components/admin";
import { requireAdmin } from "@/lib/admin";
import { getFormat } from "@/lib/assets";
import { db, schema } from "@/lib/db";
import { sendDownloadsReady } from "@/lib/email";
import { retryJob } from "@/lib/jobs";
import { formatPrice } from "@/lib/money";
import { advanceOrder, loadOrderDetail, retryFulfillment } from "@/lib/orders";
import { signedFileUrl } from "@/lib/storage";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

async function retryRender(formData: FormData) {
  "use server";
  await requireAdmin();
  await retryJob(String(formData.get("jobId")));
  revalidatePath("/admin/pedidos");
}

async function resendDownloads(formData: FormData) {
  "use server";
  await requireAdmin();
  const detail = await loadOrderDetail({ id: String(formData.get("orderId")) });
  if (!detail) return;
  await sendDownloadsReady(detail.order);
  await db.update(schema.orders).set({ downloadsEmailAt: new Date() }).where(eq(schema.orders.id, detail.order.id));
  revalidatePath(`/admin/pedidos/${detail.order.id}`);
}

async function extendDownloads(formData: FormData) {
  "use server";
  await requireAdmin();
  const itemId = String(formData.get("itemId"));
  await db
    .update(schema.downloads)
    .set({ expiresAt: new Date(Date.now() + env().DOWNLOAD_DAYS * 86400000), downloadCount: 0 })
    .where(eq(schema.downloads.orderItemId, itemId));
  revalidatePath("/admin/pedidos");
}

async function retryGelato(formData: FormData) {
  "use server";
  await requireAdmin();
  await retryFulfillment(String(formData.get("orderId")));
  revalidatePath("/admin/pedidos");
}

async function recheck(formData: FormData) {
  "use server";
  await requireAdmin();
  await advanceOrder(String(formData.get("orderId")));
  revalidatePath("/admin/pedidos");
}

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await loadOrderDetail({ id });
  if (!detail) notFound();
  const { order, items, fulfillment } = detail;
  const emails = await db.select().from(schema.emailLog).where(eq(schema.emailLog.orderId, order.id));
  const files = await Promise.all(
    items.map(async ({ job }) =>
      Promise.all((job?.status === "done" ? (job.output ?? []) : []).map(async (o) => ({ role: o.role, url: await signedFileUrl(o.key), w: o.width, h: o.height, bytes: o.bytes }))),
    ),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Pedido {order.number}</h1>
        <Badge tone={statusTone(order.status)}>{order.status}</Badge>
        <form action={recheck}>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="text-xs underline">Recomprobar estado</button>
        </form>
      </div>

      <section className="grid gap-4 rounded bg-white p-5 shadow-sm md:grid-cols-3">
        <div>
          <p className="text-stone-500">Cliente</p>
          <p>{order.customerName ?? "—"}</p>
          <p>{order.email}</p>
        </div>
        <div>
          <p className="text-stone-500">Importes</p>
          <p>Subtotal {formatPrice(order.subtotalCents)} · Envío {formatPrice(order.shippingCents)}</p>
          <p className="font-medium">Total {formatPrice(order.totalCents)}</p>
          <p className="text-xs text-stone-500">Stripe: {order.stripePaymentIntentId ?? order.stripeSessionId}</p>
        </div>
        <div>
          <p className="text-stone-500">Fechas</p>
          <p>Creado {dt(order.createdAt)}</p>
          <p>Consentimiento digital {dt(order.digitalWaiverAt)}</p>
          <p>
            Página del cliente:{" "}
            <a className="underline" href={`/${order.locale}/pedido/${order.accessToken}`} target="_blank">
              abrir
            </a>
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Productos</h2>
        <Table head={["Producto", "Acabado", "Cant.", "Precio", "Render", "Archivos", ""]}>
          {items.map(({ item, job, download }, i) => (
            <tr key={item.id}>
              <td className="px-3 py-2">
                {item.title} · {getFormat(item.formatId).label}
              </td>
              <td className="px-3 py-2">{item.finishId}</td>
              <td className="px-3 py-2">{item.quantity}</td>
              <td className="px-3 py-2">{formatPrice(item.unitPriceCents)}</td>
              <td className="px-3 py-2">
                {job ? <Badge tone={statusTone(job.status)}>{job.status}</Badge> : "—"}
                {job?.error && <pre className="mt-1 max-w-xs whitespace-pre-wrap text-[10px] text-red-700">{job.error.slice(0, 400)}</pre>}
              </td>
              <td className="px-3 py-2">
                {files[i].map((f) => (
                  <a key={f.role} href={f.url} className="block underline" target="_blank">
                    {f.role} {f.w}×{f.h} ({(f.bytes / 1e6).toFixed(1)} MB)
                  </a>
                ))}
                {download && (
                  <p className="text-[10px] text-stone-500">
                    Descargas {download.downloadCount}/{download.maxDownloads} · caduca {dt(download.expiresAt)}
                  </p>
                )}
              </td>
              <td className="space-y-1 px-3 py-2">
                {job && job.status === "failed" && (
                  <form action={retryRender}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <button className="underline">Reintentar render</button>
                  </form>
                )}
                {download && (
                  <form action={extendDownloads}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="underline">Renovar descargas</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </Table>
        {items.some((i) => !i.item.physical) && (
          <form action={resendDownloads} className="mt-2">
            <input type="hidden" name="orderId" value={order.id} />
            <button className="btn-secondary">Reenviar email de descargas</button>
          </form>
        )}
      </section>

      {fulfillment && (
        <section className="rounded bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Gelato</h2>
            <Badge tone={statusTone(fulfillment.status)}>{fulfillment.status}</Badge>
            {fulfillment.draft && <Badge tone="amber">borrador</Badge>}
            {(fulfillment.status === "failed" || fulfillment.status === "pending") && (
              <form action={retryGelato}>
                <input type="hidden" name="orderId" value={order.id} />
                <button className="text-xs underline">Reintentar envío a Gelato</button>
              </form>
            )}
          </div>
          <p className="mt-2">ID Gelato: {fulfillment.providerOrderId ?? "—"}</p>
          {fulfillment.trackingUrl && (
            <a href={fulfillment.trackingUrl} className="underline" target="_blank">
              Seguimiento {fulfillment.trackingCode}
            </a>
          )}
          {fulfillment.lastError && <p className="mt-2 text-red-700">{fulfillment.lastError}</p>}
          {order.shippingAddress && (
            <p className="mt-2 text-stone-600">
              {order.shippingAddress.name} · {order.shippingAddress.line1} {order.shippingAddress.line2 ?? ""} · {order.shippingAddress.postalCode}{" "}
              {order.shippingAddress.city} · {order.shippingAddress.country} · {order.shippingAddress.phone ?? ""}
            </p>
          )}
          {fulfillment.request != null && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs">Petición / respuesta</summary>
              <pre className="mt-2 overflow-auto bg-stone-50 p-2 text-[10px]">{JSON.stringify({ request: fulfillment.request, response: fulfillment.response }, null, 2)}</pre>
            </details>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Emails</h2>
        <Table head={["Fecha", "Tipo", "Asunto", "Resultado"]}>
          {emails.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2">{dt(m.createdAt)}</td>
              <td className="px-3 py-2">{m.kind}</td>
              <td className="px-3 py-2">{m.subject}</td>
              <td className="px-3 py-2">{m.error ? <span className="text-red-700">{m.error}</span> : (m.providerId ?? "registrado")}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
