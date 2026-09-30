import { describe, expect, it } from "vitest";
import { buildGelatoOrder, mapGelatoStatus } from "@/lib/gelato";
import { buildMapStyle, roadWidthPx } from "@/lib/theme-to-maplibre";
import { buildCheckoutParams } from "@/lib/stripe";
import { themes } from "@/lib/assets";
import { resolvePalette, posterSpecSchema } from "@/lib/spec";
import type { CartView } from "@/lib/cart";

describe("estilo MapLibre desde el tema", () => {
  it("usa los colores del tema y la jerarquía de calles", () => {
    const style = buildMapStyle(resolvePalette({ themeId: "midnight_blue", colors: {} }), 600);
    const bg = style.layers.find((l) => l.id === "background")!;
    expect((bg as { paint: Record<string, unknown> }).paint["background-color"]).toBe(themes.midnight_blue.bg);
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf("road-motorway")).toBeGreaterThan(ids.indexOf("road-residential")); // principales encima
    expect(roadWidthPx("motorway", 600)).toBeGreaterThan(roadWidthPx("residential", 600));
  });
});

describe("Gelato", () => {
  it("construye el pedido con dirección y archivo", () => {
    const body = buildGelatoOrder(
      {
        orderReferenceId: "PM-1",
        customerReferenceId: "a@b.c",
        email: "a@b.c",
        address: { name: "Ana María López", line1: "Calle 1", postalCode: "28001", city: "Madrid", country: "ES" },
        items: [{ itemReferenceId: "i1", productUid: "uid", fileUrl: "https://x/y.png", quantity: 2 }],
      },
      "draft",
    );
    expect(body.orderType).toBe("draft");
    expect(body.shippingAddress.firstName).toBe("Ana");
    expect(body.shippingAddress.lastName).toBe("María López");
    expect(body.items[0].files[0].url).toBe("https://x/y.png");
  });
  it("mapea estados", () => {
    expect(mapGelatoStatus("in_production")).toBe("in_production");
    expect(mapGelatoStatus("shipped")).toBe("shipped");
    expect(mapGelatoStatus("desconocido")).toBeNull();
  });
});

describe("Stripe Checkout", () => {
  const spec = posterSpecSchema.parse({ center: { lat: 40, lon: -3 }, widthMeters: 6000, formatId: "50x70", themeId: "noir", texts: { title: "Madrid" } });
  const cart = (physical: boolean): CartView => ({
    id: "00000000-0000-0000-0000-000000000000",
    lines: [{ id: "l1", designId: "d1", spec, finishId: physical ? "framed" : "digital", formatId: "50x70", physical, quantity: 1, unitPriceCents: 10990 }],
    subtotalCents: 10990,
    hasPhysical: physical,
    hasDigital: !physical,
    count: 1,
  });

  it("digital: sin envío y con consentimiento en metadata", () => {
    const p = buildCheckoutParams({ cart: cart(false), locale: "es", waiverAt: "2026-09-29T10:00:00Z", shippingCountry: null });
    expect(p.shipping_address_collection).toBeUndefined();
    expect(p.metadata?.digitalWaiverAt).toBe("2026-09-29T10:00:00Z");
    expect(p.line_items?.[0].price_data?.unit_amount).toBe(10990);
    expect(p.line_items?.[0].price_data?.product_data?.name).toContain("Descarga digital");
  });

  it("físico a Francia: países UE sin España y tarifa UE", () => {
    const p = buildCheckoutParams({ cart: cart(true), locale: "en", waiverAt: null, shippingCountry: "FR" });
    const allowed = p.shipping_address_collection!.allowed_countries;
    expect(allowed).toContain("FR");
    expect(allowed).not.toContain("ES");
    expect(p.shipping_options?.[0].shipping_rate_data?.fixed_amount?.amount).toBe(990);
    expect(p.locale).toBe("en");
  });
});
