"use client";

import dynamic from "next/dynamic";

interface ShortlistMapItem {
  id: string;
  listingId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  status: "saved" | "contacted" | "rejected" | "rented";
  priceLabel: string;
  score: number | null;
  url: string | null;
}

const ShortlistMap = dynamic(
  () => import("./shortlist-map").then((mod) => mod.ShortlistMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] overflow-hidden rounded-[28px] border border-[rgba(198,197,212,0.18)] bg-[linear-gradient(135deg,#f8fbff_0%,#edf4ff_45%,#eefbf7_100%)]">
        <div className="flex h-full items-center justify-center">
          <div className="rounded-2xl border border-white/70 bg-white/75 px-5 py-4 text-center shadow-[0_18px_40px_-24px_rgba(13,23,48,0.35)] backdrop-blur-md">
            <div className="mx-auto mb-3 h-2.5 w-2.5 animate-pulse rounded-full bg-[#006b5f]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#64748b]">
              Loading map
            </p>
            <p className="mt-1 text-sm text-[#0d1c2e]">Preparing shortlisted homes…</p>
          </div>
        </div>
      </div>
    ),
  }
);

export function ShortlistMapShell({ items }: { items: ShortlistMapItem[] }) {
  return <ShortlistMap items={items} />;
}
