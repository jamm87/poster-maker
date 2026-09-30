import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PosterCard } from "@/components/PosterCard";
import { cityName, cityPreviewUrls, citySpec, getCity } from "@/lib/catalog";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n";
import { formatPrice } from "@/lib/money";
import { getPriceTable, minPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const city = await getCity(slug);
  if (!city) return {};
  const t = getT(locale);
  const name = cityName(city, locale);
  return {
    title: t("catalog.cityTitle", { city: name }),
    description: (locale === "en" ? city.descriptionEn : city.descriptionEs) ?? t("catalog.cityIntro", { city: name }),
    alternates: { canonical: `/${locale}/poster/${slug}`, languages: { es: `/es/poster/${slug}`, en: `/en/poster/${slug}` } },
  };
}

const ALT_THEMES = ["noir", "blueprint", "japanese_ink", "pastel_dream", "midnight_blue", "forest"];

export default async function CityPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const city = await getCity(slug);
  if (!city) notFound();
  const t = getT(locale);
  const name = cityName(city, locale);
  const spec = citySpec(city, locale);
  const [previews, prices] = await Promise.all([cityPreviewUrls([city]), getPriceTable()]);
  const from = minPrice(prices);
  const alts = ALT_THEMES.filter((x) => x !== city.themeId).slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: t("catalog.cityTitle", { city: name }),
    description: t("catalog.cityIntro", { city: name }),
    brand: { "@type": "Brand", name: env().BRAND_NAME },
    offers: from !== null ? { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: (from / 100).toFixed(2), availability: "https://schema.org/InStock" } : undefined,
  };

  return (
    <div className="container-page py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid gap-12 md:grid-cols-[minmax(0,420px)_1fr]">
        <PosterCard href={`/${locale}/crear?city=${slug}`} spec={spec} imageUrl={previews[slug]} caption="" />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("catalog.cityTitle", { city: name })}</h1>
          <p className="mt-4 max-w-prose text-stone-600">
            {(locale === "en" ? city.descriptionEn : city.descriptionEs) ?? t("catalog.cityIntro", { city: name })}
          </p>
          {from !== null && <p className="mt-6 text-lg">{t("catalog.fromPrice", { price: formatPrice(from, locale) })}</p>}
          <Link href={`/${locale}/crear?city=${slug}`} className="btn-primary mt-8 inline-block">
            {t("catalog.customize")}
          </Link>
          <h2 className="mt-14 text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">{t("catalog.otherStyles", { city: name })}</h2>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {alts.map((themeId) => (
              <PosterCard
                key={themeId}
                href={`/${locale}/crear?city=${slug}&theme=${themeId}`}
                spec={citySpec(city, locale, themeId)}
                caption={t(`themeNames.${themeId}` as never)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
