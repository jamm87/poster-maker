import type { Metadata } from "next";
import { Configurator } from "@/components/Configurator";
import { FINISH_IDS } from "@/lib/assets";
import { citySpec, getCity } from "@/lib/catalog";
import { getMessages, getT } from "@/lib/i18n";
import { getPriceTable } from "@/lib/pricing";
import { decodeSpecParam, posterSpecSchema, type PosterSpec } from "@/lib/spec";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getT(locale)("configurator.title") };
}

const DEFAULT_SPEC = (locale: string): PosterSpec =>
  posterSpecSchema.parse({
    center: { lat: 40.4168, lon: -3.7038 },
    widthMeters: 9000,
    formatId: "30x40",
    themeId: "terracotta",
    texts: { title: "Madrid", subtitle: locale === "en" ? "Spain" : "España" },
  });

export default async function CreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  let spec: PosterSpec | null = sp.d ? decodeSpecParam(sp.d) : null;
  if (!spec && sp.city) {
    const city = await getCity(sp.city);
    if (city) spec = citySpec(city, locale);
  }
  spec ??= DEFAULT_SPEC(locale);
  if (sp.theme && !sp.d) {
    const withTheme = posterSpecSchema.safeParse({ ...spec, themeId: sp.theme });
    if (withTheme.success) spec = withTheme.data;
  }
  const finish = sp.f && FINISH_IDS.includes(sp.f) ? sp.f : "paper";
  const prices = await getPriceTable();
  const t = getT(locale);

  return (
    <div className="container-page py-10">
      <h1 className="mb-8 font-[family-name:var(--font-display)] text-3xl">{t("configurator.title")}</h1>
      <Configurator locale={locale} messages={getMessages(locale)} initialSpec={spec} initialFinish={finish} prices={prices} />
    </div>
  );
}
