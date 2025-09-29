"use client";
import { useEffect, useMemo, useRef } from "react";
import mapboxgl, { GeoJSONSource } from "mapbox-gl";
import type { Parcel } from "@/lib/types";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable");
} else {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// ---- helpers ----
const toNum = (v: unknown) => Number(String(v ?? "").replace(/,/g, ""));
function chosenSale(p: Parcel): { date?: string; deed?: string } {
  const r = (p.raw ?? {}) as Record<string, unknown>;
  if (r.SALE_DATE_) return { date: String(r.SALE_DATE_), deed: String(r.DEED_TYPE_ || "") };
  const c = [
    { d: r.SALE_DATE1, deed: r.DEED_TYPE1 },
    { d: r.SALE_DAT_1, deed: r.DEED_TYP_1 },
    { d: r.SALE_DAT_2, deed: r.DEED_TYP_2 },
    { d: r.SALE_DAT_3, deed: r.DEED_TYP_3 },
  ]
    .filter((x) => x.d)
    .map((x) => ({ ...x, t: Date.parse(String(x.d)) }))
    .sort(
      (a, b) =>
        (Number.isFinite(b.t) ? (b.t as number) : -Infinity) -
        (Number.isFinite(a.t) ? (a.t as number) : -Infinity)
    );
  const top = c[0];
  return top ? { date: String(top.d), deed: String(top.deed || "") } : {};
}
const saleTs = (p: Parcel) => {
  const t = Date.parse(String(chosenSale(p).date ?? ""));
  return Number.isFinite(t) ? t : null;
};
function bucketByYears(ts: number | null): 1 | 2 | 3 {
  if (ts == null) return 3;
  const years = (Date.now() - ts) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 1) return 1;
  if (years <= 2) return 2;
  return 3;
}
function isLand(p: Parcel): boolean {
  const r = (p.raw ?? {}) as Record<string, unknown>;
  const ut = String(p.use_type ?? r.USE_TYPE ?? "").toLowerCase();
  const uc = String(p.use_code ?? r.USE_CODE ?? "").toLowerCase();
  if (ut.includes("land") || ut.includes("vacant")) return true;
  if (uc.includes("land") || uc.includes("vac")) return true;
  const under = Number(r.BLDG_UNDER ?? r.BLDG_TOT_S ?? 0);
  return Number.isFinite(under) && under === 0;
}
function ppsfNumber(p: Parcel): number | null {
  const r = (p.raw ?? {}) as Record<string, any>;
  const stamp = toNum(r.STAMP_AMOU);
  const ua = toNum(r.BLDG_ADJ_S);
  if (Number.isFinite(stamp) && Number.isFinite(ua) && ua > 0) return stamp / ua;
  return null;
}
function ppsfLabel(n: number | null): string {
  if (n == null) return "";
  return (
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n) + "/sf"
  );
}

// ---- component ----
type Props = { data?: Parcel[] | null; selectedId?: string; onClick: (p: Parcel) => void };

