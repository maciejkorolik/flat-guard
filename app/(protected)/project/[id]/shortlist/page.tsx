import { MOCK_SHORTLIST } from "@/lib/mock/interview";
import { ShortlistCard } from "@/components/shortlist/shortlist-card";
import { TrendingUp } from "lucide-react";

const FILTER_TABS = ["All Status", "Saved", "Contacted", "Rejected"] as const;

export default function ShortlistPage() {
  // TODO: fetch from DB: supabase.from('shortlist_entries').select('*, listings(*)').eq('project_id', id)
  const entries = MOCK_SHORTLIST;

  return (
    <div className="px-10 py-10 flex flex-col gap-8 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-manrope font-extrabold text-[#0d1c2e] text-3xl tracking-tight">My Shortlist</h2>
          <p className="text-[#454652] text-sm mt-1">{entries.length} properties saved</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {FILTER_TABS.map((tab, i) => (
          <button
            key={tab}
            className={
              i === 0
                ? "bg-[#000666] text-white text-sm font-semibold px-4 py-2 rounded-lg"
                : "bg-[#f8f9ff] text-[#454652] text-sm px-4 py-2 rounded-lg hover:bg-[#eff4ff] transition-colors border border-[rgba(198,197,212,0.2)]"
            }
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto">
          <select
            aria-label="Sort shortlist entries"
            className="bg-white border border-[rgba(198,197,212,0.3)] rounded-lg px-3 py-2 text-[#000666] text-xs font-semibold outline-none"
          >
            <option>Sort: Match Score</option>
            <option>Sort: Price</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {entries.map((entry) => (
          <ShortlistCard key={entry.id} entry={entry} />
        ))}
      </div>

      {/* AI Insight banner */}
      <div
        className="rounded-2xl p-6 flex items-start gap-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #000666 60%, rgba(0,107,95,0.3) 100%)" }}
      >
        <div className="bg-[rgba(0,107,95,0.3)] w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
          <TrendingUp size={18} className="text-[#8df5e4]" />
        </div>
        <div className="flex-1">
          <h4 className="font-manrope font-bold text-white text-base mb-1">Market Gap Analysis</h4>
          <p className="text-[rgba(255,255,255,0.7)] text-sm leading-relaxed mb-4">
            Based on your shortlist, there&apos;s a 98% match duplex near Place Van Meenen that you might have missed.
          </p>
          <button className="bg-[rgba(255,255,255,0.1)] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.15)] transition-colors border border-[rgba(255,255,255,0.1)]">
            Analyze Market Gaps
          </button>
        </div>
      </div>
    </div>
  );
}
