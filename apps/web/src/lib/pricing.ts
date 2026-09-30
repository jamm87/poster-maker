import { db, schema } from "./db";

/**
 * Precios iniciales (céntimos, IVA incluido) por formato × acabado. Se cargan con `pnpm db:seed`
 * y después se editan desde /admin/precios. Una combinación sin fila = no disponible.
 * Los productUid de Gelato hay que completarlos desde el panel (ver infra/DEPLOY.md).
 */
export const DEFAULT_PRICES: Record<string, Partial<Record<string, number>>> = {
  digital: { a4: 1290, a3: 1290, "30x40": 1490, "40x50": 1490, "50x70": 1690, "70x100": 1890 },
  paper: { a4: 1990, a3: 2490, "30x40": 2990, "40x50": 3490, "50x70": 4490, "70x100": 5990 },
  framed: { a4: 4990, a3: 5990, "30x40": 6990, "40x50": 8490, "50x70": 10990, "70x100": 15990 },
  canvas: { "30x40": 5990, "40x50": 7490, "50x70": 9490, "70x100": 12990 },
  hanger: { a3: 4490, "30x40": 4990, "40x50": 5990, "50x70": 6990, "70x100": 8990 },
};

export type VariantRow = typeof schema.variants.$inferSelect;
export type PriceTable = Record<string, Record<string, number>>; // finish -> format -> cents

export async function getPriceTable(): Promise<PriceTable> {
  const rows = await db.select().from(schema.variants);
  const table: PriceTable = {};
  for (const r of rows) {
    if (!r.active) continue;
    (table[r.finishId] ??= {})[r.formatId] = r.priceCents;
  }
  return table;
}

export function priceFor(table: PriceTable, formatId: string, finishId: string): number | null {
  return table[finishId]?.[formatId] ?? null;
}

export function minPrice(table: PriceTable): number | null {
  const all = Object.values(table).flatMap((f) => Object.values(f));
  return all.length ? Math.min(...all) : null;
}
