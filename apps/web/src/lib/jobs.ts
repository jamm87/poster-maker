import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import type { JobKind } from "./db/schema";
import { specHash, type PosterSpec } from "./spec";

/** Encola un render. Para preview/proof reutiliza un trabajo idéntico reciente (misma spec). */
export async function enqueueRender(
  spec: PosterSpec,
  kind: JobKind,
  opts: { finish?: string; priority?: number; orderItemId?: string } = {},
) {
  const hash = await specHash(spec);
  if (kind !== "print") {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [existing] = await db
      .select()
      .from(schema.renderJobs)
      .where(
        and(
          eq(schema.renderJobs.specHash, hash),
          eq(schema.renderJobs.kind, kind),
          inArray(schema.renderJobs.status, ["queued", "running", "done"]),
          gt(schema.renderJobs.createdAt, since),
        ),
      )
      .orderBy(desc(schema.renderJobs.createdAt))
      .limit(1);
    if (existing) return existing;
  }
  const [job] = await db
    .insert(schema.renderJobs)
    .values({
      kind,
      spec,
      specHash: hash,
      finish: opts.finish ?? "digital",
      priority: opts.priority ?? (kind === "print" ? 10 : kind === "proof" ? 5 : 0),
      orderItemId: opts.orderItemId,
    })
    .returning();
  return job;
}

export async function getJob(id: string) {
  const [job] = await db.select().from(schema.renderJobs).where(eq(schema.renderJobs.id, id));
  return job;
}

/** Posición aproximada en la cola (para mostrar al cliente). */
export async function queuePosition(job: typeof schema.renderJobs.$inferSelect): Promise<number> {
  if (job.status !== "queued") return 0;
  const rows = await db
    .select({ id: schema.renderJobs.id, priority: schema.renderJobs.priority, createdAt: schema.renderJobs.createdAt })
    .from(schema.renderJobs)
    .where(eq(schema.renderJobs.status, "queued"));
  return rows.filter((r) => r.priority > job.priority || (r.priority === job.priority && r.createdAt < job.createdAt)).length;
}

export async function retryJob(id: string) {
  await db
    .update(schema.renderJobs)
    .set({ status: "queued", attempts: 0, error: null, runAfter: new Date(), lockedBy: null, updatedAt: new Date() })
    .where(eq(schema.renderJobs.id, id));
}
