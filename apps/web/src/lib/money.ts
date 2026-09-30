export function formatPrice(cents: number, locale = "es"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
}
