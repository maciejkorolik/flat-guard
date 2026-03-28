import { useState } from "react";
import type { NormalizedListing, ScoredListing } from "@/lib/types/flatguard";
import { MatchScore } from "./match-score";
import { SourceBadge } from "./source-badge";
import { MapPin, Calendar, Zap, CheckCircle, XCircle, Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListingEnrichmentChips, listingHasEnrichmentChips } from "./listing-enrichment-chips";

interface ScoredListingCardProps {
  listing: NormalizedListing;
  scored?: ScoredListing;
  isShortlisted?: boolean;
  animationDelay?: number;
  onOpenDetail: (listing: NormalizedListing, scored?: ScoredListing) => void;
  onToggleShortlist: (listing: NormalizedListing, scored?: ScoredListing) => void;
}

const RECOMMENDATION_CONFIG = {
  strong: { label: "Strong Match", bg: "bg-[#e6faf7]", text: "text-[#006b5f]", border: "border-[rgba(0,107,95,0.2)]" },
  good:   { label: "Good Match",   bg: "bg-[#eff4ff]", text: "text-[#000666]", border: "border-[rgba(0,6,102,0.1)]" },
  weak:   { label: "Weak Match",   bg: "bg-[#fff7ed]", text: "text-[#b45309]", border: "border-[rgba(180,83,9,0.2)]" },
};

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

