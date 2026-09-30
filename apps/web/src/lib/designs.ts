import { db, schema } from "./db";
import { posterSpecSchema, specHash, type PosterSpec } from "./spec";

/** Guarda (o reutiliza) un diseño. Devuelve su id. */
export async function saveDesign(input: unknown): Promise<{ id: string; spec: PosterSpec }> {
  const spec = posterSpecSchema.parse(input);
  const hash = await specHash(spec);
  const [row] = await db
    .insert(schema.designs)
    .values({ spec, specHash: hash })
    .onConflictDoUpdate({ target: schema.designs.specHash, set: { specHash: hash } })
    .returning({ id: schema.designs.id });
  return { id: row.id, spec };
}
