"use client";

import { divIcon, LatLngBounds, type Map as LeafletMap } from "leaflet";
import { useEffect, useState } from "react";
import { Compass, Minus, Plus } from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

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

const STATUS_COLORS: Record<ShortlistMapItem["status"], string> = {
  saved: "#000666",
  contacted: "#006b5f",
  rejected: "#dc2626",
  rented: "#b45309",
};

function markerIcon(status: ShortlistMapItem["status"], score: number | null) {
  const color = STATUS_COLORS[status];

  return divIcon({
    className: "shortlist-marker-shell",
    iconSize: score != null ? [28, 28] : [18, 18],
    iconAnchor: score != null ? [14, 14] : [9, 9],
    html: `
      <span class="shortlist-marker-ring" style="--marker-color:${color};"></span>
      <span class="shortlist-marker-core" style="--marker-color:${color};"></span>
    `,
  });
}

function fitMapToItems(map: LeafletMap, items: ShortlistMapItem[]) {
  if (items.length === 0) return;

  if (items.length === 1) {
    map.setView([items[0].lat, items[0].lng], 13);
    return;
  }

  const bounds = new LatLngBounds(items.map((item) => [item.lat, item.lng]));
  map.fitBounds(bounds.pad(0.2));
}

function FitBounds({ items }: { items: ShortlistMapItem[] }) {
  const map = useMap();

  useEffect(() => {
    fitMapToItems(map, items);
  }, [items, map]);

  return null;
}

export function ShortlistMap({ items }: { items: ShortlistMapItem[] }) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-[28px] border border-[rgba(198,197,212,0.18)] bg-[#e8eef7] shadow-[0_22px_48px_-30px_rgba(13,23,48,0.42)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-24 bg-[linear-gradient(180deg,rgba(13,23,48,0.26),transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] h-20 bg-[linear-gradient(0deg,rgba(13,23,48,0.18),transparent)]" />

      <div className="absolute bottom-4 left-4 z-[600] flex flex-wrap gap-2">
        <LegendChip label="Saved" color={STATUS_COLORS.saved} />
        <LegendChip label="Contacted" color={STATUS_COLORS.contacted} />
        <LegendChip label="Rejected" color={STATUS_COLORS.rejected} />
        <LegendChip label="Rented" color={STATUS_COLORS.rented} />
      </div>

      <div className="absolute right-4 top-4 z-[600] flex flex-col gap-2">
        <MapControlButton label="Zoom in" onClick={() => map?.zoomIn()}>
          <Plus size={15} />
        </MapControlButton>
        <MapControlButton label="Zoom out" onClick={() => map?.zoomOut()}>
          <Minus size={15} />
        </MapControlButton>
        <MapControlButton label="Fit all homes" onClick={() => map && fitMapToItems(map, items)}>
          <Compass size={15} />
        </MapControlButton>
      </div>

      <MapContainer
        center={[52.2297, 21.0122]}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={false}
        className="shortlist-map h-full w-full"
        ref={setMap}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds items={items} />

        {items.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
            icon={markerIcon(item.status, item.score)}
          >
            <Popup>
              <div className="min-w-[220px] pr-1">
                <p className="text-sm font-semibold leading-tight text-[#0d1c2e]">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#475569]">{item.address}</p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[#000666]">{item.priceLabel}</span>
                  {item.score != null && (
                    <span className="rounded-full bg-[#e6faf7] px-2 py-0.5 font-semibold text-[#006b5f]">
                      {item.score}% match
                    </span>
                  )}
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex rounded-full bg-[#000666] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85"
                  >
                    Open listing
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <style jsx global>{`
        .shortlist-map .leaflet-control-attribution {
          background: rgba(255, 255, 255, 0.72);
          border-radius: 999px;
          margin: 0 12px 12px 0;
          padding: 4px 10px;
          color: #475569;
          backdrop-filter: blur(10px);
        }

        .shortlist-map .leaflet-tile {
          filter: saturate(0.94) contrast(1.02) brightness(1.01);
        }

        .shortlist-map .leaflet-popup-content-wrapper {
          border-radius: 18px;
          box-shadow: 0 20px 36px -24px rgba(13, 23, 48, 0.45);
          border: 1px solid rgba(198, 197, 212, 0.22);
        }

        .shortlist-map .leaflet-popup-content {
          margin: 14px 16px 14px 14px;
        }

        .shortlist-map .leaflet-popup-tip {
          box-shadow: none;
        }

        .shortlist-marker-shell {
          position: relative;
        }

        .shortlist-marker-ring,
        .shortlist-marker-core,
        .shortlist-marker-score {
          position: absolute;
          inset: 0;
          display: block;
        }

        .shortlist-marker-ring {
          border-radius: 999px;
          background: color-mix(in srgb, var(--marker-color) 22%, white);
          transform: scale(1.16);
          opacity: 0.46;
        }

        .shortlist-marker-core {
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.88), var(--marker-color) 45%, color-mix(in srgb, var(--marker-color) 70%, #081126) 100%);
          border: 2.5px solid rgba(255, 255, 255, 0.92);
          box-shadow: 0 11px 18px -14px rgba(13, 23, 48, 0.45);
        }

      `}</style>
    </div>
  );
}

function LegendChip({ label, color }: { label: string; color: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/55 bg-white/82 px-3 py-1.5 text-[11px] font-semibold text-[#334155] shadow-[0_18px_40px_-24px_rgba(13,23,48,0.45)] backdrop-blur-md">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function MapControlButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/55 bg-white/86 text-[#0d1c2e] shadow-[0_18px_40px_-24px_rgba(13,23,48,0.45)] backdrop-blur-md transition-colors hover:bg-white"
    >
      {children}
    </button>
  );
}
