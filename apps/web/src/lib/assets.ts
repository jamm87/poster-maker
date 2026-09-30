import { fonts, formats, layout, markers, themes, type Palette, THEME_KEYS } from "@poster/themes";

export { fonts, formats, layout, markers, themes, THEME_KEYS };
export type { Palette };

export type FormatId = (typeof formats.formats)[number]["id"];
export type FinishId = (typeof formats.finishes)[number]["id"];

export const FORMAT_IDS = formats.formats.map((f) => f.id);
export const FINISH_IDS = formats.finishes.map((f) => f.id);
export const THEME_IDS = Object.keys(themes);
export const FONT_FAMILIES = fonts.fonts.map((f) => f.family);

export function getFormat(id: string) {
  const f = formats.formats.find((x) => x.id === id);
  if (!f) throw new Error(`Formato desconocido: ${id}`);
  return f;
}

export function getFinish(id: string) {
  const f = formats.finishes.find((x) => x.id === id);
  if (!f) throw new Error(`Acabado desconocido: ${id}`);
  return f;
}

export function isPhysical(finishId: string): boolean {
  return getFinish(finishId).physical;
}

/** Medidas del área de corte en cm según orientación. */
export function trimSizeCm(formatId: string, orientation: "portrait" | "landscape"): [number, number] {
  const f = getFormat(formatId);
  return orientation === "landscape" ? [f.heightCm, f.widthCm] : [f.widthCm, f.heightCm];
}
