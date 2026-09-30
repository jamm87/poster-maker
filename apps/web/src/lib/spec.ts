import { z } from "zod";
import { FONT_FAMILIES, FORMAT_IDS, THEME_IDS, THEME_KEYS, themes, type Palette } from "./assets";

/** Espejo de services/renderer/src/posterengine/spec.py. Mantener sincronizados. */
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const colorsSchema = z
  .object(Object.fromEntries(THEME_KEYS.map((k) => [k, hex.optional()])) as Record<(typeof THEME_KEYS)[number], z.ZodOptional<typeof hex>>)
  .strict();

export const posterSpecSchema = z
  .object({
    version: z.literal(1).default(1),
    center: z.object({ lat: z.number().min(-85).max(85), lon: z.number().min(-180).max(180) }).strict(),
    widthMeters: z.number().min(500).max(60000),
    formatId: z.enum(FORMAT_IDS as [string, ...string[]]),
    orientation: z.enum(["portrait", "landscape"]).default("portrait"),
    themeId: z.enum(THEME_IDS as [string, ...string[]]),
    colors: colorsSchema.default({}),
    fontFamily: z.enum(FONT_FAMILIES as [string, ...string[]]).default("Roboto"),
    texts: z
      .object({
        title: z.string().trim().min(1).max(40),
        subtitle: z.string().max(60).default(""),
        coords: z.string().max(60).nullable().optional(),
        showCoords: z.boolean().default(true),
        dedication: z.string().max(80).default(""),
      })
      .strict(),
    markers: z
      .array(
        z
          .object({
            lat: z.number().min(-85).max(85),
            lon: z.number().min(-180).max(180),
            shape: z.enum(["pin", "heart", "star"]).default("heart"),
            color: hex.nullable().optional(),
          })
          .strict(),
      )
      .max(10)
      .default([]),
  })
  .strict();

export type PosterSpec = z.infer<typeof posterSpecSchema>;
export type PosterSpecInput = z.input<typeof posterSpecSchema>;
export type MarkerShape = PosterSpec["markers"][number]["shape"];

export function resolvePalette(spec: Pick<PosterSpec, "themeId" | "colors">): Palette {
  const base = themes[spec.themeId];
  const pal = Object.fromEntries(THEME_KEYS.map((k) => [k, base[k]])) as Palette;
  for (const k of THEME_KEYS) {
    const v = spec.colors?.[k];
    if (v) pal[k] = v;
  }
  return pal;
}

/** Serialización canónica (claves ordenadas) para deduplicar diseños y trabajos. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function specHash(spec: PosterSpec): Promise<string> {
  const data = new TextEncoder().encode(canonicalJson(spec));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Codificación compacta para compartir un diseño por URL (?d=...). */
export function encodeSpecParam(spec: PosterSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSpecParam(param: string): PosterSpec | null {
  try {
    const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = posterSpecSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
