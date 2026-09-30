"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { translator, type Messages } from "@/lib/i18n";
import { formatPrice } from "@/lib/money";

export interface CartLineView {
  id: string;
  title: string;
  description: string;
  finishName: string;
  physical: boolean;
  quantity: number;
  unitPriceCents: number | null;
  editHref: string;
}

export function CartClient({
  locale,
  messages,
  lines,
  subtotalCents,
  hasDigital,
  hasPhysical,
  countries,
  shippingNote,
}: {
  locale: string;
  messages: Messages;
  lines: CartLineView[];
  subtotalCents: number;
  hasDigital: boolean;
  hasPhysical: boolean;
  countries: { code: string; name: string }[];
  shippingNote: string;
}) {
  const t = translator(messages);
  const router = useRouter();
  const [waiver, setWaiver] = useState(false);
  const [terms, setTerms] = useState(false);
  const [country, setCountry] = useState("ES");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [busyLine, setBusyLine] = useState<string | null>(null);

  const setQty = async (id: string, quantity: number) => {
    setBusyLine(id);
    await fetch("/api/cart", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id, quantity }) });
    setBusyLine(null);
    window.dispatchEvent(new Event("cart:changed"));
    router.refresh();
  };

  const checkout = async () => {
    setState("loading");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, digitalWaiver: waiver, termsAccepted: terms, shippingCountry: hasPhysical ? country : null }),
    });
    if (!res.ok) return setState("error");
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  };

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-600">{t("cart.empty")}</p>
        <Link href={`/${locale}/crear`} className="btn-primary mt-6 inline-block">
          {t("cart.startDesigning")}
        </Link>
      </div>
    );
  }

  const canPay = terms && (!hasDigital || waiver) && lines.every((l) => l.unitPriceCents !== null);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <ul className="divide-y divide-stone-200 border-y border-stone-200">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-4 py-5" data-testid="cart-line">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.title}</p>
              <p className="text-sm text-stone-500">{l.description}</p>
              <p className="text-sm text-stone-500">{l.finishName}</p>
              <Link href={l.editHref} className="text-xs underline">
                {t("cart.edit")}
              </Link>
            </div>
            {l.physical ? (
              <label className="text-xs text-stone-600">
                {t("cart.quantity")}
                <select className="input ml-2 !w-auto !py-1" value={l.quantity} disabled={busyLine === l.id} onChange={(e) => setQty(l.id, Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <span className="w-24 text-right text-sm">{l.unitPriceCents !== null ? formatPrice(l.unitPriceCents * l.quantity, locale) : "—"}</span>
            <button type="button" className="text-xs underline" disabled={busyLine === l.id} onClick={() => setQty(l.id, 0)}>
              {t("cart.remove")}
            </button>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded border border-stone-200 bg-white p-6">
        <div className="flex justify-between text-sm">
          <span>{t("cart.subtotal")}</span>
          <span className="font-medium" data-testid="subtotal">
            {formatPrice(subtotalCents, locale)}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">{t("cart.vatIncluded")}</p>
        {hasPhysical && (
          <>
            <p className="mt-3 text-xs text-stone-500">{shippingNote}</p>
            <label className="mt-3 block text-xs text-stone-600">
              <span className="label">{t("order.shipping")}</span>
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} data-testid="country">
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {hasDigital && (
          <label className="mt-5 flex gap-2 text-xs leading-relaxed text-stone-700">
            <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} data-testid="waiver" className="mt-0.5" />
            <span>{t("cart.waiver")}</span>
          </label>
        )}
        <label className="mt-3 flex gap-2 text-xs text-stone-700">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} data-testid="terms" className="mt-0.5" />
          <span>
            <Link href={`/${locale}/legal/condiciones`} className="underline" target="_blank">
              {t("cart.terms")}
            </Link>
          </span>
        </label>
        <button type="button" className="btn-primary mt-6 w-full" disabled={!canPay || state === "loading"} onClick={checkout} data-testid="checkout">
          {state === "loading" ? t("cart.redirecting") : t("cart.checkout")}
        </button>
        {state === "error" && <p className="mt-2 text-xs text-red-700">{t("cart.checkoutError")}</p>}
      </aside>
    </div>
  );
}
