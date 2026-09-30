import type { Metadata } from "next";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getFormat } from "@/lib/assets";
import { getT } from "@/lib/i18n";
import { formatPrice } from "@/lib/money";
import { loadOrderDetail } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  const t = getT(locale);
  const detail = await loadOrderDetail({ token });
  if (!detail) {
    return (
      <div className="container-page py-20 text-center">
        <p>{t("order.notFound")}</p>
      </div>
    );
  }
  const { order, items, fulfillment } = detail;
  const pending = items.some((i) => i.job && ["queued", "running"].includes(i.job.status));
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <div className="container-page max-w-3xl py-12">
      {pending && <AutoRefresh seconds={5} />}
      <p className="text-xs uppercase tracking-[0.3em] text-stone-500">{t("order.title", { number: order.number })}</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">{t("order.thanks")}</h1>
      {pending && <p className="mt-3 text-stone-600">{t("order.processing")}</p>}

      <h2 className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{t("order.items")}</h2>
      <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
        {items.map(({ item, job, download }) => {
          const expired = download && (download.expiresAt < new Date() || download.downloadCount >= download.maxDownloads);
          return (
            <li key={item.id} className="py-5" data-testid="order-item">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-stone-500">
                    {getFormat(item.formatId).label} · {t(`finishes.${item.finishId}.name` as never)} · ×{item.quantity}
                  </p>
                </div>
                <span className="text-sm">{formatPrice(item.unitPriceCents * item.quantity, locale)}</span>
              </div>
              {!item.physical && (
                <div className="mt-3 text-sm">
                  {job?.status === "done" && download && !expired ? (
                    <>
                      <div className="flex flex-wrap gap-3">
                        <a className="btn-secondary" href={`/api/download/${token}/${item.id}/png`} data-testid="download-png">
                          {t("order.downloadPng")}
                        </a>
                        <a className="btn-secondary" href={`/api/download/${token}/${item.id}/pdf`} data-testid="download-pdf">
                          {t("order.downloadPdf")}
                        </a>
                      </div>
                      <p className="mt-2 text-xs text-stone-500">
                        {t("order.downloadsLeft", { n: download.maxDownloads - download.downloadCount, date: fmtDate.format(download.expiresAt) })}
                      </p>
                    </>
                  ) : job?.status === "failed" ? (
                    <p className="text-red-700">{t("order.renderFailed")}</p>
                  ) : expired ? (
                    <p className="text-stone-600">{t("order.downloadExpired")}</p>
                  ) : (
                    <p className="text-stone-600">{t("order.rendering")}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="mt-6 space-y-1 text-sm">
        {order.shippingCents > 0 && (
          <div className="flex justify-between">
            <dt>{t("order.shipping")}</dt>
            <dd>{formatPrice(order.shippingCents, locale)}</dd>
          </div>
        )}
        <div className="flex justify-between font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(order.totalCents, locale)}</dd>
        </div>
      </dl>

      {fulfillment && (
        <div className="mt-10 rounded border border-stone-200 bg-white p-5 text-sm">
          <p className="font-medium">{t("order.shipping")}</p>
          <p className="mt-1 text-stone-600" data-testid="fulfillment-status">
            {t(`order.fulfillment.${fulfillment.status}` as never)}
          </p>
          {order.shippingAddress && (
            <p className="mt-2 text-xs text-stone-500">
              {order.shippingAddress.name}, {order.shippingAddress.line1}, {order.shippingAddress.postalCode} {order.shippingAddress.city} ({order.shippingAddress.country})
            </p>
          )}
          {fulfillment.trackingUrl && (
            <a className="mt-3 inline-block underline" href={fulfillment.trackingUrl} target="_blank" rel="noreferrer">
              {t("order.trackingLink")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
