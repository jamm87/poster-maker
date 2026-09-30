import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "./admin-session";
import { env } from "./env";

/** Defensa en profundidad para server actions del panel (además del proxy). */
export async function requireAdmin() {
  const ok = await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value, env().APP_SECRET);
  if (!ok) redirect("/admin/login");
}
