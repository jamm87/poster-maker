import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as s3SignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
import { env } from "./env";
import { sign, verify } from "./tokens";

/**
 * Archivos generados por el renderer. En local se sirven con /api/files firmados;
 * en producción (R2/S3) con URLs prefirmadas (también las usa Gelato para descargar el archivo).
 */

let s3: S3Client | undefined;
function s3Client(): S3Client {
  const e = env();
  s3 ??= new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID ?? "", secretAccessKey: e.S3_SECRET_ACCESS_KEY ?? "" },
  });
  return s3;
}

export async function signedFileUrl(
  key: string,
  opts: { ttlSeconds?: number; downloadName?: string; absolute?: boolean } = {},
): Promise<string> {
  const e = env();
  const ttl = opts.ttlSeconds ?? 3600;
  if (e.STORAGE_DRIVER === "s3") {
    return s3SignedUrl(
      s3Client(),
      new GetObjectCommand({
        Bucket: e.S3_BUCKET,
        Key: key,
        ResponseContentDisposition: opts.downloadName ? `attachment; filename="${opts.downloadName}"` : undefined,
      }),
      { expiresIn: ttl },
    );
  }
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const params = new URLSearchParams({ exp: String(exp), sig: sign(`${key}:${exp}`) });
  if (opts.downloadName) params.set("name", opts.downloadName);
  const rel = `/api/files/${key}?${params}`;
  return opts.absolute ? `${e.PUBLIC_BASE_URL}${rel}` : rel;
}

export function verifyLocalFileSignature(key: string, exp: string, sig: string): boolean {
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return verify(`${key}:${exp}`, sig);
}

export function localFilePath(key: string): string | null {
  const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().STORAGE_LOCAL_DIR);
  const full = path.resolve(/*turbopackIgnore: true*/ root, key);
  return full.startsWith(root + path.sep) ? full : null;
}
