import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSession } from "@/lib/admin-session";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/tokens";

export async function POST(req: Request) {
  const base = new URL(req.url);
  if (!rateLimit(`login:${clientIp(req)}`, 10)) return NextResponse.redirect(new URL("/admin/login?error=1", base), 303);
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  if (!safeEqual(password, env().ADMIN_PASSWORD)) return NextResponse.redirect(new URL("/admin/login?error=1", base), 303);
  const session = await createAdminSession(env().APP_SECRET);
  const res = NextResponse.redirect(new URL("/admin/pedidos", base), 303);
  res.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    maxAge: session.maxAge,
    path: "/",
  });
  return res;
}
