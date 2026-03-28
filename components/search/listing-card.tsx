import { Listing } from "@/lib/types/flatguard";
import { MatchScore } from "./match-score";
import { MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const belowBudget = listing.budgetDelta < 0;

  return (
    <div className="bg-white border border-[rgba(198,197,212,0.1)] rounded-2xl shadow-sm overflow-hidden flex hover:shadow-md transition-shadow group">
      {/* Image strip */}
      <div className="w-20 shrink-0 relative overflow-hidden">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {listing.verifiedAgent && (
          <div className="absolute top-3 left-3 backdrop-blur-sm bg-white/95 rounded-full px-2 py-1 flex items-center gap-1 shadow-sm">
            <CheckCircle size={10} className="text-[#000666]" />
            <span className="text-[#000666] text-[9px] font-bold uppercase leading-none">Verified</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 flex flex-col justify-between">
        <div className="flex items-start justify-between mb-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-manrope font-bold text-[#0d1c2e] text-2xl leading-tight">{listing.title}</h3>
            <div className="flex items-center gap-1.5 text-[#454652] text-sm">
              <MapPin size={12} />
              {listing.address}
            </div>
          </div>
          <div className="text-right flex flex-col gap-1">
            <div className="font-manrope font-extrabold text-[#000666] text-3xl">
              €{listing.rentMonthly.toLocaleString()}
              <span className="text-[#767683] text-sm font-normal ml-1">/mo</span>
            </div>
            <div className={cn(
              "text-xs font-semibold px-3 py-1 rounded-full inline-block",
              belowBudget ? "bg-[rgba(0,107,95,0.1)] text-[#006b5f]" : "text-[#454652]"
            )}>
              {belowBudget
                ? `€${Math.abs(listing.budgetDelta)} below budget`
                : listing.budgetDelta === 0
                  ? "Top limit of budget"
                  : `€${listing.budgetDelta} over budget`}
            </div>
          </div>
        </div>

        <div className="flex gap-8 mb-6">
          {[
            { label: "Area", value: `${listing.areaM2} m²` },
            { label: "Layout", value: `${listing.rooms} Room${listing.rooms !== 1 ? "s" : ""}` },
            { label: "Floor", value: listing.floor },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[#767683] text-[10px] font-semibold uppercase tracking-widest mb-1">{label}</div>
              <div className="text-[#0d1c2e] text-sm font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-[rgba(198,197,212,0.1)] pt-4 flex gap-5 items-center">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={12} className="text-[#006b5f]" />
            <span className="text-[#006b5f] text-xs font-semibold">within budget</span>
          </div>
          {listing.petsAllowed === null && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-[#d97706]" />
              <span className="text-[#604100] text-xs font-semibold">no pet info</span>
            </div>
          )}
          {listing.petsAllowed === true && (
            <div className="flex items-center gap-1.5">
              <CheckCircle size={12} className="text-[#006b5f]" />
              <span className="text-[#006b5f] text-xs font-semibold">pet friendly</span>
            </div>
          )}
          {listing.furnished && (
            <div className="flex items-center gap-1.5">
              <CheckCircle size={12} className="text-[#006b5f]" />
              <span className="text-[#006b5f] text-xs font-semibold">furnished</span>
            </div>
          )}
        </div>
      </div>

      {/* Match score + CTA */}
      <div className="w-44 bg-[rgba(239,244,255,0.2)] border-l border-[rgba(198,197,212,0.1)] flex flex-col items-center justify-between py-8 px-8 shrink-0">
        <MatchScore score={listing.matchScore} />
        <button className="w-full bg-[#000666] text-white text-xs font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-center">
          View Details
        </button>
      </div>
    </div>
  );
}
