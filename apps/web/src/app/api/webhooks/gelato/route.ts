import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { onGelatoEvent } from "@/lib/orders";
import { safeEqual } from "@/lib/tokens";

/**
 * Webhook de Gelato (order_status_updated, order_item_tracking_code_updated…).
 * Configura en Gelato la URL con el secreto: https://TU-DOMINIO/api/webhooks/gelato?secret=GELATO_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret") ?? "";
  if (!safeEqual(secret, env().GELATO_WEBHOOK_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await onGelatoEvent(payload);
  return NextResponse.json({ received: true });
}
