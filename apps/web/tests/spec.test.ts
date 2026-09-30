import { describe, expect, it } from "vitest";
import { canonicalJson, decodeSpecParam, encodeSpecParam, posterSpecSchema, resolvePalette, specHash } from "@/lib/spec";
import { formatCoords, isLatinScript, titleSizeFrac, titleText } from "@/lib/poster-layout";
import { layout, themes } from "@/lib/assets";

const base = {
  center: { lat: 40.4168, lon: -3.7038 },
  widthMeters: 6000,
  formatId: "30x40",
  themeId: "noir",
  texts: { title: "Madrid", subtitle: "España" },
};

describe("PosterSpec", () => {
  it("aplica valores por defecto como el modelo pydantic", () => {
    const s = posterSpecSchema.parse(base);
    expect(s.orientation).toBe("portrait");
    expect(s.fontFamily).toBe("Roboto");
    expect(s.texts.showCoords).toBe(true);
    expect(s.markers).toEqual([]);
  });

  it.each([
    [{ themeId: "no-existe" }],
    [{ formatId: "99x99" }],
    [{ widthMeters: 10 }],
    [{ colors: { bg: "red" } }],
    [{ texts: { title: "  " } }],
    [{ extra: 1 }],
  ])("rechaza %j", (over) => {
    expect(posterSpecSchema.safeParse({ ...base, ...over }).success).toBe(false);
  });

  it("codifica y decodifica en URL (con acentos y emojis)", () => {
    const s = posterSpecSchema.parse({ ...base, texts: { title: "A Coruña", dedication: "Te quiero ❤" } });
    expect(decodeSpecParam(encodeSpecParam(s))).toEqual(s);
    expect(decodeSpecParam("basura")).toBeNull();
  });

  it("hash estable independiente del orden de claves", async () => {
    const a = posterSpecSchema.parse(base);
    const b = posterSpecSchema.parse({ texts: base.texts, themeId: "noir", formatId: "30x40", widthMeters: 6000, center: { lon: -3.7038, lat: 40.4168 } });
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(await specHash(a)).toBe(await specHash(b));
  });

  it("paleta: tema + sobrescrituras", () => {
    const pal = resolvePalette({ themeId: "noir", colors: { bg: "#123456" } });
    expect(pal.bg).toBe("#123456");
    expect(pal.text).toBe(themes.noir.text);
  });
});

describe("tipografía (paridad con render.py)", () => {
  it("espaciado de letras sólo en escritura latina", () => {
    expect(titleText("Paris")).toBe("P  A  R  I  S");
    expect(titleText("東京")).toBe("東京");
    expect(isLatinScript("São Paulo")).toBe(true);
    expect(isLatinScript("دبي")).toBe(false);
  });
  it("reduce el título largo", () => {
    expect(titleSizeFrac("Barcelona")).toBe(layout.title.size);
    expect(titleSizeFrac("Villanueva de la Cañada")).toBeLessThan(layout.title.size);
  });
  it("coordenadas", () => {
    expect(formatCoords(-33.86, 151.2)).toBe("33.8600° S / 151.2000° E");
    expect(formatCoords(40.4, -3.7)).toBe("40.4000° N / 3.7000° W");
  });
});
