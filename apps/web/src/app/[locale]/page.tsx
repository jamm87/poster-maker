import Link from "next/link";
import { PosterCard } from "@/components/PosterCard";
import { cityName, cityPreviewUrls, citySpec, listCities } from "@/lib/catalog";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getT(locale);
  const featured = (await listCities({ featuredOnly: true })).slice(0, 8);
  const previews = await cityPreviewUrls(featured);

  return (
    <>
      <section className="container-page grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-5xl">{t("home.heroTitle")}</h1>
          <p className="mt-6 max-w-lg text-stone-600">{t("home.heroSubtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${locale}/crear`} className="btn-primary">
              {t("home.ctaCreate")}
            </Link>
            <Link href={`/${locale}/posters`} className="btn-secondary !py-3">
              {t("home.ctaCatalog")}
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {featured.slice(0, 2).map((c, i) => (
            <div key={c.slug} className={i === 1 ? "mt-12" : ""}>
              <PosterCard href={`/${locale}/poster/${c.slug}`} spec={citySpec(c, locale)} imageUrl={previews[c.slug]} caption={cityName(c, locale)} />
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white/60 py-16">
        <div className="container-page">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">{t("home.howTitle")}</h2>
          <ol className="mt-8 grid gap-10 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <span className="font-[family-name:var(--font-display)] text-3xl text-stone-400">0{n}</span>
                <h3 className="mt-2 font-medium">{t(`home.step${n}Title`)}</h3>
                <p className="mt-2 text-sm text-stone-600">{t(`home.step${n}Text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-stone-500">{t("home.featuredTitle")}</h2>
        <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4">
          {featured.map((c) => (
            <PosterCard key={c.slug} href={`/${locale}/poster/${c.slug}`} spec={citySpec(c, locale)} imageUrl={previews[c.slug]} caption={cityName(c, locale)} sub={locale === "en" ? c.countryEn : c.countryEs} />
          ))}
        </div>
      </section>

      <section className="container-page grid gap-8 py-8 md:grid-cols-2">
        <div className="rounded border border-stone-200 bg-white p-8">
          <h3 className="font-[family-name:var(--font-display)] text-2xl">{t("home.digitalTitle")}</h3>
          <p className="mt-3 text-sm text-stone-600">{t("home.digitalText")}</p>
        </div>
        <div className="rounded border border-stone-200 bg-white p-8">
          <h3 className="font-[family-name:var(--font-display)] text-2xl">{t("home.physicalTitle")}</h3>
          <p className="mt-3 text-sm text-stone-600">{t("home.physicalText")}</p>
        </div>
      </section>
    </>
  );
}
