import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { createOrderFromCheckout } from "@/lib/orders";
import { normalizeSession, stripe } from "@/lib/stripe";

/** Webhook de Stripe: checkout.session.completed / async_payment_succeeded → crear pedido; charge.refunded → marcar. */
export async function POST(req: Request) {
  const s = stripe();
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(payload, req.headers.get("stripe-signature") ?? "", secret);
  } catch (err) {
    return NextResponse.json({ error: `invalid_signature: ${String(err)}` }, { status: 400 });
  }

  const [seen] = await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.id, event.id));
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status === "paid") await createOrderFromCheckout(normalizeSession(session));
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (pi && charge.refunded) {
        await db.update(schema.orders).set({ status: "refunded", updatedAt: new Date() }).where(eq(schema.orders.stripePaymentIntentId, pi));
      }
      break;
    }
  }
  await db.insert(schema.webhookEvents).values({ id: event.id, source: "stripe" }).onConflictDoNothing();
  return NextResponse.json({ received: true });
}
