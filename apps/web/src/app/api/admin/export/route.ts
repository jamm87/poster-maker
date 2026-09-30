import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Export CSV de pedidos para la gestoría (separador «;» y coma decimal, como espera Excel en España). */
export async function GET() {
  const orders = await db.select().from(schema.orders).orderBy(asc(schema.orders.createdAt));
  const items = await db.select().from(schema.orderItems);
  const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Fecha", "Pedido", "Cliente", "Email", "País facturación", "País envío", "Productos", "Subtotal", "Envío", "Descuento", "Total (IVA incl.)", "Estado", "Stripe"];
  const lines = orders.map((o) => {
    const its = items.filter((i) => i.orderId === o.id).map((i) => `${i.quantity}× ${i.title} ${i.formatId} ${i.finishId}`);
    return [
      o.createdAt.toISOString().slice(0, 10),
      o.number,
      o.customerName,
      o.email,
      o.billingCountry,
      o.shippingAddress?.country,
      its.join(" | "),
      eur(o.subtotalCents),
      eur(o.shippingCents),
      eur(o.discountCents),
      eur(o.totalCents),
      o.status,
      o.stripePaymentIntentId ?? o.stripeSessionId,
    ]
      .map(esc)
      .join(";");
  });
  const csv = "﻿" + [header.map(esc).join(";"), ...lines].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
