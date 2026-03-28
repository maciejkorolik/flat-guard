import type { DbSearchProfile } from "@/lib/types/flatguard";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface SearchProfilePanelProps {
  profile: DbSearchProfile | null;
  projectId: string;
}

export function SearchProfilePanel({ profile, projectId }: SearchProfilePanelProps) {
  const city = profile?.preferred_cities?.[0] ?? null;
  const budget = profile?.budget_target_pln ?? null;
  const rooms = profile?.rooms_preferred ?? null;
  const area = profile?.area_m2_preferred ?? null;
  const districts = profile?.preferred_districts ?? [];
  const features = profile?.preferred_features ?? [];
  const dislikes = profile?.disliked_features ?? [];
  const availability = profile?.availability_preferred ?? null;

  const isReady = !!(city && budget && rooms);
  const hasAnyData = !!(city || budget || rooms || area);

  return (
    <div className="w-[420px] bg-white border-l border-[rgba(226,232,240,0.15)] h-full flex flex-col shrink-0">
      {/* Panel header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-[rgba(226,232,240,0.15)] px-6 py-5 flex items-center justify-between shrink-0">
        <div>
          <h3 className="font-manrope font-extrabold text-[#0d1c2e] text-base tracking-tight">
            Search Profile
          </h3>
          <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest mt-0.5">
            {!hasAnyData ? "Listening…" : isReady ? "Ready to search" : "Building…"}
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] font-semibold rounded-full px-3 py-1 transition-colors",
            isReady
              ? "bg-[#8df5e4] border border-[rgba(0,107,95,0.2)] text-[#007165]"
              : "bg-[#dce9ff] border border-[rgba(0,6,102,0.05)] text-[#000666]"
          )}
        >
          {isReady ? "Ready" : "Draft"}
        </span>
      </div>

      {/* Profile fields — all always visible */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
        {/* Core fields — always shown */}
        <ProfileField
          label="Target City"
          value={city}
          highlight={!!city}
          placeholder="Awaiting city…"
        />

        <ProfileField
          label="Monthly Budget"
          value={budget ? `${budget.toLocaleString("pl-PL")} PLN / mo` : null}
          placeholder="Awaiting budget…"
        />

        <div className="grid grid-cols-2 gap-3">
          <ProfileField
            label="Rooms"
            value={rooms ? `${rooms}+` : null}
            placeholder="Awaiting…"
          />
          <ProfileField
            label="Min Area"
            value={area ? `${area} m²` : null}
            placeholder="Awaiting…"
          />
        </div>

        {/* Secondary fields — shown when filled */}
        {districts.length > 0 && (
          <TagField label="Preferred Districts" tags={districts} color="blue" />
        )}
        {features.length > 0 && (
          <TagField label="Must Have" tags={features} color="green" />
        )}
        {dislikes.length > 0 && (
          <TagField label="Deal-Breakers" tags={dislikes} color="red" />
        )}
        {availability && (
          <ProfileField label="Move-in" value={availability} placeholder="" />
        )}
      </div>

      {/* CTA */}
      <div className="border-t border-[rgba(226,232,240,0.2)] px-6 py-5 shrink-0">
        {isReady && (
          <div className="flex items-center gap-2 text-[#006b5f] text-xs font-medium mb-3">
            <CheckCircle2 size={14} />
            <span>Profile ready — you can run your first search</span>
          </div>
        )}
        {isReady ? (
          <Link
            href={`/project/${projectId}/search?autorun=1`}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-extrabold font-manrope tracking-wide bg-gradient-to-r from-[#000666] to-[#1a237e] text-white hover:opacity-90 shadow-lg shadow-[#000666]/20 transition-opacity"
          >
            <span aria-hidden="true">🚀</span> Run Search
          </Link>
        ) : (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-extrabold font-manrope tracking-wide bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed"
          >
            <span aria-hidden="true">🚀</span> Run Search
          </button>
        )}
        {!isReady && (
          <p className="text-center text-[#94a3b8] text-[10px] mt-2.5">
            Keep chatting to unlock your search
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  placeholder,
  highlight = false,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  highlight?: boolean;
}) {
  const empty = !value;
  return (
    <div>
      <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest mb-2">
        {label}
      </p>
      <div
        className={cn(
          "rounded-lg px-4 py-3 text-sm transition-all duration-300",
          empty
            ? "bg-[#f8fafc] border border-dashed border-[rgba(198,197,212,0.5)] text-[#94a3b8]"
            : highlight
            ? "bg-[#000666] text-white font-semibold"
            : "bg-[#eff4ff] text-[#0d1c2e] font-medium"
        )}
      >
        {empty ? placeholder : value}
      </div>
    </div>
  );
}

function TagField({
  label,
  tags,
  color,
}: {
  label: string;
  tags: string[];
  color: "blue" | "green" | "red";
}) {
  const tagStyles = {
    blue: "bg-[#eff4ff] text-[#000666]",
    green: "bg-[#e6faf7] text-[#006b5f]",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div>
      <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn("text-xs font-medium px-3 py-1 rounded-full", tagStyles[color])}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
