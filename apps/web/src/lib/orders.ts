import { and, eq, inArray } from "drizzle-orm";
import { getFinish, getFormat } from "./assets";
import { loadCart } from "./cart";
import { db, schema } from "./db";
import { env } from "./env";
import { sendDownloadsReady, sendOrderConfirmation, sendShipped } from "./email";
import { createGelatoOrder, GelatoError, mapGelatoStatus } from "./gelato";
import { enqueueRender } from "./jobs";
import { signedFileUrl } from "./storage";
import type { PaidCheckout } from "./stripe";
import { randomToken } from "./tokens";

type Order = typeof schema.orders.$inferSelect;

export function orderNumber(date = new Date()): string {
  const d = date.toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(36).padStart(2, "0")).join("").toUpperCase();
  return `PM-${d}-${rand.slice(0, 5)}`;
}

/**
 * Crea el pedido a partir de un pago confirmado. Idempotente por sessionId (el webhook de Stripe y la
 * página de confirmación pueden llamarlo a la vez). Encola los renders de impresión y vacía el carrito.
 */
export async function createOrderFromCheckout(paid: PaidCheckout): Promise<Order> {
  const [existing] = await db.select().from(schema.orders).where(eq(schema.orders.stripeSessionId, paid.sessionId));
  if (existing) return existing;

  const cart = await loadCart(paid.cartId);
  if (cart.lines.length === 0) throw new Error(`Carrito ${paid.cartId} vacío o inexistente para la sesión ${paid.sessionId}`);

  const order = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.orders)
      .values({
        number: orderNumber(),
        stripeSessionId: paid.sessionId,
        stripePaymentIntentId: paid.paymentIntentId,
        email: paid.email,
        customerName: paid.name,
        locale: paid.locale,
        subtotalCents: cart.subtotalCents,
        shippingCents: paid.shippingCents,
        discountCents: paid.discountCents,
        totalCents: paid.totalCents,
        shippingAddress: paid.shippingAddress,
        billingCountry: paid.billingCountry,
        digitalWaiverAt: paid.digitalWaiverAt ? new Date(paid.digitalWaiverAt) : null,
        accessToken: randomToken(),
      })
      .onConflictDoNothing({ target: schema.orders.stripeSessionId })
      .returning();
    if (!created) return null; // otra petición concurrente lo creó

    const days = env().DOWNLOAD_DAYS;
    for (const line of cart.lines) {
      const [item] = await tx
        .insert(schema.orderItems)
        .values({
          orderId: created.id,
          designId: line.designId,
          formatId: line.formatId,
          finishId: line.finishId,
          physical: line.physical,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents ?? 0,
          title: line.spec.texts.title,
        })
        .returning();
      if (!line.physical) {
        await tx.insert(schema.downloads).values({
          orderItemId: item.id,
          expiresAt: new Date(Date.now() + days * 24 * 3600 * 1000),
        });
      }
    }
    if (cart.hasPhysical) await tx.insert(schema.fulfillments).values({ orderId: created.id, draft: env().GELATO_ORDER_TYPE === "draft" });
    await tx.delete(schema.cartItems).where(eq(schema.cartItems.cartId, paid.cartId));
    return created;
  });

  if (!order) {
    const [row] = await db.select().from(schema.orders).where(eq(schema.orders.stripeSessionId, paid.sessionId));
    return row;
  }

  // Encolar renders de impresión (fuera de la transacción: el worker los ve en cuanto existen)
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  for (const item of items) {
    const [design] = await db.select().from(schema.designs).where(eq(schema.designs.id, item.designId));
    const job = await enqueueRender(design.spec, "print", { finish: item.finishId, orderItemId: item.id });
    await db.update(schema.orderItems).set({ renderJobId: job.id }).where(eq(schema.orderItems.id, item.id));
  }

  try {
    await sendOrderConfirmation(order, cart.hasDigital, cart.hasPhysical);
    await db.update(schema.orders).set({ confirmationEmailAt: new Date() }).where(eq(schema.orders.id, order.id));
  } catch (err) {
    console.error("Error enviando confirmación", order.number, err);
  }
  return order;
}

