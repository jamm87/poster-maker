import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getFormat, isPhysical } from "./assets";
import { db, schema } from "./db";
import { env } from "./env";
import { getPriceTable, priceFor } from "./pricing";
import type { PosterSpec } from "./spec";

export const CART_COOKIE = "cart_id";
const UUID_RE = /^[0-9a-f-]{36}$/i;

export interface CartLine {
  id: string;
  designId: string;
  spec: PosterSpec;
  finishId: string;
  formatId: string;
  physical: boolean;
  quantity: number;
  unitPriceCents: number | null;
}

export interface CartView {
  id: string | null;
  lines: CartLine[];
  subtotalCents: number;
  hasPhysical: boolean;
  hasDigital: boolean;
  count: number;
}

export async function currentCartId(): Promise<string | null> {
  const id = (await cookies()).get(CART_COOKIE)?.value;
  return id && UUID_RE.test(id) ? id : null;
}

export async function ensureCart(locale: string): Promise<string> {
  const existing = await currentCartId();
  if (existing) {
    const [row] = await db.select({ id: schema.carts.id }).from(schema.carts).where(eq(schema.carts.id, existing));
    if (row) return row.id;
  }
  const [cart] = await db.insert(schema.carts).values({ locale }).returning({ id: schema.carts.id });
  (await cookies()).set(CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().PUBLIC_BASE_URL.startsWith("https://"),
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return cart.id;
}

export async function loadCart(cartId: string | null): Promise<CartView> {
  if (!cartId) return { id: null, lines: [], subtotalCents: 0, hasPhysical: false, hasDigital: false, count: 0 };
  const rows = await db
    .select({ item: schema.cartItems, spec: schema.designs.spec })
    .from(schema.cartItems)
    .innerJoin(schema.designs, eq(schema.designs.id, schema.cartItems.designId))
    .where(eq(schema.cartItems.cartId, cartId))
    .orderBy(asc(schema.cartItems.createdAt));
  const prices = await getPriceTable();
  const lines: CartLine[] = rows.map(({ item, spec }) => ({
    id: item.id,
    designId: item.designId,
    spec,
    finishId: item.finishId,
    formatId: spec.formatId,
    physical: isPhysical(item.finishId),
    quantity: item.quantity,
    unitPriceCents: priceFor(prices, spec.formatId, item.finishId),
  }));
  return {
    id: cartId,
    lines,
    subtotalCents: lines.reduce((s, l) => s + (l.unitPriceCents ?? 0) * l.quantity, 0),
    hasPhysical: lines.some((l) => l.physical),
    hasDigital: lines.some((l) => !l.physical),
    count: lines.reduce((s, l) => s + l.quantity, 0),
  };
}

export async function addToCart(cartId: string, designId: string, finishId: string, formatId: string) {
  getFormat(formatId);
  const prices = await getPriceTable();
  if (priceFor(prices, formatId, finishId) === null) throw new Error("Variante no disponible");
  const [existing] = await db
    .select()
    .from(schema.cartItems)
    .where(
      and(
        eq(schema.cartItems.cartId, cartId),
        eq(schema.cartItems.designId, designId),
        eq(schema.cartItems.finishId, finishId),
      ),
    );
  if (existing) {
    // Un digital no tiene sentido en cantidad > 1
    if (!isPhysical(finishId)) return;
    await db
      .update(schema.cartItems)
      .set({ quantity: Math.min(existing.quantity + 1, 10) })
      .where(eq(schema.cartItems.id, existing.id));
    return;
  }
  await db.insert(schema.cartItems).values({ cartId, designId, finishId });
}

export async function updateCartItem(cartId: string, itemId: string, quantity: number) {
  const where = and(eq(schema.cartItems.cartId, cartId), eq(schema.cartItems.id, itemId));
  if (quantity <= 0) {
    await db.delete(schema.cartItems).where(where);
    return;
  }
  const [item] = await db.select().from(schema.cartItems).where(where);
  if (!item) return;
  const q = isPhysical(item.finishId) ? Math.min(quantity, 10) : 1;
  await db.update(schema.cartItems).set({ quantity: q }).where(where);
}
