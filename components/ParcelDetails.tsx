// components/ParcelDetails.tsx
"use client";
import type { Parcel } from "@/lib/types";

// --- helpers ---
const toNum = (v: unknown) => Number(String(v ?? "").replace(/,/g, ""));
const fmtDate = (s?: string) => {
  const t = Date.parse(String(s ?? ""));
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : (s ?? "");
};
const fmtInt = (v: unknown) => (Number.isFinite(toNum(v)) ? new Intl.NumberFormat().format(toNum(v)) : "");
const fmtUsd0 = (v: unknown) =>
  Number.isFinite(toNum(v))
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(toNum(v))
    : "";
function chosenSale(p: Parcel) {
  const r = (p.raw ?? {}) as Record<string, any>;
  if (r.SALE_DATE_) return { date: r.SALE_DATE_ as string, deed: (r.DEED_TYPE_ ?? "") as string };
  const c = [
    { d: r.SALE_DATE1, deed: r.DEED_TYPE1 },
    { d: r.SALE_DAT_1, deed: r.DEED_TYP_1 },
    { d: r.SALE_DAT_2, deed: r.DEED_TYP_2 },
    { d: r.SALE_DAT_3, deed: r.SALE_DAT_3 ? r.DEED_TYP_3 : undefined },
  ]
    .filter(x => x.d)
    .map(x => ({ ...x, t: Date.parse(String(x.d)) }))
    .sort((a, b) => (Number.isFinite(b.t) ? b.t : -Infinity) - (Number.isFinite(a.t) ? a.t : -Infinity));
  const top = c[0];
  return { date: (top?.d ?? "") as string, deed: (top?.deed ?? "") as string };
}

export default function ParcelDetails({ parcel, onClose }: { parcel: Parcel; onClose: () => void }) {
  const r = (parcel.raw ?? {}) as Record<string, any>;

  
  const folio = r.FOLIO_NUMB ?? parcel.id ?? "";
  const owner = r.NAME_LINE_ ?? parcel.owner ?? "";
  const mailingAddr = r.ADDRESS_LI ?? "";
  const situsStreet = r.SITUS_STRE ?? parcel.situs_address ?? "";
  const situsCity = r.SITUS_CITY ?? parcel.city ?? "";
  const stampAmount = r.STAMP_AMOU;      
  const underAir = r.BLDG_ADJ_S;         
  const bldgTotal = r.BLDG_TOT_S;        
  const landVal = r.JUST_LAND_;
  const bldgVal = r.JUST_BUILD;
  const yearBuilt = r.BLDG_YEAR_;
  const useCode = r.USE_CODE;
  const landAreaCalc = r.LAND_CALC_;
  const lotSizeGis = r.GIS_SQUARE;
  const { date: saleDate, deed } = chosenSale(parcel);
  const ppsf =
    Number.isFinite(toNum(stampAmount)) && Number.isFinite(toNum(underAir)) && toNum(underAir) > 0
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
          toNum(stampAmount) / toNum(underAir),
        ) + " /sf"
      : "";
  const gmaps =
    parcel.lat != null && parcel.lng != null ? `https://www.google.com/maps?q=${parcel.lat},${parcel.lng}` : undefined;

  return (
    <aside className="card absolute right-4 top-4 w-[420px] max-h-[85vh] overflow-auto p-4 space-y-4 z-10">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Property ID (Folio)</div>
          <div className="font-semibold">{folio}</div>
        </div>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      {/* Address */}
      <div className="space-y-2">
        {(situsStreet || situsCity) && (
          <div>
            <div className="text-xs text-gray-500">Property address</div>
            <div className="font-medium">{situsStreet}</div>
            <div className="text-xs text-gray-500">{situsCity}</div>
          </div>
        )}
        {mailingAddr && (
          <div>
            <div className="text-xs text-gray-500">Mailing address</div>
            <div>{mailingAddr}</div>
          </div>
        )}
      </div>

      {/* Owner */}
      {owner && (
        <div>
          <div className="text-xs text-gray-500">Owner</div>
          <div>{owner}</div>
        </div>
      )}

      {/* Sale info */}
      {(saleDate || deed || stampAmount || underAir || ppsf) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500">Sale date</div>
            <div>{fmtDate(saleDate)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Deed type</div>
            <div>{deed ?? ""}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Sale price (stamps)</div>
            <div>{fmtUsd0(stampAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Under-air sqft</div>
            <div>{fmtInt(underAir)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-gray-500">Price per under-air sf</div>
            <div>{ppsf}</div>
          </div>
        </div>
      )}

      {/* Property characteristics */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-gray-500">Year built</div>
          <div>{fmtInt(yearBuilt)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Use code</div>
          <div>{useCode ?? ""}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Total building sqft</div>
          <div>{fmtInt(bldgTotal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Land value</div>
          <div>{fmtUsd0(landVal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Building value</div>
          <div>{fmtUsd0(bldgVal)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Land area (calc)</div>
          <div>{fmtInt(landAreaCalc)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Lot size (GIS)</div>
          <div>{fmtInt(lotSizeGis)}</div>
        </div>
      </div>

      {/* Coordinates */}
      {(parcel.lat != null || parcel.lng != null) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500">Lat</div>
            <div>{parcel.lat ?? ""}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Lon</div>
            <div>{parcel.lng ?? ""}</div>
          </div>
        </div>
      )}

      {/* Google Maps */}
      {gmaps && (
        <a className="btn w-full justify-center" href={gmaps} target="_blank" rel="noreferrer">
          Open in Google Maps
        </a>
      )}
    </aside>
  );
}
