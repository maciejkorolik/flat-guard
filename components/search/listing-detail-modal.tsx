"use client";

import { useEffect } from "react";
import { X, MapPin, Calendar, ExternalLink, Bookmark, BookmarkCheck, CheckCircle, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchScore } from "./match-score";
import { SourceBadge } from "./source-badge";
import type { NormalizedListing, ScoredListing } from "@/lib/types/flatguard";

interface ListingDetailModalProps {
  listing: NormalizedListing;
  scored?: ScoredListing;
  isShortlisted: boolean;
  onClose: () => void;
  onToggleShortlist: (listing: NormalizedListing, scored?: ScoredListing) => void;
}

const CRITERION_COLORS: Record<string, string> = {
  "budget fit": "bg-[#e6faf7] text-[#006b5f]",
  budget:       "bg-[#e6faf7] text-[#006b5f]",
  size:         "bg-[#eff4ff] text-[#000666]",
  location:     "bg-[#f0fdf4] text-[#15803d]",
  features:     "bg-[#fef3c7] text-[#92400e]",
  availability: "bg-[#f5f3ff] text-[#6d28d9]",
};

function criterionColor(criterion: string): string {
  const key = criterion.toLowerCase();
  for (const [pattern, color] of Object.entries(CRITERION_COLORS)) {
    if (key.includes(pattern)) return color;
  }
  return "bg-[#f1f5f9] text-[#475569]";
}

function BoolRow({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      {value
        ? <CheckCircle size={13} className="text-[#006b5f] shrink-0" />
        : <XCircle size={13} className="text-[#94a3b8] shrink-0" />}
      <span className={value ? "text-[#0d1c2e]" : "text-[#94a3b8]"}>{label}</span>
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

export function ListingDetailModal({
  listing,
  scored,
  isShortlisted,
  onClose,
  onToggleShortlist,
}: ListingDetailModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const area = listing.area_m2 != null ? parseFloat(String(listing.area_m2)) || null : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0d1c2e]/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[rgba(198,197,212,0.15)] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <SourceBadge source={listing.source} />
                {listing.offer_type && (
                  <span className="text-[10px] font-semibold text-[#767683] uppercase tracking-widest">
                    {listing.offer_type}
                  </span>
                )}
              </div>
              <h2 className="font-manrope font-extrabold text-[#0d1c2e] text-xl leading-tight">
                {listing.title ?? "Apartment"}
              </h2>
              {listing.address && (
                <div className="flex items-center gap-1.5 text-[#767683] text-sm mt-1.5">
                  <MapPin size={12} />
                  <span>{listing.address}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {scored && <MatchScore score={scored.overallScore} size="sm" />}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-[#f1f5f9] flex items-center justify-center hover:bg-[#e2e8f0] transition-colors"
              >
                <X size={14} className="text-[#454652]" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">
          {/* Price row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-manrope font-extrabold text-[#000666] text-3xl">
                {(listing.total_monthly_pln ?? listing.rent_pln)?.toLocaleString("pl-PL") ?? "—"} PLN
                <span className="text-[#767683] text-sm font-normal ml-1">/mo total</span>
              </p>
              {listing.deposit_pln && (
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

          {/* Specs grid */}
          <div className="grid grid-cols-3 gap-3">
            {listing.rooms != null && <Spec label="Rooms" value={String(listing.rooms)} />}
            {area != null && <Spec label="Area" value={`${area} m²`} />}
            {listing.floor != null && (
              <Spec label="Floor" value={listing.total_floors ? `${listing.floor} / ${listing.total_floors}` : String(listing.floor)} />
            )}
            {listing.building_type && <Spec label="Building" value={listing.building_type} />}
            {listing.heating_type && <Spec label="Heating" value={listing.heating_type} />}
            {listing.parking_type && <Spec label="Parking" value={listing.parking_type} />}
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-2">
            <BoolRow label="Furnished" value={listing.is_furnished} />
            <BoolRow label="Balcony" value={listing.has_balcony} />
            <BoolRow label="Terrace" value={listing.has_terrace} />
            <BoolRow label="Elevator" value={listing.has_elevator} />
            <BoolRow label="Storage room" value={listing.has_storage_room} />
            <BoolRow label="Internet" value={listing.has_internet} />
          </div>

          {/* Kitchen / extras */}
          {(listing.kitchen_equipment?.length || listing.extra_features?.length) && (
            <div className="flex flex-wrap gap-2">
              {[...(listing.kitchen_equipment ?? []), ...(listing.extra_features ?? [])].map((f) => (
                <span key={f} className="bg-[#eff4ff] text-[#000666] text-[11px] font-medium px-2.5 py-1 rounded-full">
                  {f.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          {/* AI scoring */}
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

        {/* Footer actions */}
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
              onClick={() => onToggleShortlist(listing, scored)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                isShortlisted
                  ? "bg-[#e6faf7] text-[#006b5f] border border-[rgba(0,107,95,0.2)]"
                  : "bg-gradient-to-r from-[#000666] to-[#1a237e] text-white hover:opacity-90 shadow-md shadow-[#000666]/20"
              )}
            >
              {isShortlisted
                ? <><BookmarkCheck size={14} /> Shortlisted</>
                : <><Bookmark size={14} /> Add to Shortlist</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
