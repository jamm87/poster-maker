import { NextResponse } from "next/server";
import { z } from "zod";
import { currentCartId, loadCart } from "@/lib/cart";
import { env } from "@/lib/env";
import { createOrderFromCheckout } from "@/lib/orders";
import { buildCheckoutParams, EU_COUNTRIES, shippingCents, stripe } from "@/lib/stripe";
import { randomToken } from "@/lib/tokens";

const schema = z.object({
  locale: z.enum(["es", "en"]).default("es"),
  digitalWaiver: z.boolean().default(false),
  termsAccepted: z.literal(true),
  shippingCountry: z.enum(EU_COUNTRIES).nullable().default(null),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { locale, digitalWaiver, shippingCountry } = parsed.data;
  const cart = await loadCart(await currentCartId());
  if (!cart.id || cart.lines.length === 0) return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  if (cart.lines.some((l) => l.unitPriceCents === null)) return NextResponse.json({ error: "unavailable_item" }, { status: 400 });
  if (cart.hasDigital && !digitalWaiver) return NextResponse.json({ error: "waiver_required" }, { status: 400 });
  const waiverAt = cart.hasDigital ? new Date().toISOString() : null;

  const s = stripe();
  if (s) {
    const session = await s.checkout.sessions.create(buildCheckoutParams({ cart, locale, waiverAt, shippingCountry }));
    return NextResponse.json({ url: session.url });
  }

  // Sin Stripe configurado: pago simulado, sólo en desarrollo o con ALLOW_SIMULATED_CHECKOUT=true (tests E2E).
  // NUNCA activar ALLOW_SIMULATED_CHECKOUT en la tienda real.
  if (env().NODE_ENV === "production" && process.env.ALLOW_SIMULATED_CHECKOUT !== "true") {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  }
  const country = shippingCountry ?? "ES";
  const ship = cart.hasPhysical ? shippingCents(country) : 0;
  const order = await createOrderFromCheckout({
    sessionId: `dev_${randomToken(12)}`,
    paymentIntentId: null,
    email: process.env.DEV_CHECKOUT_EMAIL ?? "cliente@example.com",
    name: "Cliente de Prueba",
    totalCents: cart.subtotalCents + ship,
    shippingCents: ship,
    discountCents: 0,
    billingCountry: country,
    shippingAddress: cart.hasPhysical
      ? { name: "Cliente de Prueba", line1: "Calle Mayor 1", postalCode: "28013", city: "Madrid", country, phone: "+34600000000" }
      : null,
    cartId: cart.id,
    locale,
    digitalWaiverAt: waiverAt,
  });
  return NextResponse.json({ url: `/${locale}/pedido/${order.accessToken}`, simulated: true });
}
