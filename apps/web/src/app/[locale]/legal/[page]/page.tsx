import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL } from "@/content/legal";
import { env } from "@/lib/env";

type Params = Promise<{ locale: string; page: string }>;

function doc(locale: string, page: string) {
  return LEGAL[locale === "en" ? "en" : "es"][page];
}

export function generateStaticParams() {
  return Object.keys(LEGAL.es).flatMap((page) => [{ locale: "es", page }, { locale: "en", page }]);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, page } = await params;
  const d = doc(locale, page);
  return d ? { title: d.title } : {};
}

export default async function LegalPage({ params }: { params: Params }) {
  const { locale, page } = await params;
  const d = doc(locale, page);
  if (!d) notFound();
  const e = env();
  return (
    <article className="container-page prose-legal max-w-3xl py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{d.title}</h1>
      <div className="mt-6">{d.body({ brand: e.BRAND_NAME, email: e.CONTACT_EMAIL, base: e.PUBLIC_BASE_URL })}</div>
    </article>
  );
}