export function ScoredListingCard({
  listing,
  scored,
  isShortlisted = false,
  animationDelay = 0,
  onOpenDetail,
  onToggleShortlist,
}: ScoredListingCardProps) {
  const isPending = !scored;
  const overallScore = scored?.overallScore;
  const breakdown = scored?.breakdown ?? [];
  const reasoning = scored?.reasoning;
  const recommendation = scored?.recommendation ?? "good";
  const rec = RECOMMENDATION_CONFIG[recommendation];
  const thumb = listing.image_urls?.[0];
  const [thumbFailed, setThumbFailed] = useState(false);

  return (
    <div
      className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_6px_-1px_rgba(15,23,42,0.07),0_12px_24px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.035] overflow-hidden shrink-0 animate-fade-slide-in hover:shadow-[0_8px_12px_-2px_rgba(15,23,42,0.08),0_18px_32px_-10px_rgba(15,23,42,0.14)] transition-shadow duration-200"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: "both" }}
    >
      <div className="flex">
        {thumb && !thumbFailed && (
          <div className="relative w-28 shrink-0 min-h-[140px] hidden sm:block bg-[#f1f5f9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
            />
          </div>
        )}
        {/* Left: listing info */}
        <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <SourceBadge source={listing.source} />
                {isPending ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-[#f1f5f9] text-[#94a3b8] border-[rgba(148,163,184,0.3)] flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-[#94a3b8] rounded-full animate-pulse" />
                    Analysing…
                  </span>
                ) : (
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border",
                    rec.bg, rec.text, rec.border
                  )}>
                    {rec.label}
                  </span>
                )}
              </div>
              <h3 className="font-manrope font-bold text-[#0d1c2e] text-base leading-tight line-clamp-1">
                {listing.title ?? "Apartment"}
              </h3>
              {listing.address && (
                <div className="flex items-center gap-1 text-[#767683] text-xs mt-0.5">
                  <MapPin size={10} />
                  <span className="line-clamp-1">{listing.address}</span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="text-right shrink-0">
              <div className="font-manrope font-extrabold text-[#000666] text-xl whitespace-nowrap">
                {(listing.total_monthly_pln ?? listing.rent_pln)?.toLocaleString("pl-PL") ?? "—"} PLN
              </div>
              <div className="text-[#767683] text-[10px]">/mo total</div>
            </div>
          </div>

          {/* Specs row */}
          <div className="flex items-center gap-4 flex-wrap">
            {listing.rooms != null && <Spec label="Rooms" value={`${listing.rooms}`} />}
            {listing.area_m2 != null && <Spec label="Area" value={`${listing.area_m2} m²`} />}
            {listing.floor != null && <Spec label="Floor" value={`${listing.floor}`} />}
            {listing.is_furnished != null && (
              <div className="flex items-center gap-1">
                {listing.is_furnished
                  ? <CheckCircle size={11} className="text-[#006b5f]" />
                  : <XCircle size={11} className="text-[#94a3b8]" />}
                <span className="text-xs font-medium text-[#454652]">
                  {listing.is_furnished ? "Furnished" : "Unfurnished"}
                </span>
              </div>
            )}
            {listing.has_balcony && (
              <div className="flex items-center gap-1">
                <CheckCircle size={11} className="text-[#006b5f]" />
                <span className="text-xs font-medium text-[#454652]">Balcony</span>
              </div>
            )}
            {listing.available_from && (
              <div className="flex items-center gap-1 text-[#767683] text-xs">
                <Calendar size={10} />
                <span>From {listing.available_from}</span>
              </div>
            )}
          </div>

          <ListingEnrichmentChips listing={listing} />

          {/* AI criterion scores — separate from environment / geo chips above */}
          {isPending ? (
            <div
              className={cn(
                "flex gap-2",
                listingHasEnrichmentChips(listing) && "pt-2.5 mt-1 border-t border-dashed border-[rgba(198,197,212,0.25)]"
              )}
            >
              <span className="sr-only">Scoring criteria</span>
              {[80, 64, 72].map((w) => (
                <div key={w} className="h-5 rounded-full bg-[#f1f5f9] animate-pulse" style={{ width: w }} />
              ))}
            </div>
          ) : breakdown.length > 0 ? (
            <div
              className={cn(
                "flex flex-col gap-1.5",
                listingHasEnrichmentChips(listing) && "pt-2.5 mt-1 border-t border-dashed border-[rgba(198,197,212,0.25)]"
              )}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#767683] w-full">
                Match to your profile
              </span>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.map((item) => (
                  <div
                    key={item.criterion}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                      criterionColor(item.criterion)
                    )}
                    title={item.note}
                  >
                    <span>{item.criterion}</span>
                    <span className="font-bold">{item.score}/10</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* AI reasoning */}
          {!isPending && reasoning && (
            <div className="flex items-start gap-2 bg-[rgba(0,6,102,0.03)] border border-[rgba(0,6,102,0.06)] rounded-xl px-3 py-2.5">
              <Zap size={10} className="text-[#000666] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[#454652] leading-relaxed italic line-clamp-2">
                &ldquo;{reasoning}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Right: score + actions */}
        <div className="w-32 bg-[rgba(239,244,255,0.4)] border-l border-[rgba(198,197,212,0.12)] flex flex-col items-center justify-center py-5 px-3 shrink-0 gap-3">
          {isPending || overallScore == null ? (
            <div className="w-16 h-16 rounded-full bg-[#f1f5f9] animate-pulse flex items-center justify-center">
              <span className="text-[#94a3b8] text-[9px] font-semibold text-center leading-tight">Scoring…</span>
            </div>
          ) : (
            <MatchScore score={overallScore} />
          )}

          <button
            onClick={() => onOpenDetail(listing, scored)}
            className="w-full bg-[#000666] text-white text-[10px] font-semibold py-2 rounded-xl hover:opacity-90 transition-opacity text-center"
          >
            Details
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleShortlist(listing, scored); }}
            title={isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all border",
              isShortlisted
                ? "bg-[#e6faf7] text-[#006b5f] border-[rgba(0,107,95,0.25)]"
                : "bg-white text-[#454652] border-[rgba(198,197,212,0.4)] hover:border-[#000666] hover:text-[#000666]"
            )}
          >
            {isShortlisted ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
            {isShortlisted ? "Saved" : "Shortlist"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-[#767683] leading-none mb-0.5">{label}</span>
      <span className="text-xs font-semibold text-[#0d1c2e]">{value}</span>
    </div>
  );
}
