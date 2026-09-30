import type { ReactNode } from "react";

export function Badge({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "green" | "amber" | "red" | "blue" }) {
  const cls = {
    stone: "bg-stone-200 text-stone-800",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  }[tone];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function statusTone(status: string): "stone" | "green" | "amber" | "red" | "blue" {
  if (["done", "fulfilled", "shipped", "delivered"].includes(status)) return "green";
  if (["failed", "needs_attention", "canceled"].includes(status)) return "red";
  if (["running", "in_production", "submitted"].includes(status)) return "blue";
  if (["queued", "pending", "paid"].includes(status)) return "amber";
  return "stone";
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded bg-white shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-stone-200 bg-stone-50 uppercase tracking-wide text-stone-500">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}

export const dt = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(d) : "—");
