import { getSearchRuns } from "@/lib/mock/listings";
import { FilterBar } from "@/components/search/filter-bar";
import { ListingCard } from "@/components/search/listing-card";
import { AgentChatPanel } from "@/components/search/agent-chat-panel";
import { RotateCcw, List, Map } from "lucide-react";

interface SearchPageProps {
  params: Promise<{ id: string }>;
}

export default async function SearchPage({ params }: SearchPageProps) {
  const { id } = await params;
  // TODO: fetch from DB: supabase.from('search_runs').select('*, listings(*)').eq('project_id', id).order('run_number', { ascending: false })
  const runs = getSearchRuns(id);
  const latestRun = runs.find((r) => r.isLatest) ?? runs[0];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Search header */}
      <div className="bg-[#eff4ff] border-b border-[rgba(198,197,212,0.1)] px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-manrope font-extrabold text-[#0d1c2e] text-2xl tracking-tight">
              Search run #{latestRun.runNumber} - based on Profile v{latestRun.profileVersion}
            </h2>
            <div className="flex items-center gap-4 mt-1.5">
              {runs.map((run, i) => (
                <div key={run.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[#767683] text-xs">→</span>}
                  <div className={`w-2 h-2 rounded-full ${run.isLatest ? "bg-[#000666]" : "bg-[#006b5f]"}`} />
                  <span className={`text-sm ${run.isLatest ? "font-semibold text-[#000666]" : "text-[#454652]"}`}>
                    Run #{run.runNumber}{run.isLatest ? " (Latest)" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#d5e3fc] p-1 rounded-lg flex items-center gap-1">
              <button className="bg-white shadow-sm flex items-center gap-2 px-4 py-1.5 rounded text-[#000666] text-sm font-semibold">
                <List size={14} /> List
              </button>
              <button className="flex items-center gap-2 px-4 py-1.5 text-[#454652] text-sm">
                <Map size={14} /> Map
              </button>
            </div>
            <button className="bg-[#000666] text-white flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              <RotateCcw size={12} /> Re-run
            </button>
          </div>
        </div>
        <FilterBar />
      </div>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="text-[#454652] text-sm font-medium">
              Showing <span className="text-[#0d1c2e] font-semibold">{latestRun.listings.length} Curated Matches</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[#767683] text-xs font-medium">Sort by:</span>
              <select
                aria-label="Sort listings by"
                className="bg-white border border-[rgba(198,197,212,0.3)] rounded-lg px-3 py-1 text-[#000666] text-xs font-semibold outline-none"
              >
                <option>Highest Match Score</option>
                <option>Lowest Price</option>
                <option>Largest Area</option>
              </select>
            </div>
          </div>
          {latestRun.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
        <AgentChatPanel />
      </div>
    </div>
  );
}
