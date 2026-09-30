import Link from "next/link";
import { currentCartId, loadCart } from "@/lib/cart";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n";
import { CartCount } from "./CartCount";

export async function SiteHeader({ locale }: { locale: string }) {
  const t = getT(locale);
  let count = 0;
  try {
    count = (await loadCart(await currentCartId())).count;
  } catch {
    /* sin BD disponible (p. ej. durante el build) */
  }
  return (
    <header className="border-b border-stone-200">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href={`/${locale}`} className="text-sm font-semibold uppercase tracking-[0.35em]">
          {env().BRAND_NAME}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href={`/${locale}/posters`} className="hidden sm:inline hover:underline">
            {t("nav.catalog")}
          </Link>
          <Link href={`/${locale}/crear`} className="hover:underline">
            {t("nav.create")}
          </Link>
          <Link href={`/${locale}/carrito`} className="flex items-center hover:underline" data-testid="cart-link">
            {t("nav.cart")}
            <CartCount initial={count} />
          </Link>
          <Link href={`/${t("nav.languageHref")}`} className="text-xs text-stone-500 hover:underline" hrefLang={t("nav.languageHref")}>
            {t("nav.language")}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ locale }: { locale: string }) {
  const t = getT(locale);
  const legal = [
    ["aviso-legal", t("footer.legal")],
    ["privacidad", t("footer.privacy")],
    ["cookies", t("footer.cookies")],
    ["condiciones", t("footer.terms")],
  ] as const;
  return (
    <footer className="mt-24 border-t border-stone-200 py-10 text-xs text-stone-500">
      <div className="container-page flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div>
          <p className="font-semibold uppercase tracking-[0.3em] text-stone-700">{env().BRAND_NAME}</p>
          <p className="mt-2 max-w-sm">{t("footer.about")}</p>
          <p className="mt-2">{t("footer.osm")}</p>
        </div>
        <ul className="flex flex-wrap gap-4">
          {legal.map(([slug, label]) => (
            <li key={slug}>
              <Link href={`/${locale}/legal/${slug}`} className="hover:underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
