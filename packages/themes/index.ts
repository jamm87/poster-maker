// Generado: importa los recursos JSON compartidos (fuente única para web y renderer).
import autumn from "./themes/autumn.json";
import blueprint from "./themes/blueprint.json";
import contrastzones from "./themes/contrast_zones.json";
import copperpatina from "./themes/copper_patina.json";
import emerald from "./themes/emerald.json";
import forest from "./themes/forest.json";
import gradientroads from "./themes/gradient_roads.json";
import japaneseink from "./themes/japanese_ink.json";
import midnightblue from "./themes/midnight_blue.json";
import monochromeblue from "./themes/monochrome_blue.json";
import neoncyberpunk from "./themes/neon_cyberpunk.json";
import noir from "./themes/noir.json";
import ocean from "./themes/ocean.json";
import pasteldream from "./themes/pastel_dream.json";
import sunset from "./themes/sunset.json";
import terracotta from "./themes/terracotta.json";
import warmbeige from "./themes/warm_beige.json";
import formatsJson from "./formats.json";
import layoutJson from "./layout.json";
import fontsJson from "./fonts.json";
import markersJson from "./markers.json";
import frameFixtures from "./frame-fixtures.json";

export const THEME_KEYS = ["bg","text","gradient_color","water","parks","road_motorway","road_primary","road_secondary","road_tertiary","road_residential","road_default"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export type Palette = Record<ThemeKey, string>;
export type Theme = Palette & { name: string; description: string };

export const themes: Record<string, Theme> = {
  autumn: autumn,
  blueprint: blueprint,
  contrast_zones: contrastzones,
  copper_patina: copperpatina,
  emerald: emerald,
  forest: forest,
  gradient_roads: gradientroads,
  japanese_ink: japaneseink,
  midnight_blue: midnightblue,
  monochrome_blue: monochromeblue,
  neon_cyberpunk: neoncyberpunk,
  noir: noir,
  ocean: ocean,
  pastel_dream: pasteldream,
  sunset: sunset,
  terracotta: terracotta,
  warm_beige: warmbeige,
};

export const formats = formatsJson;
export const layout = layoutJson;
export const fonts = fontsJson;
export const markers = markersJson;
export { frameFixtures };
