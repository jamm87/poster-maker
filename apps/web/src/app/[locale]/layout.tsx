import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { env } from "@/lib/env";
import { getT, isLocale, LOCALES } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getT(locale);
  const brand = env().BRAND_NAME;
  return {
    metadataBase: new URL(env().PUBLIC_BASE_URL),
    title: { default: `${brand} · ${t("meta.title")}`, template: `%s · ${brand}` },
    description: t("meta.description"),
    alternates: { languages: { es: "/es", en: "/en" } },
    openGraph: { siteName: brand, locale: locale === "en" ? "en_GB" : "es_ES", type: "website" },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600&family=Roboto:wght@300;400;700&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">
        <SiteHeader locale={locale} />
        <main>{children}</main>
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
