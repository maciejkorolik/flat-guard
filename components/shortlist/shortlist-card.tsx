import type { DbShortlistEntry, NormalizedListing, ScoredListing } from "@/lib/types/flatguard";
import { BookmarkCheck, Calendar, ExternalLink, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortlistCardProps {
  entry: DbShortlistEntry;
}

const STATUS_CONFIG: Record<DbShortlistEntry["status"], { label: string; text: string; bg: string }> = {
  contacted: { label: "Contacted", text: "text-[#006b5f]", bg: "bg-[#e6faf7]" },
  saved: { label: "Saved", text: "text-[#000666]", bg: "bg-[#eff4ff]" },
  rejected: { label: "Rejected", text: "text-red-600", bg: "bg-red-50" },
  rented: { label: "Rented", text: "text-amber-700", bg: "bg-amber-50" },
};

function isScoredListing(snapshot: DbShortlistEntry["listing_snapshot"]): snapshot is ScoredListing {
  return "overallScore" in snapshot;
}

function formatPrice(listing: ScoredListing["listing"] | NormalizedListing): string {
  const amount = listing.total_monthly_pln ?? listing.rent_pln;
  return amount != null ? `${amount.toLocaleString("pl-PL")} PLN` : "Price unavailable";
}

function formatSavedDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function ShortlistCard({ entry }: ShortlistCardProps) {
  const statusStyle = STATUS_CONFIG[entry.status];
  const scoredSnapshot = isScoredListing(entry.listing_snapshot) ? entry.listing_snapshot : null;
  const listing = entry.listing_snapshot.listing;
  const isRejected = entry.status === "rejected";
  const fallbackAddress =
    [listing.district, listing.city].filter(Boolean).join(", ") || "Location unavailable";
  const address = listing.address ?? fallbackAddress;

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-[rgba(198,197,212,0.1)] shadow-sm hover:shadow-md transition-shadow",
        isRejected && "opacity-70"
      )}
    >
      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={cn("text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full", statusStyle.text, statusStyle.bg)}>
                {statusStyle.label}
              </span>
              {scoredSnapshot && (
                <span className="bg-[#006b5f] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  {scoredSnapshot.overallScore}%
                </span>
              )}
              {scoredSnapshot?.recommendation && (
                <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[rgba(0,6,102,0.05)] text-[#454652]">
                  {scoredSnapshot.recommendation} match
                </span>
              )}
            </div>
            <h3 className="font-manrope font-bold text-[#0d1c2e] text-xl leading-tight">
              {listing.title ?? "Apartment"}
            </h3>
            <div className="flex items-center gap-1.5 text-[#454652] text-sm mt-2">
              <MapPin size={13} />
              <span>{address}</span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="font-manrope font-extrabold text-[#000666] text-2xl">
              {formatPrice(listing)}
            </div>
            <div className="text-[#767683] text-xs">Saved {formatSavedDate(entry.created_at)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Detail label="Rooms" value={listing.rooms != null ? String(listing.rooms) : "—"} />
          <Detail label="Area" value={listing.area_m2 != null ? `${listing.area_m2} m²` : "—"} />
          <Detail label="Floor" value={listing.floor != null ? String(listing.floor) : "—"} />
          <Detail label="Available" value={listing.available_from ?? "Flexible"} />
        </div>

        {scoredSnapshot?.reasoning && (
          <div className="rounded-xl border border-[rgba(0,6,102,0.07)] bg-[rgba(0,6,102,0.03)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#767683] mb-1.5">
              AI Summary
            </p>
            <p className="text-sm text-[#454652] leading-relaxed">{scoredSnapshot.reasoning}</p>
          </div>
        )}

        {entry.notes && (
          <div className="rounded-xl bg-[#f8f9ff] px-4 py-3 border border-[rgba(198,197,212,0.18)]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#767683] mb-1.5">
              Notes
            </p>
            <p className="text-sm text-[#454652] leading-relaxed">{entry.notes}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-[#006b5f] text-sm font-medium">
            <BookmarkCheck size={15} />
            <span>Saved from search</span>
          </div>

          <div className="flex items-center gap-3">
            {listing.available_from && (
              <div className="flex items-center gap-1.5 text-[#767683] text-xs">
                <Calendar size={12} />
                <span>From {listing.available_from}</span>
              </div>
            )}
            {listing.url && (
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#000666] text-sm font-semibold hover:opacity-70 transition-opacity"
              >
                <ExternalLink size={14} />
                Open listing
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f8fafc] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#767683] mb-1">
        {label}
      </p>
      <p className="text-sm font-semibold text-[#0d1c2e]">{value}</p>
    </div>
  );
}
