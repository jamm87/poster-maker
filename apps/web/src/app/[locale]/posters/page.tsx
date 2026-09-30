import type { Metadata } from "next";
import { PosterCard } from "@/components/PosterCard";
import { cityName, cityPreviewUrls, citySpec, listCities } from "@/lib/catalog";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getT(locale);
  return { title: t("catalog.title"), description: t("catalog.subtitle"), alternates: { languages: { es: "/es/posters", en: "/en/posters" } } };
}

export default async function CatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getT(locale);
  const cities = await listCities();
  const previews = await cityPreviewUrls(cities);
  return (
    <div className="container-page py-12">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("catalog.title")}</h1>
      <p className="mt-3 text-stone-600">{t("catalog.subtitle")}</p>
      <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
        {cities.map((c) => (
          <PosterCard
            key={c.slug}
            href={`/${locale}/poster/${c.slug}`}
            spec={citySpec(c, locale)}
            imageUrl={previews[c.slug]}
            caption={cityName(c, locale)}
            sub={locale === "en" ? c.countryEn : c.countryEs}
          />
        ))}
      </div>
    </div>
  );
}
