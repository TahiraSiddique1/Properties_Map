"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ParcelsMap from "@/components/Map";
import ParcelDetails from "@/components/ParcelDetails";
import ParcelTable from "@/components/ParcelTable";
import type { Parcel } from "@/lib/types";

type ApiResp = { total: number; offset: number; limit: number; items: Parcel[] };

// helpers shared with filters
function chosenSale(p: Parcel) {
  const r = (p.raw ?? {}) as Record<string, unknown>;
  if (r.SALE_DATE_) return { date: String(r.SALE_DATE_), deed: String(r.DEED_TYPE_ ?? "") };
  const cands = [
    { d: r.SALE_DATE1, deed: r.DEED_TYPE1 },
    { d: r.SALE_DAT_1, deed: r.DEED_TYP_1 },
    { d: r.SALE_DAT_2, deed: r.DEED_TYP_2 },
    { d: r.SALE_DAT_3, deed: r.DEED_TYP_3 },
  ].filter(x => x.d)
   .map(x => ({ ...x, t: Date.parse(String(x.d)) }))
   .sort((a,b)=> (Number.isFinite(b.t)?b.t:-Infinity) - (Number.isFinite(a.t)?a.t:-Infinity));
  const top = cands[0];
  return { date: String(top?.d ?? ""), deed: String(top?.deed ?? "") };
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
function isLand(p: Parcel) {
  const r = (p.raw ?? {}) as Record<string, unknown>;
  const ut = String(p.use_type ?? r.USE_TYPE ?? "").toLowerCase();
  const uc = String(p.use_code ?? r.USE_CODE ?? "").toLowerCase();
  if (ut.includes("land") || ut.includes("vacant")) return true;
  if (uc.includes("land") || uc.includes("vac")) return true;
  const under = Number(r.BLDG_UNDER ?? r.BLDG_TOT_S ?? 0);
  return Number.isFinite(under) && under === 0;
}

export default function Page() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 500;
  const [onlyGeocoded, setOnlyGeocoded] = useState(true);
  const [selected, setSelected] = useState<Parcel | null>(null);

  // filters
  const [yb, setYb] = useState<ReadonlyArray<1|2|3>>([1,2,3]);
  const [landMode, setLandMode] = useState<"all"|"land"|"improved">("all");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("q", debounced);
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    if (onlyGeocoded) p.set("hasGeo", "1");
    return `/api/parcels?${p.toString()}`;
  }, [debounced, limit, offset, onlyGeocoded]);

  const { data, isLoading, isError, error } = useQuery<ApiResp>({
    queryKey: ["parcels", url],
    queryFn: async () => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    placeholderData: (previousData) => previousData,
  });

  const items: Parcel[] = useMemo(() => 
    Array.isArray(data?.items) ? data.items : [], 
    [data?.items]
  );
  const total = typeof data?.total === "number" ? data.total : 0;

  // apply filters for both table and map
  const filtered: Parcel[] = useMemo(() => {
    const activeY = new Set(yb);
    return items.filter(p => {
      const geoOk = typeof p.lat === "number" && typeof p.lng === "number";
      const ts = saleTs(p);
      const y = bucketByYears(ts);
      const land = isLand(p);
      const yOk = activeY.has(y);
      const landOk =
        landMode === "all" ? true :
        landMode === "land" ? land :
        !land;
      return (!onlyGeocoded || geoOk) && yOk && landOk;
    });
  }, [items, yb, landMode, onlyGeocoded]);

  useEffect(() => {
    if (selected && !filtered.some(p => p.id === selected.id)) setSelected(null);
  }, [filtered, selected]);

  const toggleY = (k: 1|2|3) =>
    setYb(prev => prev.includes(k) ? (prev.length === 1 ? prev : prev.filter(v => v !== k)) : [...prev, k].sort() as ReadonlyArray<1|2|3>);

  return (
    <main className="grid [grid-template-columns:420px_1fr] h-[100dvh]">
      <aside className="border-r p-5 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Parcels</h1>
          <span className="chip">
            {isLoading ? "Loading" : isError ? "Error" : `${filtered.length}/${total}`}
          </span>
        </div>

        <div className="card p-3 space-y-3">
          <div className="text-sm font-medium">Filters</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Year buckets:</span>
            {([1,2,3] as const).map(k => (
              <button
                key={k}
                onClick={() => toggleY(k)}
                className={`px-2 py-1 rounded-md text-sm border ${yb.includes(k) ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"}`}
                title={k===1?"≤1 year":k===2?"≤2 years":"older"}
              >
                Y{k}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Type:</span>
            {(["all","land","improved"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setLandMode(mode)}
                className={`px-2 py-1 rounded-md text-sm border capitalize ${landMode===mode ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t">
            <input
              value={q}
              onChange={(e) => { setOffset(0); setQ(e.target.value); }}
              placeholder="Search folio, address, city…"
              className="input"
            />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={onlyGeocoded}
                onChange={(e) => { setOffset(0); setOnlyGeocoded(e.target.checked); }}
              />
              Only rows with lat/lon
            </label>
            {isError && <div className="mt-2 text-xs text-red-600">{(error as Error).message}</div>}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <ParcelTable data={filtered} selectedId={selected?.id} onRowClick={setSelected} />
        </div>

        <div className="flex items-center gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="btn">Prev</button>
          <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="btn">Next</button>
          <div className="ml-auto text-xs text-gray-500">Page {Math.floor(offset / limit) + 1}</div>
        </div>
      </aside>

      <section className="relative h-full">
        <ParcelsMap data={filtered} selectedId={selected?.id} onClick={setSelected} />
        {selected && <ParcelDetails parcel={selected} onClose={() => setSelected(null)} />}

        <div className="absolute left-4 bottom-4 card px-3 py-2 text-sm space-y-1">
          <div className="font-medium text-xs text-gray-700">Color key</div>
          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-orange-600"/> Land</div>
          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-blue-900"/> Y1 ≤ 1y</div>
          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-blue-600"/> Y2 ≤ 2y</div>
          <div className="flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-blue-300"/> Y3 older</div>
        </div>
      </section>
    </main>
  );
}
