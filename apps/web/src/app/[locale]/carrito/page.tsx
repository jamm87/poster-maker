import type { Metadata } from "next";
import { CartClient } from "@/components/CartClient";
import { getFormat } from "@/lib/assets";
import { currentCartId, loadCart } from "@/lib/cart";
import { env } from "@/lib/env";
import { getMessages, getT } from "@/lib/i18n";
import { formatPrice } from "@/lib/money";
import { encodeSpecParam } from "@/lib/spec";
import { EU_COUNTRIES } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getT(locale)("cart.title"), robots: { index: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getT(locale);
  const cart = await loadCart(await currentCartId());
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const countries = EU_COUNTRIES.map((code) => ({ code, name: regionNames.of(code) ?? code })).sort((a, b) =>
    a.code === "ES" ? -1 : b.code === "ES" ? 1 : a.name.localeCompare(b.name, locale),
  );
  const e = env();
  const lines = cart.lines.map((l) => ({
    id: l.id,
    title: l.spec.texts.title,
    description: `${getFormat(l.formatId).label} · ${l.spec.orientation === "landscape" ? t("configurator.landscape") : t("configurator.portrait")} · ${t(`themeNames.${l.spec.themeId}` as never)}`,
    finishName: t(`finishes.${l.finishId}.name` as never),
    physical: l.physical,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    editHref: `/${locale}/crear?d=${encodeSpecParam(l.spec)}&f=${l.finishId}`,
  }));
  return (
    <div className="container-page py-12">
      <h1 className="mb-8 font-[family-name:var(--font-display)] text-3xl">{t("cart.title")}</h1>
      <CartClient
        locale={locale}
        messages={getMessages(locale)}
        lines={lines}
        subtotalCents={cart.subtotalCents}
        hasDigital={cart.hasDigital}
        hasPhysical={cart.hasPhysical}
        countries={countries}
        shippingNote={t("cart.shippingNote", { es: formatPrice(e.SHIPPING_ES_CENTS, locale), eu: formatPrice(e.SHIPPING_EU_CENTS, locale) })}
      />
    </div>
  );
}
