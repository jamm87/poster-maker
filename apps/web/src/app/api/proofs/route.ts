import { NextResponse } from "next/server";
import { enqueueRender } from "@/lib/jobs";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { posterSpecSchema } from "@/lib/spec";

/** Encola una prueba exacta (render con marca de agua) del diseño actual. */
export async function POST(req: Request) {
  if (!rateLimit(`proof:${clientIp(req)}`, 6)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { spec?: unknown } | null;
  const parsed = posterSpecSchema.safeParse(body?.spec);
  if (!parsed.success) return NextResponse.json({ error: "invalid_spec", issues: parsed.error.issues }, { status: 400 });
  const job = await enqueueRender(parsed.data, "proof");
  return NextResponse.json({ jobId: job.id, status: job.status });
}
