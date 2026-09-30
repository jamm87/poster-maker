import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { onRenderComplete } from "@/lib/orders";
import { safeEqual } from "@/lib/tokens";

/** Llamado por el worker de render al terminar (o fallar definitivamente) un trabajo. */
export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-internal-secret") ?? "", env().INTERNAL_API_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { jobId?: string } | null;
  if (!body?.jobId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await onRenderComplete(body.jobId);
  return NextResponse.json({ ok: true });
}
