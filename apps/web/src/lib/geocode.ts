import { env } from "./env";
import { suggestedWidth } from "./frame";

export interface GeoResult {
  label: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  widthMeters: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    type?: string;
    street?: string;
    housenumber?: string;
    extent?: [number, number, number, number]; // [minLon, maxLat, maxLon, minLat]
  };
}

const cache = new Map<string, { at: number; results: GeoResult[] }>();

/** Geocodificación con Photon (komoot). Respeta su uso justo: caché en memoria y límite por IP en la ruta. */
export async function geocode(q: string, locale: string): Promise<GeoResult[]> {
  const key = `${locale}:${q.toLowerCase().trim()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.results;
  const url = new URL(env().GEOCODER_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "7");
  // Photon admite de, en, fr; para español se usa el nombre local (default)
  if (locale === "en") url.searchParams.set("lang", "en");
  const res = await fetch(url, { headers: { "User-Agent": `${env().BRAND_NAME} poster shop (${env().CONTACT_EMAIL})` }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder ${res.status}`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  const results = data.features.map((f) => {
    const p = f.properties;
    const name = p.name ?? p.street ?? p.city ?? "";
    const extent = p.extent ? ([p.extent[0], p.extent[3], p.extent[2], p.extent[1]] as [number, number, number, number]) : undefined;
    const label = [name + (p.housenumber ? ` ${p.housenumber}` : ""), p.city !== name ? p.city : null, p.state, p.country].filter(Boolean).join(", ");
    return {
      label,
      name,
      country: p.country ?? "",
      lat: +f.geometry.coordinates[1].toFixed(6),
      lon: +f.geometry.coordinates[0].toFixed(6),
      widthMeters: suggestedWidth(extent, p.type),
    };
  });
  cache.set(key, { at: Date.now(), results });
  if (cache.size > 5000) cache.clear();
  return results;
}
