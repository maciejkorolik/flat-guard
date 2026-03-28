import { ShortlistEntry } from "@/lib/types/flatguard";
import { MapPin, Phone, Mail, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortlistCardProps {
  entry: ShortlistEntry;
}

const STATUS_CONFIG: Record<ShortlistEntry["status"], { label: string; text: string }> = {
  contacted: { label: "Contacted", text: "text-[#006b5f]" },
  saved: { label: "Saved", text: "text-[#000666]" },
  rejected: { label: "Rejected", text: "text-red-600" },
};

export function ShortlistCard({ entry }: ShortlistCardProps) {
  const { listing, status, notes, gaps } = entry;
  const statusStyle = STATUS_CONFIG[status];
  const isRejected = status === "rejected";

  return (
    <div className={cn(
      "bg-white rounded-xl overflow-hidden flex border border-[rgba(198,197,212,0.1)] shadow-sm hover:shadow-md transition-shadow",
      isRejected && "opacity-70"
    )}>
      {/* Image */}
      <div className="w-56 shrink-0 relative">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <span className={cn("text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-sm bg-white/90", statusStyle.text)}>
            {statusStyle.label}
          </span>
        </div>
        {gaps > 0 && (
          <div className="absolute top-3 right-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
              <AlertTriangle size={9} />
              {gaps} gap{gaps > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-manrope font-bold text-[#0d1c2e] text-xl">{listing.title}</h3>
            <span className="bg-[#006b5f] text-white text-xs font-bold px-2 py-0.5 rounded">
              {listing.matchScore}%
            </span>
          </div>
          <div className="flex items-center gap-1 text-[#454652] text-sm mb-4">
            <MapPin size={12} />
            {listing.address}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest mb-1">Monthly Rent</p>
              <div className="font-manrope font-bold text-[#000666] text-lg">
                €{listing.rentMonthly.toLocaleString()}
              </div>
            </div>
            <div>
              <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest mb-1">Surface Area</p>
              <div className="font-manrope font-bold text-[#000666] text-lg">{listing.areaM2} m²</div>
            </div>
          </div>

          <textarea
            defaultValue={notes}
            placeholder="Add your notes..."
            rows={2}
            aria-label="Notes for this listing"
            className="w-full bg-[#f8f9ff] rounded-lg px-3 py-2 text-sm text-[#454652] placeholder-[#94a3b8] outline-none resize-none border border-[rgba(198,197,212,0.2)] focus:border-[rgba(0,6,102,0.2)]"
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button
            disabled={isRejected}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#000666] to-[#1a237e] text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone size={14} />
            Call via AI
          </button>
          <button
            disabled={isRejected}
            aria-label="Send email"
            className="bg-[#eff4ff] flex items-center justify-center px-3 py-2.5 rounded-lg hover:bg-[#dce9ff] transition-colors disabled:opacity-50"
          >
            <Mail size={16} className="text-[#000666]" />
          </button>
        </div>
      </div>
    </div>
  );
}