export async function loadOrderDetail(where: { id?: string; token?: string }) {
  const cond = where.id ? eq(schema.orders.id, where.id) : eq(schema.orders.accessToken, where.token ?? "");
  const [order] = await db.select().from(schema.orders).where(cond);
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  const jobIds = items.map((i) => i.renderJobId).filter((x): x is string => !!x);
  const jobs = jobIds.length ? await db.select().from(schema.renderJobs).where(inArray(schema.renderJobs.id, jobIds)) : [];
  const itemIds = items.map((i) => i.id);
  const dls = itemIds.length ? await db.select().from(schema.downloads).where(inArray(schema.downloads.orderItemId, itemIds)) : [];
  const [fulfillment] = await db.select().from(schema.fulfillments).where(eq(schema.fulfillments.orderId, order.id));
  const designIds = items.map((i) => i.designId);
  const designRows = designIds.length ? await db.select().from(schema.designs).where(inArray(schema.designs.id, designIds)) : [];
  return {
    order,
    items: items.map((item) => ({
      item,
      job: jobs.find((j) => j.id === item.renderJobId) ?? null,
      download: dls.find((d) => d.orderItemId === item.id) ?? null,
      spec: designRows.find((d) => d.id === item.designId)!.spec,
    })),
    fulfillment: fulfillment ?? null,
  };
}

/**
 * Avanza un pedido según el estado de sus renders. Idempotente: se llama al terminar cada render,
 * desde los webhooks y desde el panel de administración.
 */
export async function advanceOrder(orderId: string): Promise<void> {
  const detail = await loadOrderDetail({ id: orderId });
  if (!detail) return;
  const { order, items, fulfillment } = detail;
  const failed = items.some((i) => i.job?.status === "failed");
  const digital = items.filter((i) => !i.item.physical);
  const physical = items.filter((i) => i.item.physical);

  // 1. Descargas digitales listas → email
  if (digital.length && !order.downloadsEmailAt && digital.every((i) => i.job?.status === "done")) {
    try {
      await sendDownloadsReady(order);
      await db.update(schema.orders).set({ downloadsEmailAt: new Date(), updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
    } catch (err) {
      console.error("Error enviando descargas", order.number, err);
    }
  }

  // 2. Físicos: cuando todos los archivos de impresión están listos → pedido a Gelato
  if (fulfillment && fulfillment.status === "pending" && physical.length && physical.every((i) => i.job?.status === "done")) {
    await submitFulfillment(order, fulfillment.id, physical);
  }

  // 3. Estado del pedido
  const [f] = await db.select().from(schema.fulfillments).where(eq(schema.fulfillments.orderId, order.id));
  let status: Order["status"] = order.status;
  if (failed || f?.status === "failed") status = "needs_attention";
  else if (f && ["shipped", "delivered"].includes(f.status)) status = "shipped";
  else if (f && ["submitted", "in_production"].includes(f.status)) status = "in_production";
  else if (!physical.length && digital.every((i) => i.job?.status === "done")) status = "fulfilled";
  if (status !== order.status && order.status !== "refunded") {
    await db.update(schema.orders).set({ status, updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
  }
}

async function submitFulfillment(
  order: Order,
  fulfillmentId: string,
  physical: NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>["items"],
) {
  const variants = await db.select().from(schema.variants);
  const missing: string[] = [];
  const gelatoItems = [];
  for (const { item, job } of physical) {
    const variant = variants.find((v) => v.formatId === item.formatId && v.finishId === item.finishId);
    const uid = variant?.gelatoProductUid;
    if (!uid || uid.startsWith("TODO")) {
      missing.push(`${getFormat(item.formatId).label} / ${getFinish(item.finishId).id}`);
      continue;
    }
    const file = job!.output!.find((o) => o.role === "print_png" || o.role === "print_pdf")!;
    gelatoItems.push({
      itemReferenceId: item.id,
      productUid: uid,
      quantity: item.quantity,
      fileUrl: await signedFileUrl(file.key, { ttlSeconds: 7 * 24 * 3600, absolute: true }),
    });
  }
  const now = new Date();
  if (missing.length) {
    await db
      .update(schema.fulfillments)
      .set({ status: "failed", lastError: `Falta productUid de Gelato para: ${missing.join(", ")}`, updatedAt: now })
      .where(eq(schema.fulfillments.id, fulfillmentId));
    return;
  }
  if (!order.shippingAddress) {
    await db.update(schema.fulfillments).set({ status: "failed", lastError: "Pedido sin dirección de envío", updatedAt: now }).where(eq(schema.fulfillments.id, fulfillmentId));
    return;
  }
  try {
    const res = await createGelatoOrder({
      orderReferenceId: order.number,
      customerReferenceId: order.email,
      email: order.email,
      address: order.shippingAddress,
      items: gelatoItems,
    });
    await db
      .update(schema.fulfillments)
      .set({
        status: "submitted",
        providerOrderId: String((res.response as { id?: string }).id ?? ""),
        request: res.request,
        response: res.response,
        lastError: res.mock ? "Modo simulado: GELATO_API_KEY no configurada" : null,
        updatedAt: now,
      })
      .where(eq(schema.fulfillments.id, fulfillmentId));
  } catch (err) {
    await db
      .update(schema.fulfillments)
      .set({
        status: "failed",
        lastError: String(err instanceof Error ? err.message : err),
        request: err instanceof GelatoError ? err.request : null,
        response: err instanceof GelatoError ? err.response : null,
        updatedAt: now,
      })
      .where(eq(schema.fulfillments.id, fulfillmentId));
  }
}

/** Reintenta el envío a Gelato de un pedido marcado como fallido (desde el panel). */
export async function retryFulfillment(orderId: string) {
  await db.update(schema.fulfillments).set({ status: "pending", lastError: null, updatedAt: new Date() }).where(and(eq(schema.fulfillments.orderId, orderId), inArray(schema.fulfillments.status, ["failed", "pending"])));
  await db.update(schema.orders).set({ status: "paid" }).where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, "needs_attention")));
  await advanceOrder(orderId);
}

export async function onRenderComplete(jobId: string) {
  const [job] = await db.select().from(schema.renderJobs).where(eq(schema.renderJobs.id, jobId));
  if (!job?.orderItemId) return;
  const [item] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, job.orderItemId));
  if (item) await advanceOrder(item.orderId);
}

