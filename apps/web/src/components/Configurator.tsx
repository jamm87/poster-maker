"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FONT_FAMILIES, formats, THEME_IDS, THEME_KEYS, themes } from "@/lib/assets";
import { clampWidth } from "@/lib/frame";
import { translator, type Messages } from "@/lib/i18n";
import { formatPrice } from "@/lib/money";
import type { PriceTable } from "@/lib/pricing";
import { encodeSpecParam, resolvePalette, type MarkerShape, type PosterSpec } from "@/lib/spec";
import { PosterPreview, type FrameChange } from "./PosterPreview";

interface GeoResult {
  label: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  widthMeters: number;
}

type ProofState =
  | { status: "idle" }
  | { status: "queued" | "running"; jobId: string; position?: number }
  | { status: "done"; jobId: string; url: string }
  | { status: "failed" };

export function Configurator({
  locale,
  messages,
  initialSpec,
  initialFinish,
  prices,
}: {
  locale: string;
  messages: Messages;
  initialSpec: PosterSpec;
  initialFinish: string;
  prices: PriceTable;
}) {
  const t = useMemo(() => translator(messages), [messages]);
  const [spec, setSpec] = useState<PosterSpec>(initialSpec);
  const [finishId, setFinishId] = useState(initialFinish);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showColors, setShowColors] = useState(Object.keys(initialSpec.colors ?? {}).length > 0);
  const [cartState, setCartState] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [proof, setProof] = useState<ProofState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const palette = resolvePalette(spec);

  const update = useCallback((patch: Partial<PosterSpec>) => {
    setSpec((s) => ({ ...s, ...patch }));
    setCartState("idle");
    setProof({ status: "idle" });
  }, []);
  const updateTexts = (patch: Partial<PosterSpec["texts"]>) => update({ texts: { ...spec.texts, ...patch } });

  // Búsqueda con debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&locale=${locale}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: GeoResult[] };
        setResults(data.results ?? []);
      } catch {
        /* abortado */
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, locale]);

  const pickPlace = (r: GeoResult) => {
    update({
      center: { lat: r.lat, lon: r.lon },
      widthMeters: clampWidth(r.widthMeters),
      texts: { ...spec.texts, title: r.name.slice(0, 40), subtitle: r.country.slice(0, 60), coords: null },
    });
    setQuery("");
    setResults(null);
  };

  const onFrameChange = useCallback((f: FrameChange) => {
    setSpec((s) =>
      Math.abs(s.center.lat - f.center.lat) < 1e-6 && Math.abs(s.center.lon - f.center.lon) < 1e-6 && Math.abs(s.widthMeters - f.widthMeters) < 2
        ? s
        : { ...s, center: f.center, widthMeters: clampWidth(f.widthMeters) },
    );
    setProof({ status: "idle" });
  }, []);

  const onMarkerMove = useCallback((i: number, lat: number, lon: number) => {
    setSpec((s) => ({ ...s, markers: s.markers.map((m, j) => (j === i ? { ...m, lat, lon } : m)) }));
  }, []);

  // Prueba exacta: encolar y consultar estado
  const requestProof = async () => {
    setProof({ status: "queued", jobId: "" });
    const res = await fetch("/api/proofs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec }) });
    if (!res.ok) return setProof({ status: "failed" });
    const { jobId } = (await res.json()) as { jobId: string };
    setProof({ status: "queued", jobId });
  };
  const proofJobId = "jobId" in proof ? proof.jobId : "";
  useEffect(() => {
    if (!proofJobId || (proof.status !== "queued" && proof.status !== "running")) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/jobs/${proofJobId}`);
      if (!res.ok) return;
      const job = (await res.json()) as { status: string; url?: string; position?: number };
      if (job.status === "done" && job.url) setProof({ status: "done", jobId: proofJobId, url: job.url });
      else if (job.status === "failed") setProof({ status: "failed" });
      else setProof({ status: job.status as "queued" | "running", jobId: proofJobId, position: job.position });
    }, 3000);
    return () => clearInterval(timer);
  }, [proofJobId, proof.status]);

  const price = prices[finishId]?.[spec.formatId] ?? null;

  const addToCart = async () => {
    setCartState("adding");
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, finishId, locale }),
    });
    setCartState(res.ok ? "added" : "error");
    if (res.ok) window.dispatchEvent(new Event("cart:changed"));
  };

  const share = async () => {
    const url = `${window.location.origin}/${locale}/crear?d=${encodeSpecParam(spec)}&f=${finishId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addMarker = (shape: MarkerShape) =>
    update({ markers: [...spec.markers, { lat: spec.center.lat, lon: spec.center.lon, shape, color: null }].slice(0, 10) });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <PosterPreview
          spec={spec}
          onFrameChange={onFrameChange}
          onMarkerMove={onMarkerMove}
          watermark={t("configurator.previewWatermark")}
          errorText={t("configurator.mapError")}
        />
        <p className="mt-3 text-center text-xs text-stone-500">
          {t("configurator.zoomHint")} · {t("configurator.visibleWidth", { km: (spec.widthMeters / 1000).toFixed(1) })}
        </p>
        {proof.status === "done" && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">{t("configurator.proofReady")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proof.url} alt={t("configurator.proofReady")} className="w-full shadow-lg" data-testid="proof-image" />
          </div>
        )}
      </div>

      <div className="space-y-8">
        <Section title={t("configurator.sectionPlace")}>
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("configurator.searchPlaceholder")}
              className="input"
              aria-label={t("configurator.searchPlaceholder")}
            />
            {(results || searching) && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border border-stone-200 bg-white shadow-lg">
                {searching && <li className="px-3 py-2 text-sm text-stone-500">{t("configurator.searching")}</li>}
                {results?.length === 0 && !searching && <li className="px-3 py-2 text-sm text-stone-500">{t("configurator.noResults")}</li>}
                {results?.map((r) => (
                  <li key={`${r.lat},${r.lon},${r.label}`}>
                    <button type="button" onClick={() => pickPlace(r)} className="w-full px-3 py-2 text-left text-sm hover:bg-stone-100">
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section title={t("configurator.sectionStyle")}>
          <label className="label">{t("configurator.theme")}</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup">
            {THEME_IDS.map((id) => {
              const th = themes[id];
              const active = spec.themeId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ themeId: id, colors: {} })}
                  className={`group rounded border p-1 text-left ${active ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200 hover:border-stone-400"}`}
                >
                  <span className="relative block h-12 overflow-hidden rounded-sm" style={{ background: th.bg }}>
                    <span className="absolute left-1 right-1 top-3 h-[2px]" style={{ background: th.road_motorway }} />
                    <span className="absolute left-2 top-0 h-full w-[1px]" style={{ background: th.road_secondary }} />
                    <span className="absolute left-6 top-0 h-full w-[1px]" style={{ background: th.road_residential }} />
                    <span className="absolute bottom-2 left-1 right-4 h-3 rounded-full" style={{ background: th.water }} />
                    <span className="absolute right-1 top-5 h-4 w-4 rounded-sm" style={{ background: th.parks }} />
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-stone-700">{t(`themeNames.${id}` as never)}</span>
                </button>
              );
            })}
          </div>

          <button type="button" className="mt-4 text-sm underline" onClick={() => setShowColors((v) => !v)}>
            {t("configurator.customColors")}
          </button>
          {showColors && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {THEME_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-xs">
                  <input
                    type="color"
                    value={palette[k]}
                    onChange={(e) => update({ colors: { ...spec.colors, [k]: e.target.value.toUpperCase() } })}
                    className="h-7 w-9 cursor-pointer rounded border border-stone-300"
                  />
                  {t(`colorNames.${k}` as never)}
                </label>
              ))}
              <button type="button" className="col-span-2 mt-1 text-left text-xs underline" onClick={() => update({ colors: {} })}>
                {t("configurator.resetColors")}
              </button>
            </div>
          )}

          <label className="label mt-4" htmlFor="font">
            {t("configurator.font")}
          </label>
          <select id="font" className="input" value={spec.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })}>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Section>

        <Section title={t("configurator.sectionText")}>
          <Field label={t("configurator.titleLabel")}>
            <input className="input" maxLength={40} value={spec.texts.title} onChange={(e) => updateTexts({ title: e.target.value })} />
          </Field>
          <Field label={t("configurator.subtitleLabel")}>
            <input className="input" maxLength={60} value={spec.texts.subtitle} onChange={(e) => updateTexts({ subtitle: e.target.value })} />
          </Field>
          <Field label={t("configurator.dedicationLabel")}>
            <input
              className="input"
              maxLength={80}
              value={spec.texts.dedication}
              placeholder={t("configurator.dedicationPlaceholder")}
              onChange={(e) => updateTexts({ dedication: e.target.value })}
            />
          </Field>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={spec.texts.showCoords} onChange={(e) => updateTexts({ showCoords: e.target.checked })} />
            {t("configurator.showCoords")}
          </label>
          {spec.texts.showCoords && (
            <Field label={t("configurator.coordsLabel")}>
              <input
                className="input"
                maxLength={60}
                value={spec.texts.coords ?? ""}
                placeholder={t("configurator.coordsAuto")}
                onChange={(e) => updateTexts({ coords: e.target.value || null })}
              />
            </Field>
          )}
        </Section>

        <Section title={t("configurator.sectionMarkers")}>
          <div className="flex flex-wrap gap-2">
            {(["heart", "pin", "star"] as const).map((shape) => (
              <button key={shape} type="button" className="btn-secondary" onClick={() => addMarker(shape)} disabled={spec.markers.length >= 10}>
                + {t(`configurator.markerShape.${shape}`)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">{t("configurator.markerHint")}</p>
          <ul className="mt-3 space-y-2">
            {spec.markers.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <select
                  className="input !w-auto !py-1"
                  value={m.shape}
                  onChange={(e) => update({ markers: spec.markers.map((x, j) => (j === i ? { ...x, shape: e.target.value as MarkerShape } : x)) })}
                >
                  {(["heart", "pin", "star"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`configurator.markerShape.${s}`)}
                    </option>
                  ))}
                </select>
                <input
                  type="color"
                  value={m.color || palette.text}
                  onChange={(e) => update({ markers: spec.markers.map((x, j) => (j === i ? { ...x, color: e.target.value.toUpperCase() } : x)) })}
                  className="h-7 w-9 rounded border border-stone-300"
                />
                <span className="flex-1 text-xs text-stone-500">
                  {m.lat.toFixed(4)}, {m.lon.toFixed(4)}
                </span>
                <button type="button" className="text-xs underline" onClick={() => update({ markers: spec.markers.filter((_, j) => j !== i) })}>
                  {t("configurator.removeMarker")}
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("configurator.sectionProduct")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("configurator.format")}>
              <select className="input" value={spec.formatId} onChange={(e) => update({ formatId: e.target.value })} data-testid="format">
                {formats.formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("configurator.orientation")}>
              <select className="input" value={spec.orientation} onChange={(e) => update({ orientation: e.target.value as PosterSpec["orientation"] })}>
                <option value="portrait">{t("configurator.portrait")}</option>
                <option value="landscape">{t("configurator.landscape")}</option>
              </select>
            </Field>
          </div>
          <label className="label mt-3">{t("configurator.finish")}</label>
          <div className="space-y-2" role="radiogroup">
            {formats.finishes.map((f) => {
              const p = prices[f.id]?.[spec.formatId];
              const available = p !== undefined;
              return (
                <label
                  key={f.id}
                  className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${finishId === f.id ? "border-stone-900" : "border-stone-200"} ${available ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  <input type="radio" name="finish" value={f.id} checked={finishId === f.id} disabled={!available} onChange={() => setFinishId(f.id)} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{t(`finishes.${f.id}.name` as never)}</span>
                    <span className="block text-xs text-stone-500">{available ? t(`finishes.${f.id}.text` as never) : t("configurator.unavailable")}</span>
                  </span>
                  {available && <span className="text-sm">{formatPrice(p, locale)}</span>}
                </label>
              );
            })}
          </div>
        </Section>

        <div className="space-y-3 border-t border-stone-200 pt-6">
          {cartState === "added" ? (
            <Link href={`/${locale}/carrito`} className="btn-primary block w-full text-center">
              {t("configurator.added")}
            </Link>
          ) : (
            <button type="button" className="btn-primary w-full" disabled={price === null || cartState === "adding" || !spec.texts.title.trim()} onClick={addToCart}>
              {cartState === "adding" ? t("configurator.adding") : `${t("configurator.addToCart")}${price !== null ? ` · ${formatPrice(price, locale)}` : ""}`}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={requestProof}
            disabled={proof.status === "queued" || proof.status === "running"}
          >
            {proof.status === "queued"
              ? t("configurator.proofQueued")
              : proof.status === "running"
                ? t("configurator.proofRunning")
                : t("configurator.proofButton")}
          </button>
          {proof.status === "failed" && <p className="text-xs text-red-700">{t("configurator.proofFailed")}</p>}
          <p className="text-xs text-stone-500">{t("configurator.proofHelp")}</p>
          <button type="button" className="text-xs underline" onClick={share}>
            {copied ? t("configurator.copied") : t("configurator.share")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-2 block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
