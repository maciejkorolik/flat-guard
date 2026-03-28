"use client";

import { useEffect, useState } from "react";
import {
  X,
  MapPin,
  Calendar,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  XCircle,
  Zap,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchScore } from "./match-score";
import { SourceBadge } from "./source-badge";
import type { ListingFeeRow, NormalizedListing, ScoredListing } from "@/lib/types/flatguard";
import { pickListingMapCoordinates } from "@/lib/enrichment-display";
import { ListingEnrichmentChips } from "./listing-enrichment-chips";

interface ListingDetailModalProps {
  listing: NormalizedListing;
  scored?: ScoredListing;
  isShortlisted: boolean;
  onClose: () => void;
  onToggleShortlist: (listing: NormalizedListing, scored?: ScoredListing) => void;
}

const CRITERION_COLORS: Record<string, string> = {
  "budget fit": "bg-[#e6faf7] text-[#006b5f]",
  budget: "bg-[#e6faf7] text-[#006b5f]",
  size: "bg-[#eff4ff] text-[#000666]",
  location: "bg-[#f0fdf4] text-[#15803d]",
  features: "bg-[#fef3c7] text-[#92400e]",
  availability: "bg-[#f5f3ff] text-[#6d28d9]",
};

function criterionColor(criterion: string): string {
  const key = criterion.toLowerCase();
  for (const [pattern, color] of Object.entries(CRITERION_COLORS)) {
    if (key.includes(pattern)) return color;
  }
  return "bg-[#f1f5f9] text-[#475569]";
}

function TriFeature({ label, value }: { label: string; value: boolean | null | undefined }) {
  const v = value;
  return (
    <div className="flex items-center gap-2 text-sm">
      {v === true ? (
        <CheckCircle size={13} className="text-[#006b5f] shrink-0" />
      ) : v === false ? (
        <XCircle size={13} className="text-[#94a3b8] shrink-0" />
      ) : (
        <span className="w-[13px] h-[13px] rounded-full bg-[#e2e8f0] shrink-0" aria-hidden />
      )}
      <span className={v == null ? "text-[#94a3b8]" : "text-[#0d1c2e]"}>
        {label}
        {v == null && <span className="text-[#94a3b8] font-normal"> — unknown</span>}
      </span>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f8fafc] rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#767683] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[#0d1c2e]">{value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-[#767683] border-b border-[rgba(198,197,212,0.2)] pb-2">
      {children}
    </p>
  );
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function feeLabel(row: ListingFeeRow): string {
  return (row.fee_type ?? "fee").replace(/_/g, " ");
}

