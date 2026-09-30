import { desc } from "drizzle-orm";
import { dt } from "@/components/admin";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const emails = await db.select().from(schema.emailLog).orderBy(desc(schema.emailLog.createdAt)).limit(50);
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Emails enviados</h1>
      <div className="space-y-3">
        {emails.map((m) => (
          <details key={m.id} className="rounded bg-white p-3 shadow-sm">
            <summary className="cursor-pointer">
              {dt(m.createdAt)} · <strong>{m.subject}</strong> → {m.to} · {m.kind}{" "}
              {m.error ? <span className="text-red-700">({m.error})</span> : m.providerId ? `(Resend ${m.providerId})` : "(sólo registrado)"}
            </summary>
            <iframe srcDoc={m.html} className="mt-3 h-[480px] w-full border" sandbox="" title={m.subject} />
          </details>
        ))}
        {emails.length === 0 && <p className="text-stone-500">Aún no se ha enviado ningún email.</p>}
      </div>
    </>
  );
}
