import { NextResponse } from "next/server";
import { loadParcels } from "@/lib/loadCsv";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const limit = Math.max(1, Math.min(2000, Number(url.searchParams.get("limit") || 1000)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const hasGeo = url.searchParams.get("hasGeo") === "1";

  const data = await loadParcels();

  const filtered = data.filter(r => {
    if (hasGeo && (r.lat == null || r.lng == null)) return false;
    if (!q) return true;
    const hay = [
      r.id, r.situs_address, r.city, r.zip, r.use_code, r.use_type,
      r.raw?.ADDRESS_LI, r.raw?.LEGAL_LINE,
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  const slice = filtered.slice(offset, offset + limit);
  return NextResponse.json({
    total: filtered.length,
    offset, limit,
    items: slice,
  });
}
