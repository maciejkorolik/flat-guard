"use client";

import { divIcon, LatLngBounds } from "leaflet";
import { useEffect } from "react";
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

function markerIcon(status: ShortlistMapItem["status"]) {
  const color = STATUS_COLORS[status];

  return divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 10px 20px rgba(15,23,42,0.22);"></span>`,
  });
}

function FitBounds({ items }: { items: ShortlistMapItem[] }) {
  const map = useMap();

  useEffect(() => {
    if (items.length === 0) return;

    if (items.length === 1) {
      map.setView([items[0].lat, items[0].lng], 13);
      return;
    }

    const bounds = new LatLngBounds(items.map((item) => [item.lat, item.lng]));
    map.fitBounds(bounds.pad(0.2));
  }, [items, map]);

  return null;
}

export function ShortlistMap({ items }: { items: ShortlistMapItem[] }) {
  return (
    <div className="h-[420px] w-full">
      <MapContainer
        center={[52.2297, 21.0122]}
        zoom={11}
        scrollWheelZoom={false}
        zoomControl={false}
        className="h-full w-full"
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
            icon={markerIcon(item.status)}
          >
            <Popup>
              <div className="min-w-[200px] pr-2">
                <p className="font-semibold text-[#0d1c2e] text-sm leading-tight">{item.title}</p>
                <p className="text-xs text-[#475569] mt-1">{item.address}</p>
                <div className="flex items-center gap-2 mt-3 text-xs">
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
                    className="inline-flex mt-3 text-xs font-semibold text-[#000666] hover:opacity-75"
                  >
                    Open listing
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
