import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-session";

const LOCALES = ["es", "en"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const ok = await verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value, process.env.APP_SECRET ?? "dev-secret-change-me-please");
    if (!ok) return NextResponse.redirect(new URL("/admin/login", req.url));
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/admin")) {
    const ok = await verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value, process.env.APP_SECRET ?? "dev-secret-change-me-please");
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // Rutas de la tienda sin prefijo de idioma → redirigir según Accept-Language
  const first = pathname.split("/")[1];
  if (!LOCALES.includes(first)) {
    const accept = req.headers.get("accept-language") ?? "";
    const locale = /^en\b/i.test(accept.trim()) ? "en" : "es";
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/(?!admin)|_next|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-z0-9]+$).*)"],
};
