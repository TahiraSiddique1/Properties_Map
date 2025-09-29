"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Parcel, RawParcelData } from "@/lib/types";

const fmtDate = (s?: string) => {
  const t = Date.parse(String(s ?? ""));
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : (s ?? "");
};

const pickOwner = (p: Parcel) => {
  if (p.owner?.trim()) return p.owner;
  const r = (p.raw ?? {}) as RawParcelData;
  const s = [r.NAME_LINE_, r.NAME_LINE1].filter(Boolean).join(" ").trim();
  return s || "";
};

const pickAddress = (p: Parcel) => p.situs_address ?? "";

// SALE_DATE_ first, else newest of alternates; include deed
function pickSaleAndDeed(p: Parcel) {
  const r = (p.raw ?? {}) as RawParcelData;
  if (r.SALE_DATE_) return { date: r.SALE_DATE_, deed: (r.DEED_TYPE_ ?? "") };
  const cands = [
    { d: r.SALE_DATE1, deed: r.DEED_TYPE1 },
    { d: r.SALE_DAT_1, deed: r.DEED_TYP_1 },
    { d: r.SALE_DAT_2, deed: r.DEED_TYP_2 },
    { d: r.SALE_DAT_3, deed: r.DEED_TYP_3 },
  ]
    .filter(x => x.d)
    .map(x => ({ ...x, t: Date.parse(String(x.d)) }))
    .sort((a, b) => (Number.isFinite(b.t) ? b.t : -Infinity) - (Number.isFinite(a.t) ? a.t : -Infinity));
  const top = cands[0];
  return { date: (top?.d ?? ""), deed: (top?.deed ?? "") };
}

export default function ParcelTable({
  data,
  selectedId,
  onRowClick,
}: {
  data: Parcel[];
  selectedId?: string;
  onRowClick?: (p: Parcel) => void;
}) {
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const idSet = useMemo(() => new Set(data.map(d => d.id)), [data]);

  useEffect(() => {
    if (selectedId && idSet.has(selectedId)) {
      rowRefs.current[selectedId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedId, idSet]);

  return (
    <div className="card h-full overflow-hidden">
      <div className="h-full overflow-auto">
        <table className="w-full min-w-[1100px] table-fixed text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 bg-white z-10 border-b">
            <tr className="[&>th]:p-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-[28%]">Address</th>
              <th className="w-[22%]">Owner</th>
              <th className="w-[16%]">Folio</th>
              <th className="w-[12%]">Sale date</th>
              <th className="w-[12%]">Deed type</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-gray-50/50">
            {data.map(p => {
              const selected = p.id === selectedId;
              const { date, deed } = pickSaleAndDeed(p);
              const owner = pickOwner(p);
              return (
                <tr
                  key={p.id}
                  ref={el => { rowRefs.current[p.id] = el; }}
                  className={`border-b cursor-pointer transition-colors ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  onClick={() => onRowClick?.(p)}
                >
                  <td className="p-2 truncate" title={pickAddress(p)}>{pickAddress(p)}</td>
                  <td className="p-2 truncate" title={owner}>{owner}</td>
                  <td className="p-2 font-mono text-xs whitespace-nowrap">{p.id}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDate(date)}</td>
                  <td className="p-2 truncate" title={deed}>{deed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
