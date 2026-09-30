/** Limitador en memoria por clave (IP). Suficiente para un único servidor. */
const buckets = new Map<string, { tokens: number; ts: number }>();

export function rateLimit(key: string, perMinute: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, ts: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.ts) / 60000) * perMinute);
  b.ts = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10000) buckets.clear();
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
