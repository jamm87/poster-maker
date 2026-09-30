import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Badge, dt, statusTone, Table } from "@/components/admin";
import { requireAdmin } from "@/lib/admin";
import { db, schema } from "@/lib/db";
import { retryJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

async function retry(formData: FormData) {
  "use server";
  await requireAdmin();
  await retryJob(String(formData.get("jobId")));
  revalidatePath("/admin/trabajos");
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const q = db.select().from(schema.renderJobs);
  const jobs = await (status ? q.where(eq(schema.renderJobs.status, status as "queued")) : q).orderBy(desc(schema.renderJobs.createdAt)).limit(150);
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Trabajos de render</h1>
      <p className="mb-4 space-x-3 text-xs">
        {["", "queued", "running", "done", "failed"].map((s) => (
          <a key={s} href={`/admin/trabajos${s ? `?status=${s}` : ""}`} className={status === s || (!status && !s) ? "font-semibold" : "underline"}>
            {s || "todos"}
          </a>
        ))}
      </p>
      <Table head={["Creado", "Tipo", "Acabado", "Título", "Estado", "Intentos", "Duración", "Error", ""]}>
        {jobs.map((j) => (
          <tr key={j.id}>
            <td className="px-3 py-2">{dt(j.createdAt)}</td>
            <td className="px-3 py-2">{j.kind}</td>
            <td className="px-3 py-2">{j.finish}</td>
            <td className="px-3 py-2">
              {j.spec.texts.title} · {j.spec.formatId}
            </td>
            <td className="px-3 py-2">
              <Badge tone={statusTone(j.status)}>{j.status}</Badge>
            </td>
            <td className="px-3 py-2">
              {j.attempts}/{j.maxAttempts}
            </td>
            <td className="px-3 py-2">{j.durationMs ? `${(j.durationMs / 1000).toFixed(1)} s` : "—"}</td>
            <td className="max-w-xs px-3 py-2 text-[10px] text-red-700">{j.error?.split("\n")[0]}</td>
            <td className="px-3 py-2">
              {j.status === "failed" && (
                <form action={retry}>
                  <input type="hidden" name="jobId" value={j.id} />
                  <button className="underline">Reintentar</button>
                </form>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
