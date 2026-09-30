import { frameFixtures } from "@poster/themes";
import { describe, expect, it } from "vitest";
import { metersPerPixel, trimBbox, widthForZoom, zoomForWidth } from "@/lib/frame";

describe("encuadre compartido con el renderer", () => {
  for (const c of frameFixtures.cases) {
    it(`coincide con Python (tmerc) en ${c.name}`, () => {
      const [w, s, e, n] = trimBbox(c.lat, c.lon, c.widthMeters, c.trimW, c.trimH);
      const [ew, es, ee, en] = c.bbox;
      const tolX = (ee - ew) * 0.005;
      const tolY = (en - es) * 0.005;
      expect(Math.abs(w - ew)).toBeLessThan(tolX);
      expect(Math.abs(e - ee)).toBeLessThan(tolX);
      expect(Math.abs(s - es)).toBeLessThan(tolY);
      expect(Math.abs(n - en)).toBeLessThan(tolY);
    });
  }

  it("zoom y ancho son inversos", () => {
    const z = zoomForWidth(40.4, 6000, 800);
    expect(widthForZoom(40.4, z, 800)).toBeCloseTo(6000, 6);
    expect(metersPerPixel(0, 0)).toBeCloseTo(78271.517, 2);
  });
});