export function ListingDetailModal({
  listing,
  scored,
  isShortlisted,
  onClose,
  onToggleShortlist,
}: ListingDetailModalProps) {
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const area = listing.area_m2 != null ? parseFloat(String(listing.area_m2)) || null : null;
  const mapCoords = pickListingMapCoordinates(listing);
  const hasCoords = mapCoords != null;
  const lat = mapCoords?.lat;
  const lng = mapCoords?.lng;

  const nearbyEntries =
    listing.nearby && typeof listing.nearby === "object"
      ? Object.entries(listing.nearby).filter(([, v]) => v != null && String(v).length > 0)
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-[#0d1c2e]/40 backdrop-blur-sm" />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[rgba(198,197,212,0.15)] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <SourceBadge source={listing.source} />
                {listing.offer_type && (
                  <span className="text-[10px] font-semibold text-[#767683] uppercase tracking-widest">
                    {listing.offer_type}
                  </span>
                )}
                {listing.is_active === false && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#fef2f2] text-[#b91c1c]">
                    Inactive
                  </span>
                )}
              </div>
              <h2 className="font-manrope font-extrabold text-[#0d1c2e] text-xl leading-tight">
                {listing.title ?? "Apartment"}
              </h2>
              <div className="flex flex-col gap-0.5 text-[#767683] text-sm mt-1.5">
                {(listing.city || listing.district || listing.neighbourhood) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MapPin size={12} />
                    <span>
                      {[listing.neighbourhood, listing.district, listing.city].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                )}
                {listing.address && (
                  <div className="flex items-center gap-1.5 pl-[1.125rem]">
                    <span className="text-[#454652]">{listing.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {scored && <MatchScore score={scored.overallScore} size="sm" />}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-[#f1f5f9] flex items-center justify-center hover:bg-[#e2e8f0] transition-colors"
              >
                <X size={14} className="text-[#454652]" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">
          {/* Photos from raw scrape (listings_raw.raw_data) */}
          {listing.image_urls && listing.image_urls.length > 0 ? (
            <div>
              <SectionTitle>Photos</SectionTitle>
              <div className="flex gap-2 overflow-x-auto pb-1 mt-3 -mx-1 px-1 snap-x snap-mandatory">
                {listing.image_urls.map((src, i) =>
                  brokenImages.has(i) ? null : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      alt=""
                      className="h-44 min-w-[220px] max-w-[280px] object-cover rounded-xl border border-[rgba(198,197,212,0.2)] snap-start bg-[#f8fafc]"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => new Set(prev).add(i))}
                    />
                  )
                )}
              </div>
              {listing.image_urls.every((_, i) => brokenImages.has(i)) && (
                <p className="text-xs text-[#94a3b8] mt-2">
                  Images could not be loaded (link expired or host blocks embedding).
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[rgba(198,197,212,0.4)] bg-[#f8fafc] px-4 py-3 text-[#94a3b8] text-xs">
              <ImageIcon size={14} className="shrink-0" />
              <span>No photos stored on this normalized listing yet.</span>
            </div>
          )}

          {/* Price */}
          <div>
            <SectionTitle>Pricing</SectionTitle>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-manrope font-extrabold text-[#000666] text-3xl">
                  {(listing.total_monthly_pln ?? listing.rent_pln)?.toLocaleString("pl-PL") ?? "—"} PLN
                  <span className="text-[#767683] text-sm font-normal ml-1">/mo total</span>
                </p>
                {listing.rent_pln != null && listing.total_monthly_pln != null && listing.rent_pln !== listing.total_monthly_pln && (
                  <p className="text-[#767683] text-xs mt-0.5">
                    Base rent: {listing.rent_pln.toLocaleString("pl-PL")} PLN
                  </p>
                )}
                {listing.deposit_pln != null && (
                  <p className="text-[#767683] text-xs mt-0.5">
                    Deposit: {listing.deposit_pln.toLocaleString("pl-PL")} PLN
                  </p>
                )}
              </div>
              {listing.available_from && (
                <div className="flex items-center gap-1.5 text-[#454652] text-sm">
                  <Calendar size={13} />
                  <span>From {listing.available_from}</span>
                </div>
              )}
            </div>

            {listing.fees != null && listing.fees.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {listing.fees.map((row, idx) => (
                  <li key={idx} className="flex justify-between gap-4 text-[#454652]">
                    <span className="capitalize">{feeLabel(row)}</span>
                    <span className="font-semibold text-[#0d1c2e] tabular-nums">
                      {row.amount_pln != null ? `${row.amount_pln.toLocaleString("pl-PL")} PLN` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[#454652]">
              <TriFeature label="Agency provision" value={listing.has_provision} />
              {listing.provision_total_pln != null && (
                <div>
                  <span className="text-[#767683] text-xs uppercase tracking-wider font-semibold">
                    Provision total
                  </span>
                  <p className="font-semibold text-[#0d1c2e]">
                    {listing.provision_total_pln.toLocaleString("pl-PL")} PLN
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Location + map */}
          <div>
            <SectionTitle>Location</SectionTitle>
            <div className="mt-3 space-y-3">
              {hasCoords && lat != null && lng != null && (
                <p className="text-xs font-mono text-[#454652]">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                  {listing.geocode_formatted_address && (
                    <span className="block font-sans text-[11px] text-[#767683] mt-1 normal-case">
                      {listing.geocode_formatted_address}
                    </span>
                  )}
                </p>
              )}
              {!hasCoords && (
                <p className="text-xs text-[#94a3b8]">No coordinates stored for this listing.</p>
              )}
              {hasCoords && lat != null && lng != null && (
                <div className="rounded-xl overflow-hidden border border-[rgba(198,197,212,0.25)] h-52 bg-[#e8ecf4]">
                  <iframe
                    title="Listing on map"
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                  />
                </div>
              )}
              {hasCoords && lat != null && lng != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#000666] text-xs font-semibold hover:opacity-70"
                >
                  <ExternalLink size={12} />
                  Open in Google Maps
                </a>
              )}
            </div>
          </div>

          {(formatWhen(listing.first_seen_at) || formatWhen(listing.last_seen_at)) && (
            <div>
              <SectionTitle>Listing record</SectionTitle>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#454652]">
                {formatWhen(listing.first_seen_at) && (
                  <div>
                    <span className="text-[#767683] font-semibold uppercase tracking-wider">First seen</span>
                    <p>{formatWhen(listing.first_seen_at)}</p>
                  </div>
                )}
                {formatWhen(listing.last_seen_at) && (
                  <div>
                    <span className="text-[#767683] font-semibold uppercase tracking-wider">Last seen</span>
                    <p>{formatWhen(listing.last_seen_at)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Physical */}
          <div>
            <SectionTitle>Apartment</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              {listing.rooms != null && <Spec label="Rooms" value={String(listing.rooms)} />}
              {area != null && <Spec label="Area" value={`${area} m²`} />}
              {listing.floor != null && (
                <Spec
                  label="Floor"
                  value={
                    listing.total_floors ? `${listing.floor} / ${listing.total_floors}` : String(listing.floor)
                  }
                />
              )}
              {listing.building_type && <Spec label="Building" value={listing.building_type} />}
              {listing.heating_type && <Spec label="Heating" value={listing.heating_type} />}
              {listing.parking_type && <Spec label="Parking" value={listing.parking_type.replace(/_/g, " ")} />}
            </div>
            <ListingEnrichmentChips listing={listing} withTopBorder />
          </div>

          {/* Features (incl. unknown) */}
          <div>
            <SectionTitle>Features</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <TriFeature label="Furnished" value={listing.is_furnished} />
              <TriFeature label="Balcony" value={listing.has_balcony} />
              <TriFeature label="Terrace" value={listing.has_terrace} />
              <TriFeature label="Elevator" value={listing.has_elevator} />
              <TriFeature label="Storage room" value={listing.has_storage_room} />
              <TriFeature label="Internet" value={listing.has_internet} />
              <TriFeature label="TV" value={listing.has_tv} />
            </div>
          </div>

          {/* Equipment tags */}
          <div className="flex flex-col gap-3">
            {listing.kitchen_equipment && listing.kitchen_equipment.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#767683] mb-2">Kitchen</p>
                <div className="flex flex-wrap gap-2">
                  {listing.kitchen_equipment.map((f) => (
                    <span
                      key={f}
                      className="bg-[#eff4ff] text-[#000666] text-[11px] font-medium px-2.5 py-1 rounded-full"
                    >
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {listing.bathroom_features && listing.bathroom_features.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#767683] mb-2">Bathroom</p>
                <div className="flex flex-wrap gap-2">
                  {listing.bathroom_features.map((f) => (
                    <span
                      key={f}
                      className="bg-[#f0fdf4] text-[#15803d] text-[11px] font-medium px-2.5 py-1 rounded-full"
                    >
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {listing.living_room_features && listing.living_room_features.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#767683] mb-2">Living room</p>
                <div className="flex flex-wrap gap-2">
                  {listing.living_room_features.map((f) => (
                    <span
                      key={f}
                      className="bg-[#fef3c7] text-[#92400e] text-[11px] font-medium px-2.5 py-1 rounded-full"
                    >
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {listing.extra_features && listing.extra_features.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#767683] mb-2">Extra</p>
                <div className="flex flex-wrap gap-2">
                  {listing.extra_features.map((f) => (
                    <span
                      key={f}
                      className="bg-[#f5f3ff] text-[#6d28d9] text-[11px] font-medium px-2.5 py-1 rounded-full"
                    >
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {nearbyEntries.length > 0 && (
            <div>
              <SectionTitle>Nearby (from source)</SectionTitle>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nearbyEntries.map(([k, v]) => (
                  <div key={k} className="bg-[#f8fafc] rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#767683] mb-1">
                      {k.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm font-medium text-[#0d1c2e]">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listing.description && (
            <div>
              <SectionTitle>Description</SectionTitle>
              <p className="mt-3 text-sm text-[#454652] leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>
          )}

          {/* AI scoring — keep compact bool rows only where we had before for scored context */}
          {scored && (
            <div className="bg-[rgba(0,6,102,0.03)] border border-[rgba(0,6,102,0.07)] rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#767683]">AI Analysis</p>
              <div className="flex flex-wrap gap-2">
                {scored.breakdown.map((item) => (
                  <div
                    key={item.criterion}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                      criterionColor(item.criterion)
                    )}
                    title={item.note}
                  >
                    <span>{item.criterion}</span>
                    <span className="font-bold">{item.score}/10</span>
                  </div>
                ))}
              </div>
              {scored.reasoning && (
                <div className="flex items-start gap-2">
                  <Zap size={11} className="text-[#000666] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#454652] leading-relaxed italic">&ldquo;{scored.reasoning}&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[rgba(198,197,212,0.15)] shrink-0 flex items-center gap-3">
          {listing.url && (
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#000666] text-sm font-semibold hover:opacity-70 transition-opacity"
            >
              <ExternalLink size={13} />
              View original listing
            </a>
          )}
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => onToggleShortlist(listing, scored)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                isShortlisted
                  ? "bg-[#e6faf7] text-[#006b5f] border border-[rgba(0,107,95,0.2)]"
                  : "bg-gradient-to-r from-[#000666] to-[#1a237e] text-white hover:opacity-90 shadow-md shadow-[#000666]/20"
              )}
            >
              {isShortlisted ? (
                <>
                  <BookmarkCheck size={14} /> Shortlisted
                </>
              ) : (
                <>
                  <Bookmark size={14} /> Add to Shortlist
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
