import { desc } from "drizzle-orm";
import Link from "next/link";
import { Badge, dt, statusTone, Table } from "@/components/admin";
import { db, schema } from "@/lib/db";
import { formatPrice } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(200);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <a href="/api/admin/export" className="btn-secondary">
          Exportar CSV (gestoría)
        </a>
      </div>
      <Table head={["Nº", "Fecha", "Cliente", "País", "Total", "Estado"]}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/pedidos/${o.id}`} className="font-medium underline">
                {o.number}
              </Link>
            </td>
            <td className="px-3 py-2">{dt(o.createdAt)}</td>
            <td className="px-3 py-2">{o.email}</td>
            <td className="px-3 py-2">{o.shippingAddress?.country ?? o.billingCountry ?? "—"}</td>
            <td className="px-3 py-2">{formatPrice(o.totalCents)}</td>
            <td className="px-3 py-2">
              <Badge tone={statusTone(o.status)}>{o.status}</Badge>
            </td>
          </tr>
        ))}
        {orders.length === 0 && (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
              Aún no hay pedidos.
            </td>
          </tr>
        )}
      </Table>
    </>
  );
}
