/** Ciudades iniciales del catálogo (España + capitales y ciudades icónicas de la UE). */
export interface SeedCity {
  slug: string;
  nameEs: string;
  nameEn: string;
  countryEs: string;
  countryEn: string;
  lat: number;
  lon: number;
  widthMeters: number;
  themeId: string;
  featured?: boolean;
}

export const SEED_CITIES: SeedCity[] = [
  { slug: "madrid", nameEs: "Madrid", nameEn: "Madrid", countryEs: "España", countryEn: "Spain", lat: 40.4168, lon: -3.7038, widthMeters: 9000, themeId: "terracotta", featured: true },
  { slug: "barcelona", nameEs: "Barcelona", nameEn: "Barcelona", countryEs: "España", countryEn: "Spain", lat: 41.3874, lon: 2.1686, widthMeters: 8000, themeId: "warm_beige", featured: true },
  { slug: "valencia", nameEs: "Valencia", nameEn: "Valencia", countryEs: "España", countryEn: "Spain", lat: 39.4699, lon: -0.3763, widthMeters: 8000, themeId: "ocean", featured: true },
  { slug: "sevilla", nameEs: "Sevilla", nameEn: "Seville", countryEs: "España", countryEn: "Spain", lat: 37.3891, lon: -5.9845, widthMeters: 7000, themeId: "sunset", featured: true },
  { slug: "bilbao", nameEs: "Bilbao", nameEn: "Bilbao", countryEs: "España", countryEn: "Spain", lat: 43.263, lon: -2.935, widthMeters: 6000, themeId: "forest" },
  { slug: "malaga", nameEs: "Málaga", nameEn: "Málaga", countryEs: "España", countryEn: "Spain", lat: 36.7213, lon: -4.4214, widthMeters: 7000, themeId: "pastel_dream" },
  { slug: "zaragoza", nameEs: "Zaragoza", nameEn: "Zaragoza", countryEs: "España", countryEn: "Spain", lat: 41.6488, lon: -0.8891, widthMeters: 7000, themeId: "copper_patina" },
  { slug: "granada", nameEs: "Granada", nameEn: "Granada", countryEs: "España", countryEn: "Spain", lat: 37.1773, lon: -3.5986, widthMeters: 5000, themeId: "autumn" },
  { slug: "san-sebastian", nameEs: "San Sebastián", nameEn: "San Sebastián", countryEs: "España", countryEn: "Spain", lat: 43.3183, lon: -1.9812, widthMeters: 5000, themeId: "blueprint" },
  { slug: "palma", nameEs: "Palma", nameEn: "Palma", countryEs: "España", countryEn: "Spain", lat: 39.5696, lon: 2.6502, widthMeters: 7000, themeId: "ocean" },
  { slug: "santiago-de-compostela", nameEs: "Santiago de Compostela", nameEn: "Santiago de Compostela", countryEs: "España", countryEn: "Spain", lat: 42.8782, lon: -8.5448, widthMeters: 4000, themeId: "emerald" },
  { slug: "salamanca", nameEs: "Salamanca", nameEn: "Salamanca", countryEs: "España", countryEn: "Spain", lat: 40.9701, lon: -5.6635, widthMeters: 4000, themeId: "warm_beige" },
  { slug: "cadiz", nameEs: "Cádiz", nameEn: "Cádiz", countryEs: "España", countryEn: "Spain", lat: 36.5271, lon: -6.2886, widthMeters: 4000, themeId: "midnight_blue" },
  { slug: "toledo", nameEs: "Toledo", nameEn: "Toledo", countryEs: "España", countryEn: "Spain", lat: 39.8628, lon: -4.0273, widthMeters: 3500, themeId: "japanese_ink" },
  { slug: "paris", nameEs: "París", nameEn: "Paris", countryEs: "Francia", countryEn: "France", lat: 48.8566, lon: 2.3522, widthMeters: 10000, themeId: "pastel_dream", featured: true },
  { slug: "roma", nameEs: "Roma", nameEn: "Rome", countryEs: "Italia", countryEn: "Italy", lat: 41.9028, lon: 12.4964, widthMeters: 8000, themeId: "warm_beige", featured: true },
  { slug: "amsterdam", nameEs: "Ámsterdam", nameEn: "Amsterdam", countryEs: "Países Bajos", countryEn: "Netherlands", lat: 52.3676, lon: 4.9041, widthMeters: 6000, themeId: "ocean", featured: true },
  { slug: "venecia", nameEs: "Venecia", nameEn: "Venice", countryEs: "Italia", countryEn: "Italy", lat: 45.4408, lon: 12.3155, widthMeters: 4000, themeId: "blueprint", featured: true },
  { slug: "lisboa", nameEs: "Lisboa", nameEn: "Lisbon", countryEs: "Portugal", countryEn: "Portugal", lat: 38.7223, lon: -9.1393, widthMeters: 8000, themeId: "sunset" },
  { slug: "oporto", nameEs: "Oporto", nameEn: "Porto", countryEs: "Portugal", countryEn: "Portugal", lat: 41.1579, lon: -8.6291, widthMeters: 6000, themeId: "copper_patina" },
  { slug: "berlin", nameEs: "Berlín", nameEn: "Berlin", countryEs: "Alemania", countryEn: "Germany", lat: 52.52, lon: 13.405, widthMeters: 14000, themeId: "noir" },
  { slug: "munich", nameEs: "Múnich", nameEn: "Munich", countryEs: "Alemania", countryEn: "Germany", lat: 48.1351, lon: 11.582, widthMeters: 10000, themeId: "forest" },
  { slug: "viena", nameEs: "Viena", nameEn: "Vienna", countryEs: "Austria", countryEn: "Austria", lat: 48.2082, lon: 16.3738, widthMeters: 9000, themeId: "midnight_blue" },
  { slug: "praga", nameEs: "Praga", nameEn: "Prague", countryEs: "Chequia", countryEn: "Czechia", lat: 50.0755, lon: 14.4378, widthMeters: 8000, themeId: "autumn" },
  { slug: "budapest", nameEs: "Budapest", nameEn: "Budapest", countryEs: "Hungría", countryEn: "Hungary", lat: 47.4979, lon: 19.0402, widthMeters: 8000, themeId: "copper_patina" },
  { slug: "bruselas", nameEs: "Bruselas", nameEn: "Brussels", countryEs: "Bélgica", countryEn: "Belgium", lat: 50.8503, lon: 4.3517, widthMeters: 8000, themeId: "monochrome_blue" },
  { slug: "copenhague", nameEs: "Copenhague", nameEn: "Copenhagen", countryEs: "Dinamarca", countryEn: "Denmark", lat: 55.6761, lon: 12.5683, widthMeters: 9000, themeId: "gradient_roads" },
  { slug: "estocolmo", nameEs: "Estocolmo", nameEn: "Stockholm", countryEs: "Suecia", countryEn: "Sweden", lat: 59.3293, lon: 18.0686, widthMeters: 10000, themeId: "ocean" },
  { slug: "dublin", nameEs: "Dublín", nameEn: "Dublin", countryEs: "Irlanda", countryEn: "Ireland", lat: 53.3498, lon: -6.2603, widthMeters: 9000, themeId: "emerald" },
  { slug: "atenas", nameEs: "Atenas", nameEn: "Athens", countryEs: "Grecia", countryEn: "Greece", lat: 37.9838, lon: 23.7275, widthMeters: 9000, themeId: "terracotta" },
];
