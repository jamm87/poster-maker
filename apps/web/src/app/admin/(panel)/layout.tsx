import Link from "next/link";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/admin";

const NAV = [
  ["/admin/pedidos", "Pedidos"],
  ["/admin/trabajos", "Renders"],
  ["/admin/catalogo", "Catálogo"],
  ["/admin/precios", "Precios y Gelato"],
  ["/admin/emails", "Emails"],
] as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const e = env();
  const warnings = [
    !e.STRIPE_SECRET_KEY && "Stripe no configurado: el checkout simula el pago (sólo desarrollo).",
    !e.GELATO_API_KEY && "Gelato no configurado: los pedidos físicos se simulan.",
    e.GELATO_API_KEY && e.GELATO_ORDER_TYPE === "draft" && "Gelato en modo borrador: los pedidos NO se imprimen hasta aprobarlos en Gelato.",
    !e.RESEND_API_KEY && "Resend no configurado: los emails sólo se registran en «Emails».",
  ].filter(Boolean);
  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 bg-stone-900 p-5 text-stone-200">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.3em]">{e.BRAND_NAME}</p>
        <nav className="space-y-2">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="block hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <form action="/api/auth/admin-logout" method="post" className="mt-10">
          <button className="text-xs text-stone-400 hover:text-white">Cerrar sesión</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1 p-8">
        {warnings.map((w) => (
          <p key={String(w)} className="mb-2 rounded bg-amber-100 px-3 py-2 text-xs text-amber-900">
            {w}
          </p>
        ))}
        {children}
      </div>
    </div>
  );
}
