import { NextResponse } from "next/server";
import { getJob, queuePosition } from "@/lib/jobs";
import { signedFileUrl } from "@/lib/storage";

/** Estado de un trabajo de vista previa/prueba (los de impresión no se exponen aquí). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const job = await getJob(id);
  if (!job || job.kind === "print") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const file = job.output?.[0];
  return NextResponse.json({
    status: job.status,
    position: await queuePosition(job),
    url: job.status === "done" && file ? await signedFileUrl(file.key, { ttlSeconds: 3600 }) : undefined,
  });
}