/** Webhook de Gelato: actualiza estado y seguimiento, avisa al cliente cuando se envía. */
export async function onGelatoEvent(payload: {
  event?: string;
  orderReferenceId?: string;
  fulfillmentStatus?: string;
  trackingUrl?: string;
  trackingCode?: string;
  items?: { fulfillments?: { trackingUrl?: string; trackingCode?: string }[] }[];
}) {
  if (!payload.orderReferenceId) return;
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.number, payload.orderReferenceId));
  if (!order) return;
  const [f] = await db.select().from(schema.fulfillments).where(eq(schema.fulfillments.orderId, order.id));
  if (!f) return;
  const tracking = payload.items?.flatMap((i) => i.fulfillments ?? []).find((x) => x.trackingUrl) ?? payload;
  const status = mapGelatoStatus(payload.fulfillmentStatus) ?? (tracking.trackingUrl ? "shipped" : f.status);
  await db
    .update(schema.fulfillments)
    .set({
      status,
      trackingUrl: tracking.trackingUrl ?? f.trackingUrl,
      trackingCode: tracking.trackingCode ?? f.trackingCode,
      updatedAt: new Date(),
    })
    .where(eq(schema.fulfillments.id, f.id));
  if ((status === "shipped" || status === "delivered") && !f.shippedEmailAt) {
    try {
      await sendShipped(order, tracking.trackingUrl ?? f.trackingUrl ?? null);
      await db.update(schema.fulfillments).set({ shippedEmailAt: new Date() }).where(eq(schema.fulfillments.id, f.id));
    } catch (err) {
      console.error("Error enviando email de envío", order.number, err);
    }
  }
  await advanceOrder(order.id);
}