export default function ParcelsMap({ data = [], selectedId, onClick }: Props) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dataRef = useRef<Parcel[]>([]);
  useEffect(() => {
    dataRef.current = Array.isArray(data) ? data : [];
  }, [data]);

  const byId = useMemo(() => {
    const m = new globalThis.Map<string, Parcel>();
    const currentData = Array.isArray(data) ? data : [];
    for (const p of currentData) if (p?.id) m.set(p.id, p);
    return m;
  }, [data]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-80.137, 26.118],
      zoom: 10,
    });
    mapRef.current = map;

    map.on("load", () => {
      // build a stretchable label background (white fill + red border)
      const w = 64,
        h = 32,
        r = 6;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);
      // rounded rect
      const rr = (x: number, y: number, width: number, height: number, radius: number) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
      };
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      rr(1, 1, w - 2, h - 2, r);
      ctx.fill();
      ctx.stroke();
      const img = ctx.getImageData(0, 0, w, h);
      map.addImage("ppsf-bg", img, { pixelRatio: 2 }); // scalable label bg

      map.addSource("parcels", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 60,
        clusterMaxZoom: 15,
        clusterProperties: {
          y1: ["+", ["case", ["==", ["get", "yb"], 1], 1, 0]],
          y2: ["+", ["case", ["==", ["get", "yb"], 2], 1, 0]],
          y3: ["+", ["case", ["==", ["get", "yb"], 3], 1, 0]],
          land: ["+", ["case", ["==", ["get", "isLand"], true], 1, 0]],
        },
      });

      // clusters
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "parcels",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "case",
            [">", ["coalesce", ["get", "land"], 0], 0],
            "#ea580c",
            [">", ["coalesce", ["get", "y1"], 0], 0],
            "#1e3a8a",
            [">", ["coalesce", ["get", "y2"], 0], 0],
            "#2563eb",
            "#93c5fd",
          ],
          "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 1, 12, 50, 18, 200, 24, 1000, 32],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.25,
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "parcels",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "point_count"]],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#000000", "text-halo-width": 1 },
      });

      // unclustered points as filled squares
      map.addLayer({
        id: "unclustered-point",
        type: "symbol",
        source: "parcels",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": "■",
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 12, 14, 14, 16, 16],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": [
            "case",
            ["==", ["get", "isLand"], true],
            "#ea580c",
            ["==", ["get", "yb"], 1],
            "#1e3a8a",
            ["==", ["get", "yb"], 2],
            "#2563eb",
            "#93c5fd",
          ],
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      });

      // selected hollow square outline
      map.addLayer({
        id: "parcels-selected",
        type: "symbol",
        source: "parcels",
        filter: ["all", ["==", ["get", "id"], ""], ["!", ["has", "point_count"]]],
        layout: {
          "text-field": "□",
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 22, 16, 26],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ef4444",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.25,
        },
      });

      // selected PPSF label with stretchable background
      map.addLayer({
        id: "parcels-selected-label",
        type: "symbol",
        source: "parcels",
        filter: ["all", ["==", ["get", "id"], ""], ["!", ["has", "point_count"]]],
        layout: {
          "text-field": ["get", "ppsfText"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "icon-image": "ppsf-bg",
          "icon-text-fit": "both",
          "icon-text-fit-padding": [2, 6, 2, 6],
          "text-allow-overlap": true,
          "icon-allow-overlap": true,
          // keep label centered on the feature; move if you prefer above/below
          "text-anchor": "center",
          "icon-anchor": "center",
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "#ffffff",
          "text-halo-width": 0.5,
        },
      });

      map.on("click", "clusters", (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        const clusterId = f.properties?.cluster_id as number;
        (map.getSource("parcels") as GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const geometry = f.geometry as unknown as { coordinates: [number, number] };
          map.easeTo({ center: geometry.coordinates, zoom });
        });
      });

      map.on("click", "unclustered-point", (e) => {
        const id = String(e.features?.[0]?.properties?.id ?? "");
        if (!id) return;
        const p = dataRef.current.find((x) => x.id === id);
        if (p) onClick(p);
      });

      // allow clicking the label or outline as well
      ["parcels-selected", "parcels-selected-label"].forEach((l) => {
        map.on("click", l, (e) => {
          const id = String(e.features?.[0]?.properties?.id ?? "");
          if (!id) return;
          const p = dataRef.current.find((x) => x.id === id);
          if (p) onClick(p);
        });
      });

      ["clusters", "unclustered-point", "parcels-selected", "parcels-selected-label"].forEach((l) => {
        map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", l, () => (map.getCanvas().style.cursor = ""));
      });
    });
  }, [onClick]);

  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource("parcels") as GeoJSONSource | undefined;
    if (!map || !src) return;

    const features = (Array.isArray(data) ? data : [])
      .filter((p) => typeof p?.lng === "number" && typeof p?.lat === "number")
      .map((p) => {
        const ts = saleTs(p);
        const yb = bucketByYears(ts);
        const pNum = ppsfNumber(p);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lng!, p.lat!] },
          properties: {
            id: p.id,
            isLand: isLand(p),
            yb,
            ppsf: pNum ?? null,
            ppsfText: ppsfLabel(pNum),
          },
        };
      });

    src.setData({ type: "FeatureCollection", features });
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // show hollow square and label on selected id
    map.setFilter("parcels-selected", [
      "all",
      ["==", ["get", "id"], selectedId ?? ""],
      ["!", ["has", "point_count"]],
    ]);
    map.setFilter("parcels-selected-label", [
      "all",
      ["==", ["get", "id"], selectedId ?? ""],
      ["!", ["has", "point_count"]],
      ["!=", ["get", "ppsfText"], ""], // only if we have a value
    ]);

    // hide the filled square for the selected id
    map.setFilter("unclustered-point", [
      "all",
      ["!", ["has", "point_count"]],
      ["!=", ["get", "id"], selectedId ?? ""],
    ]);

    if (selectedId) {
      const p = byId.get(selectedId);
      if (p?.lng != null && p?.lat != null) {
        map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 13) });
      }
    }
  }, [selectedId, byId]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Configuration Error</h3>
          <p className="text-gray-600">Mapbox access token is required. Please check your environment configuration.</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
