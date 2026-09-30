import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { db, schema } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { createOrderFromCheckout } from "@/lib/orders";
import { normalizeSession, stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Página de retorno de Stripe Checkout: localiza (o crea, si el webhook aún no llegó) el pedido. */
export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale } = await params;
  const { session_id: sessionId } = await searchParams;
  const t = getT(locale);
  let token: string | null = null;
  if (sessionId) {
    const [order] = await db.select({ token: schema.orders.accessToken }).from(schema.orders).where(eq(schema.orders.stripeSessionId, sessionId));
    token = order?.token ?? null;
    const s = stripe();
    if (!token && s && sessionId.startsWith("cs_")) {
      try {
        const session = await s.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") token = (await createOrderFromCheckout(normalizeSession(session))).accessToken;
      } catch (err) {
        console.error("confirmación: no se pudo recuperar la sesión", err);
      }
    }
  }
  if (token) redirect(`/${locale}/pedido/${token}`);
  return (
    <div className="container-page py-20 text-center">
      <AutoRefresh seconds={4} />
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{t("order.thanks")}</h1>
      <p className="mt-4 text-stone-600">{t("order.notFound")}</p>
    </div>
  );
}
