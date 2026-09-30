import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminSession } from "@/lib/admin-session";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/tokens";

// Location relativa: detrás de Docker/proxy req.url lleva el host interno.
function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req)}`, 10)) return redirect("/admin/login?error=1");
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  if (!safeEqual(password, env().ADMIN_PASSWORD)) return redirect("/admin/login?error=1");
  const session = await createAdminSession(env().APP_SECRET);
  const res = redirect("/admin/pedidos");
  res.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().PUBLIC_BASE_URL.startsWith("https://"),
    maxAge: session.maxAge,
    path: "/",
  });
  return res;
}
