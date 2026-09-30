import { layout } from "./assets";

/** Tipografía del póster, idéntica a services/renderer/src/posterengine/render.py. */

export function isLatinScript(text: string): boolean {
  const alpha = Array.from(text).filter((c) => /\p{L}/u.test(c));
  if (alpha.length === 0) return true;
  return alpha.filter((c) => c.codePointAt(0)! < 0x250).length / alpha.length > 0.8;
}

export function titleText(title: string): string {
  if (!isLatinScript(title)) return title;
  return Array.from(title.toUpperCase()).join(" ".repeat(layout.title.letterSpacingSpaces));
}

export function titleSizeFrac(title: string): number {
  const n = Array.from(title).length;
  const t = layout.title;
  return n > t.shrinkAfterChars ? Math.max((t.size * t.shrinkAfterChars) / n, t.minSize) : t.size;
}

export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns} / ${Math.abs(lon).toFixed(4)}° ${ew}`;
}
