"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { layout, markers as markerShapes, trimSizeCm } from "@/lib/assets";
import { widthForZoom, zoomForWidth } from "@/lib/frame";
import { resolvePalette, type PosterSpec } from "@/lib/spec";
import { buildMapStyle } from "@/lib/theme-to-maplibre";
import { PosterOverlay } from "./PosterOverlay";

export interface FrameChange {
  center: { lat: number; lon: number };
  widthMeters: number;
}

function markerSvg(shape: keyof typeof markerShapes.shapes, fill: string, stroke: string): string {
  const pts = markerShapes.shapes[shape].map(([x, y]) => `${x},${-y}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -1 1 2" width="100%" height="100%" style="overflow:visible"><polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="0.06" stroke-linejoin="round"/></svg>`;
}

/**
 * Vista previa interactiva: mapa MapLibre (teselas vectoriales OpenFreeMap) con el tema del póster
 * + capa SVG de tipografía. Arrastrar/zoom cambia el encuadre (centro + ancho visible en metros).
 */
export function PosterPreview({
  spec,
  onFrameChange,
  onMarkerMove,
  interactive = true,
  watermark,
  errorText,
  maxHeight = "78vh",
}: {
  spec: PosterSpec;
  onFrameChange?: (f: FrameChange) => void;
  onMarkerMove?: (index: number, lat: number, lon: number) => void;
  interactive?: boolean;
  watermark?: string;
  errorText?: string;
  maxHeight?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRefs = useRef<MlMarker[]>([]);
  const lastEmitted = useRef<FrameChange | null>(null);
  const cbRef = useRef({ onFrameChange, onMarkerMove });
  cbRef.current = { onFrameChange, onMarkerMove };
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState(false);

  const [trimW, trimH] = trimSizeCm(spec.formatId, spec.orientation);
  const palette = useMemo(() => resolvePalette(spec), [spec]);
  const minSide = Math.min(size.w, size.h);

  // Tamaño del contenedor
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Tipografía de Google Fonts
  useEffect(() => {
    const id = `gf-${spec.fontFamily.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec.fontFamily)}:wght@300;400;700&display=swap`;
    document.head.appendChild(link);
  }, [spec.fontFamily]);

  // Crear el mapa una vez
  useEffect(() => {
    let cancelled = false;
    if (!mapDivRef.current || size.w === 0) return;
    if (mapRef.current) return;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      if (cancelled || !mapDivRef.current) return;
      const map = new maplibregl.Map({
        container: mapDivRef.current,
        style: buildMapStyle(palette, minSide),
        center: [spec.center.lon, spec.center.lat],
        zoom: zoomForWidth(spec.center.lat, spec.widthMeters, size.w),
        attributionControl: false,
        interactive,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxZoom: 17,
        minZoom: 7,
      });
      map.touchZoomRotate.disableRotation();
      map.on("error", (e) => {
        if (String(e.error?.message ?? "").match(/fetch|tile|load|network/i)) setError(true);
      });
      // Al redimensionar, MapLibre conserva el zoom y emite moveend: ese evento no debe cambiar el encuadre
      // (el ancho en metros del póster se conserva y el efecto de encuadre recalcula el zoom).
      let resizing = false;
      map.on("resize", () => {
        resizing = true;
      });
      map.on("moveend", () => {
        if (resizing) {
          resizing = false;
          return;
        }
        const c = map.getCenter();
        const frame = {
          center: { lat: +c.lat.toFixed(6), lon: +c.lng.toFixed(6) },
          widthMeters: Math.round(widthForZoom(c.lat, map.getZoom(), map.getContainer().clientWidth)),
        };
        lastEmitted.current = frame;
        cbRef.current.onFrameChange?.(frame);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w > 0]);

  useEffect(() => () => mapRef.current?.remove(), []);

  // Estilo (tema, colores, grosores según tamaño)
  useEffect(() => {
    mapRef.current?.setStyle(buildMapStyle(palette, minSide));
  }, [palette, minSide]);

  // Encuadre desde fuera (búsqueda, cambio de formato/orientación)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || size.w === 0) return;
    map.resize();
    const last = lastEmitted.current;
    const same =
      last &&
      Math.abs(last.center.lat - spec.center.lat) < 1e-6 &&
      Math.abs(last.center.lon - spec.center.lon) < 1e-6 &&
      Math.abs(last.widthMeters - spec.widthMeters) < 2;
    const zoom = zoomForWidth(spec.center.lat, spec.widthMeters, size.w);
    if (!same || Math.abs(map.getZoom() - zoom) > 0.01) {
      map.jumpTo({ center: [spec.center.lon, spec.center.lat], zoom });
    }
  }, [spec.center.lat, spec.center.lon, spec.widthMeters, size.w, size.h]);

  // Marcadores (arrastrables)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled) return;
      markerRefs.current.forEach((m) => m.remove());
      const px = layout.marker.size * minSide;
      markerRefs.current = spec.markers.map((mk, i) => {
        const el = document.createElement("div");
        el.style.width = `${px}px`;
        el.style.height = `${px * 2}px`;
        el.style.cursor = interactive ? "grab" : "default";
        el.innerHTML = markerSvg(mk.shape, mk.color || palette.text, palette.bg);
        const marker = new maplibregl.Marker({ element: el, anchor: "center", draggable: interactive })
          .setLngLat([mk.lon, mk.lat])
          .addTo(map);
        marker.on("dragend", () => {
          const p = marker.getLngLat();
          cbRef.current.onMarkerMove?.(i, +p.lat.toFixed(6), +p.lng.toFixed(6));
        });
        return marker;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [spec.markers, palette, minSide, interactive, size.w]);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full overflow-hidden shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)]"
      style={{ aspectRatio: `${trimW} / ${trimH}`, maxHeight, maxWidth: `calc(${maxHeight} * ${trimW / trimH})`, background: palette.bg }}
    >
      {/* .maplibregl-map fuerza position:relative; por eso el contenedor del mapa va dentro de un div absoluto */}
      <div className="absolute inset-0">
        <div ref={mapDivRef} className="h-full w-full" />
      </div>
      <PosterOverlay spec={spec} palette={palette} width={size.w} height={size.h} watermark={watermark} />
      {error && errorText && (
        <div className="absolute inset-x-0 top-0 bg-black/70 p-2 text-center text-xs text-white">{errorText}</div>
      )}
    </div>
  );
}
