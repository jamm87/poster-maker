import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { localFilePath, verifyLocalFileSignature } from "@/lib/storage";

/** Sirve archivos del almacenamiento local con URL firmada (sólo STORAGE_DRIVER=local). */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");
  const url = new URL(req.url);
  if (!verifyLocalFileSignature(key, url.searchParams.get("exp") ?? "", url.searchParams.get("sig") ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }
  const file = localFilePath(key);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const st = await stat(file);
    const type = key.endsWith(".pdf") ? "application/pdf" : "image/png";
    const name = url.searchParams.get("name");
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(st.size),
        "Cache-Control": "private, max-age=3600",
        ...(name ? { "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]/g, "_")}"` } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
