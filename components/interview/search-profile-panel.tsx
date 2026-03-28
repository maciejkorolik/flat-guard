import { SearchProfile } from "@/lib/types/flatguard";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchProfilePanelProps {
  profile: SearchProfile | null;
  isReady?: boolean;
}

export function SearchProfilePanel({ profile, isReady = false }: SearchProfilePanelProps) {
  const isEmpty = !profile;

  return (
    <div className="w-[450px] bg-white border-l border-[rgba(226,232,240,0.1)] h-full flex flex-col shrink-0">
      {/* Panel header */}
      <div className="backdrop-blur-sm bg-white/80 border-b border-[rgba(226,232,240,0.1)] px-6 py-5 flex items-center justify-between">
        <div>
          <h3 className="font-manrope font-extrabold text-[#0d1c2e] text-base tracking-tight">Search Profile</h3>
          <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest mt-0.5">
            {isEmpty ? "Starting..." : `Version ${profile.version}`}
          </p>
        </div>
        <span className="bg-[#dce9ff] border border-[rgba(0,6,102,0.05)] text-[#000666] text-[10px] font-semibold rounded-full px-3 py-1">
          Draft
        </span>
      </div>

      {/* Profile content */}
      <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-8">
        {/* Target City — always shown */}
        <div className="relative">
          <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest block mb-3">
            Target City
          </p>
          <div className="bg-[#eff4ff] rounded-lg px-4 py-3 text-sm text-[#6b7280] flex items-center justify-between">
            <span>{profile?.city || "Awaiting selection..."}</span>
            {!profile?.city && (
              <span className="bg-[#8df5e4] border border-[rgba(0,107,95,0.2)] text-[#007165] text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded">
                Required
              </span>
            )}
          </div>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-40">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-[#0d1c2e] text-xs font-semibold text-center mb-1">Your Profile is Empty</p>
            <p className="text-[#454652] text-[10px] text-center max-w-[200px] leading-relaxed">
              As you chat with the Curator, your preferences will be automatically populated here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest block mb-2">
                Monthly Budget
              </p>
              <div className="bg-[#eff4ff] rounded-lg px-4 py-3 text-sm font-semibold text-[#0d1c2e]">
                €{profile.budgetMonthly.toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest block mb-2">Min Rooms</p>
                <div className="bg-[#eff4ff] rounded-lg px-4 py-3 text-sm font-semibold text-[#0d1c2e]">{profile.minRooms}+</div>
              </div>
              <div>
                <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest block mb-2">Min Area</p>
                <div className="bg-[#eff4ff] rounded-lg px-4 py-3 text-sm font-semibold text-[#0d1c2e]">{profile.minAreaM2} m²</div>
              </div>
            </div>
            {profile.preferredDistricts.length > 0 && (
              <div>
                <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest block mb-2">Preferred Districts</p>
                <div className="flex flex-wrap gap-2">
                  {profile.preferredDistricts.map((d) => (
                    <span key={d} className="bg-[#eff4ff] text-[#000666] text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                      {d}
                      <X size={10} />
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest">Pets Allowed</p>
              <div className={cn(
                "w-10 h-6 rounded-full flex items-center px-1 transition-colors",
                profile.petsAllowed ? "bg-[#006b5f]" : "bg-gray-200"
              )}>
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full shadow transition-transform",
                  profile.petsAllowed ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
            </div>
            {profile.dealBreakers.length > 0 && (
              <div>
                <p className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest block mb-2">Deal-Breakers</p>
                <div className="bg-red-50 rounded-lg p-3 flex flex-wrap gap-2">
                  {profile.dealBreakers.map((d) => (
                    <span key={d} className="text-red-700 text-xs font-medium">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="border-t border-[rgba(226,232,240,0.2)] px-6 py-6">
        <button
          disabled={isEmpty || !isReady}
          className={cn(
            "w-full flex items-center justify-center gap-3 py-4 rounded-xl text-sm font-extrabold font-manrope tracking-wide transition-colors",
            isEmpty || !isReady
              ? "bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed"
              : "bg-gradient-to-r from-[#000666] to-[#1a237e] text-white hover:opacity-90"
          )}
        >
          <span aria-hidden="true">🚀</span> Run Search Profile
        </button>
      </div>
    </div>
  );
}
