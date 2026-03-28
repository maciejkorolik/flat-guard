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
      <div className="h-[420px] bg-[#f8fafc] flex items-center justify-center text-sm text-[#64748b]">
        Loading map…
      </div>
    ),
  }
);

export function ShortlistMapShell({ items }: { items: ShortlistMapItem[] }) {
  return <ShortlistMap items={items} />;
}
