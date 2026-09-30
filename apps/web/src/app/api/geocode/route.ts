import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  if (!rateLimit(`geo:${clientIp(req)}`, 30)) return NextResponse.json({ error: "rate_limited", results: [] }, { status: 429 });
  try {
    return NextResponse.json({ results: await geocode(q, url.searchParams.get("locale") ?? "es") });
  } catch (err) {
    console.error("geocode", err);
    return NextResponse.json({ error: "geocoder_unavailable", results: [] }, { status: 502 });
  }
}
