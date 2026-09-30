import { db, schema } from "./db";
import { env } from "./env";
import { formatPrice } from "./money";

/**
 * Envío de emails transaccionales con Resend (API HTTP, sin SDK).
 * Sin RESEND_API_KEY el email sólo se registra en email_log (visible en /admin/emails).
 */
export async function sendEmail(opts: { to: string; subject: string; html: string; kind: string; orderId?: string }) {
  const e = env();
  let providerId: string | null = null;
  let error: string | null = null;
  if (e.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: e.EMAIL_FROM, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: e.CONTACT_EMAIL }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) error = `Resend ${res.status}: ${body.message ?? "error"}`;
      providerId = body.id ?? null;
    } catch (err) {
      error = String(err);
    }
  } else {
    console.info(`[email:${opts.kind}] (sin RESEND_API_KEY, sólo registrado) → ${opts.to}: ${opts.subject}`);
  }
  await db.insert(schema.emailLog).values({ ...opts, orderId: opts.orderId ?? null, providerId, error });
  if (error) throw new Error(error);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(body: string): string {
  const brand = esc(env().BRAND_NAME);
  return `<!doctype html><html><body style="margin:0;background:#f5f2ed;font-family:Helvetica,Arial,sans-serif;color:#1c1b19">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:6px;padding:32px">
<tr><td style="font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#8a8378;padding-bottom:24px">${brand}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="font-size:12px;color:#8a8378;padding-top:32px">${esc(env().CONTACT_EMAIL)}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0"><a href="${esc(href)}" style="background:#1c1b19;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;display:inline-block">${esc(label)}</a></p>`;
}

interface OrderLike {
  id: string;
  number: string;
  email: string;
  locale: string;
  accessToken: string;
  totalCents: number;
  customerName: string | null;
}

export function orderUrl(order: Pick<OrderLike, "locale" | "accessToken">): string {
  return `${env().PUBLIC_BASE_URL}/${order.locale}/pedido/${order.accessToken}`;
}

const COPY = {
  es: {
    confirmSubject: (n: string) => `Pedido ${n} confirmado`,
    confirmBody: (name: string, n: string, total: string, digital: boolean, physical: boolean) =>
      `<h1 style="font-size:22px;font-weight:normal">¡Gracias${name ? `, ${esc(name)}` : ""}!</h1>
       <p>Hemos recibido tu pedido <strong>${esc(n)}</strong> por <strong>${total}</strong>.</p>
       ${digital ? "<p>Estamos generando tus archivos en alta resolución. Te enviaremos otro email en cuanto estén listos para descargar (normalmente en pocos minutos).</p>" : ""}
       ${physical ? "<p>Tu póster impreso pasará a producción en cuanto tengamos listo el archivo de impresión. Te avisaremos cuando salga hacia tu dirección.</p>" : ""}`,
    view: "Ver mi pedido",
    downloadsSubject: (n: string) => `Tus pósters están listos · ${n}`,
    downloadsBody: (days: number) =>
      `<h1 style="font-size:22px;font-weight:normal">Tus archivos están listos</h1>
       <p>Ya puedes descargar tus pósters en PNG (alta resolución) y PDF vectorial. El enlace es válido durante ${days} días.</p>`,
    download: "Descargar mis archivos",
    shippedSubject: (n: string) => `Tu pedido ${n} está en camino`,
    shippedBody: (tracking: string | null) =>
      `<h1 style="font-size:22px;font-weight:normal">¡Tu póster está en camino!</h1>
       <p>Ha salido de la imprenta y va hacia tu dirección.</p>${tracking ? button(tracking, "Seguir el envío") : ""}`,
  },
  en: {
    confirmSubject: (n: string) => `Order ${n} confirmed`,
    confirmBody: (name: string, n: string, total: string, digital: boolean, physical: boolean) =>
      `<h1 style="font-size:22px;font-weight:normal">Thank you${name ? `, ${esc(name)}` : ""}!</h1>
       <p>We have received your order <strong>${esc(n)}</strong> for <strong>${total}</strong>.</p>
       ${digital ? "<p>We are rendering your high-resolution files. We will email you again as soon as they are ready to download (usually within a few minutes).</p>" : ""}
       ${physical ? "<p>Your printed poster goes into production as soon as the print file is ready. We will let you know when it ships.</p>" : ""}`,
    view: "View my order",
    downloadsSubject: (n: string) => `Your posters are ready · ${n}`,
    downloadsBody: (days: number) =>
      `<h1 style="font-size:22px;font-weight:normal">Your files are ready</h1>
       <p>You can now download your posters as high-resolution PNG and vector PDF. The link is valid for ${days} days.</p>`,
    download: "Download my files",
    shippedSubject: (n: string) => `Your order ${n} is on its way`,
    shippedBody: (tracking: string | null) =>
      `<h1 style="font-size:22px;font-weight:normal">Your poster is on its way!</h1>
       <p>It has left the print shop and is heading to your address.</p>${tracking ? button(tracking, "Track shipment") : ""}`,
  },
} as const;

function copy(locale: string) {
  return locale === "en" ? COPY.en : COPY.es;
}

export async function sendOrderConfirmation(order: OrderLike, hasDigital: boolean, hasPhysical: boolean) {
  const c = copy(order.locale);
  await sendEmail({
    to: order.email,
    kind: "order_confirmation",
    orderId: order.id,
    subject: c.confirmSubject(order.number),
    html: layout(
      c.confirmBody(order.customerName ?? "", order.number, formatPrice(order.totalCents, order.locale), hasDigital, hasPhysical) +
        button(orderUrl(order), c.view),
    ),
  });
}

export async function sendDownloadsReady(order: OrderLike) {
  const c = copy(order.locale);
  await sendEmail({
    to: order.email,
    kind: "downloads_ready",
    orderId: order.id,
    subject: c.downloadsSubject(order.number),
    html: layout(c.downloadsBody(env().DOWNLOAD_DAYS) + button(orderUrl(order), c.download)),
  });
}

export async function sendShipped(order: OrderLike, trackingUrl: string | null) {
  const c = copy(order.locale);
  await sendEmail({
    to: order.email,
    kind: "shipped",
    orderId: order.id,
    subject: c.shippedSubject(order.number),
    html: layout(c.shippedBody(trackingUrl) + button(orderUrl(order), c.view)),
  });
}
