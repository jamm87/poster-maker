import { NextResponse } from "next/server";
import { z } from "zod";
import { addToCart, currentCartId, ensureCart, loadCart, updateCartItem } from "@/lib/cart";
import { saveDesign } from "@/lib/designs";
import { FINISH_IDS } from "@/lib/assets";

export async function GET() {
  const cart = await loadCart(await currentCartId());
  return NextResponse.json({ count: cart.count, subtotalCents: cart.subtotalCents });
}

const addSchema = z.object({ spec: z.unknown(), finishId: z.enum(FINISH_IDS as [string, ...string[]]), locale: z.string().default("es") });

export async function POST(req: Request) {
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const design = await saveDesign(parsed.data.spec);
    const cartId = await ensureCart(parsed.data.locale);
    await addToCart(cartId, design.id, parsed.data.finishId, design.spec.formatId);
    const cart = await loadCart(cartId);
    return NextResponse.json({ ok: true, count: cart.count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid" }, { status: 400 });
  }
}

const patchSchema = z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(0).max(10) });

export async function PATCH(req: Request) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  const cartId = await currentCartId();
  if (!parsed.success || !cartId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await updateCartItem(cartId, parsed.data.itemId, parsed.data.quantity);
  const cart = await loadCart(cartId);
  return NextResponse.json({ ok: true, count: cart.count });
}
