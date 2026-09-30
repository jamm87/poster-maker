import Stripe from "stripe";
import { getFormat } from "./assets";
import type { CartView } from "./cart";
import { env } from "./env";
import { getT } from "./i18n";

export const EU_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE",
  "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;
export type EuCountry = (typeof EU_COUNTRIES)[number];

let client: Stripe | undefined;
export function stripe(): Stripe | null {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

export function shippingCents(country: string): number {
  return country === "ES" ? env().SHIPPING_ES_CENTS : env().SHIPPING_EU_CENTS;
}

export function lineName(line: CartView["lines"][number], locale: string): string {
  const t = getT(locale);
  const fmt = getFormat(line.formatId);
  const finish = t(`finishes.${line.finishId}.name` as Parameters<typeof t>[0]);
  return `${line.spec.texts.title} · ${fmt.label} · ${finish}`;
}

export interface CheckoutRequest {
  cart: CartView;
  locale: string;
  waiverAt: string | null;
  shippingCountry: string | null;
}

export function buildCheckoutParams(req: CheckoutRequest): Stripe.Checkout.SessionCreateParams {
  const { cart, locale, waiverAt, shippingCountry } = req;
  const base = env().PUBLIC_BASE_URL;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    locale: locale === "en" ? "en" : "es",
    line_items: cart.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: "eur",
        unit_amount: l.unitPriceCents!,
        product_data: {
          name: lineName(l, locale),
          metadata: { designId: l.designId, finishId: l.finishId, formatId: l.formatId },
        },
      },
    })),
    metadata: { cartId: cart.id!, locale, digitalWaiverAt: waiverAt ?? "" },
    payment_intent_data: { metadata: { cartId: cart.id! } },
    billing_address_collection: "required",
    success_url: `${base}/${locale}/pedido/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/${locale}/carrito`,
  };
  if (cart.hasPhysical) {
    const country = (shippingCountry ?? "ES") as EuCountry;
    params.shipping_address_collection = {
      allowed_countries: country === "ES" ? ["ES"] : EU_COUNTRIES.filter((c) => c !== "ES"),
    };
    params.phone_number_collection = { enabled: true };
    params.shipping_options = [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: country === "ES" ? (locale === "en" ? "Standard shipping (Spain)" : "Envío estándar (España)") : locale === "en" ? "Standard shipping (EU)" : "Envío estándar (UE)",
          fixed_amount: { amount: shippingCents(country), currency: "eur" },
          delivery_estimate: {
            minimum: { unit: "business_day", value: country === "ES" ? 3 : 4 },
            maximum: { unit: "business_day", value: country === "ES" ? 6 : 9 },
          },
        },
      },
    ];
  }
  return params;
}

/** Datos del pago normalizados (vienen de Stripe o del pago simulado en desarrollo). */
export interface PaidCheckout {
  sessionId: string;
  paymentIntentId: string | null;
  email: string;
  name: string | null;
  totalCents: number;
  shippingCents: number;
  discountCents: number;
  billingCountry: string | null;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string | null;
    postalCode: string;
    city: string;
    state?: string | null;
    country: string;
    phone?: string | null;
  } | null;
  cartId: string;
  locale: string;
  digitalWaiverAt: string | null;
}

export function normalizeSession(s: Stripe.Checkout.Session): PaidCheckout {
  const ship = s.collected_information?.shipping_details;
  const addr = ship?.address;
  return {
    sessionId: s.id,
    paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
    email: s.customer_details?.email ?? "",
    name: s.customer_details?.name ?? ship?.name ?? null,
    totalCents: s.amount_total ?? 0,
    shippingCents: s.shipping_cost?.amount_total ?? 0,
    discountCents: s.total_details?.amount_discount ?? 0,
    billingCountry: s.customer_details?.address?.country ?? null,
    shippingAddress:
      addr && ship
        ? {
            name: ship.name ?? s.customer_details?.name ?? "",
            line1: addr.line1 ?? "",
            line2: addr.line2,
            postalCode: addr.postal_code ?? "",
            city: addr.city ?? "",
            state: addr.state,
            country: addr.country ?? "",
            phone: s.customer_details?.phone ?? null,
          }
        : null,
    cartId: s.metadata?.cartId ?? "",
    locale: s.metadata?.locale ?? "es",
    digitalWaiverAt: s.metadata?.digitalWaiverAt || null,
  };
}
