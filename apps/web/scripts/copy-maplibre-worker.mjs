// MapLibre v6 lanza su web worker como módulo ES con una URL relativa a su propio bundle,
// que Turbopack no emite. Copiamos el worker y su chunk compartido a public/ y los servimos desde ahí
// (ver setWorkerUrl en src/components/PosterPreview.tsx).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = new URL("../public/maplibre/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(path.join(dist, f), path.join(out, f));
console.log("maplibre worker copiado a public/maplibre/");
