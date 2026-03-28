"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, RotateCcw, Search, CheckCircle2, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoredListingCard } from "./scored-listing-card";
import type { NormalizedListing, ScoredListing, DbSearchProfile } from "@/lib/types/flatguard";

type Phase = "idle" | "phase1" | "phase2" | "done";
type SortKey = "score" | "price_asc" | "price_desc";

interface SearchClientProps {
  projectId: string;
  profile: DbSearchProfile | null;
}

function ScanningDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-[#000666] rounded-full animate-pulse-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

function PhaseBar({
  phase,
  found,
  scored,
  total,
}: {
  phase: Phase;
  found: number;
  scored: number;
  total: number;
}) {
  const p1Done = phase === "phase2" || phase === "done";
  const p2Active = phase === "phase2";
  const p2Done = phase === "done";

  return (
    <div className="flex items-center gap-4">
      {/* Phase 1 */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
            p1Done ? "bg-[#8df5e4] text-[#006b5f]" : "bg-[#000666] text-white"
          )}
        >
          {p1Done ? <CheckCircle2 size={12} /> : "1"}
        </div>
        <span className="text-xs font-semibold text-[#0d1c2e] whitespace-nowrap">
          Database scan
        </span>
        {!p1Done && <ScanningDots />}
        {p1Done && found > 0 && (
          <span className="text-[11px] font-medium text-[#006b5f]">{found} found</span>
        )}
      </div>

      <div className="w-8 h-px bg-[rgba(198,197,212,0.5)] shrink-0" />

      {/* Phase 2 */}
      <div className={cn("flex items-center gap-2", !p1Done && "opacity-30")}>
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
            p2Done
              ? "bg-[#8df5e4] text-[#006b5f]"
              : p2Active
              ? "bg-[#000666] text-white"
              : "bg-[rgba(0,6,102,0.1)] text-[#000666]"
          )}
        >
          {p2Done ? <CheckCircle2 size={12} /> : "2"}
        </div>
        <span className="text-xs font-semibold text-[#0d1c2e] whitespace-nowrap">
          AI scoring
        </span>
        {p2Active && (
          <>
            <ScanningDots />
            <span className="text-[11px] font-medium text-[#767683]">
              {scored} / {total}
            </span>
          </>
        )}
        {p2Done && (
          <span className="text-[11px] font-medium text-[#006b5f]">complete</span>
        )}
      </div>
    </div>
  );
}

function sortListings(
  listings: NormalizedListing[],
  scoreMap: Map<string, ScoredListing>,
  key: SortKey
): NormalizedListing[] {
  return [...listings].sort((a, b) => {
    if (key === "score") {
      const sa = scoreMap.get(a.id)?.overallScore ?? -1;
      const sb = scoreMap.get(b.id)?.overallScore ?? -1;
      return sb - sa;
    }
    const pa = a.total_monthly_pln ?? a.rent_pln ?? 0;
    const pb = b.total_monthly_pln ?? b.rent_pln ?? 0;
    return key === "price_asc" ? pa - pb : pb - pa;
  });
}

export function SearchClient({ projectId, profile }: SearchClientProps) {
  const searchParams = useSearchParams();
  const autorun = searchParams.get("autorun") === "1";
  const isReady = !!(
    profile?.preferred_cities?.length &&
    profile?.budget_target_pln &&
    profile?.rooms_preferred
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [rawListings, setRawListings] = useState<NormalizedListing[]>([]);
  const [scoreMap, setScoreMap] = useState<Map<string, ScoredListing>>(new Map());
  const [sortKey, setSortKey] = useState<SortKey | "none">("none");
  const started = useRef(false);

  const runSearch = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setPhase("phase1");
    setRawListings([]);
    setScoreMap(new Map());

    try {
      // Phase 1: fetch raw listings
      const listingsRes = await fetch(`/api/search/${projectId}/listings`);
      if (!listingsRes.ok) {
        setPhase("idle");
        started.current = false;
        return;
      }
      const { listings } = (await listingsRes.json()) as { listings: NormalizedListing[] };
      setRawListings(listings);
      setPhase("phase2");

      // Phase 2: stream AI scores one by one via SSE
      const scoreRes = await fetch(`/api/search/${projectId}/run`, { method: "POST" });
      if (!scoreRes.ok || !scoreRes.body) {
        setPhase("done");
        return;
      }

      const reader = scoreRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const data = part.slice(6).trim();
          if (data === "[DONE]") { setPhase("done"); break; }
          try {
            const scored = JSON.parse(data) as ScoredListing;
            setScoreMap((prev) => new Map(prev).set(scored.listing.id, scored));
          } catch {
            // malformed chunk, skip
          }
        }
      }
      setPhase("done");
    } catch {
      setPhase("idle");
      started.current = false;
    }
  }, [projectId]);

  // Auto-run when navigated from interview with ?autorun=1
  useEffect(() => {
    if (autorun && isReady && !started.current) {
      runSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorun, isReady]);

  function handleRerun() {
    started.current = false;
    runSearch();
  }

  if (phase === "idle") {
    return (
      <IdleView profile={profile} isReady={isReady} onRun={runSearch} />
    );
  }

  const sorted =
    phase === "done" && sortKey !== "none"
      ? sortListings(rawListings, scoreMap, sortKey)
      : rawListings;
  const scoredCount = scoreMap.size;
  const isDone = phase === "done";

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="bg-[#eff4ff] border-b border-[rgba(198,197,212,0.12)] px-8 py-5 shrink-0">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h2 className="font-manrope font-extrabold text-[#0d1c2e] text-xl tracking-tight mb-2">
              {isDone
                ? `${rawListings.length} listings — AI scored`
                : phase === "phase1"
                ? "Scanning database…"
                : `${rawListings.length} listings found — scoring…`}
            </h2>
            <PhaseBar
              phase={phase}
              found={rawListings.length}
              scored={scoredCount}
              total={rawListings.length}
            />
          </div>

          {isDone && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <ArrowUpDown size={12} className="text-[#767683]" />
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey | "none")}
                  aria-label="Sort results"
                  className="bg-white border border-[rgba(198,197,212,0.3)] rounded-lg px-3 py-1.5 text-[#000666] text-xs font-semibold outline-none"
                >
                  <option value="none">Original order</option>
                  <option value="score">Highest Match Score</option>
                  <option value="price_asc">Lowest Price</option>
                  <option value="price_desc">Highest Price</option>
                </select>
              </div>
              <button
                onClick={handleRerun}
                className="bg-[#000666] text-white flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <RotateCcw size={11} /> Re-run
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards list — min-h-0 enables overflow scrolling; space-y-4 avoids flex shrink */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-4">
        {phase === "phase1" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 bg-[#eff4ff] rounded-2xl flex items-center justify-center">
              <Search size={22} className="text-[#000666] animate-pulse" />
            </div>
            <p className="text-[#454652] text-sm font-medium">
              Querying database for matching listings…
            </p>
          </div>
        )}

        {sorted.map((listing, i) => (
          <ScoredListingCard
            key={listing.id}
            listing={listing}
            scored={scoreMap.get(listing.id)}
            animationDelay={i * 60}
          />
        ))}

      </div>
    </div>
  );
}

function IdleView({
  profile,
  isReady,
  onRun,
}: {
  profile: DbSearchProfile | null;
  isReady: boolean;
  onRun: () => void;
}) {
  const city = (profile?.preferred_cities as string[] | null)?.[0];
  const budget = profile?.budget_target_pln as number | null;
  const rooms = profile?.rooms_preferred as number | null;

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-8 bg-[#f8f9ff]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-[#eff4ff] rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Search size={28} className="text-[#000666]" />
        </div>
        <h2 className="font-manrope font-extrabold text-[#0d1c2e] text-2xl tracking-tight mb-3">
          Ready to find your flat
        </h2>
        <p className="text-[#767683] text-sm leading-relaxed">
          {isReady
            ? "Your profile is set. Phase 1 pulls matching listings from the database, then the AI scores each one."
            : "Complete your interview first — we need at least a city, budget, and room count to search."}
        </p>
      </div>

      {profile && (
        <div className="flex flex-wrap gap-2 justify-center max-w-sm">
          {city && <Chip label="City" value={city} color="primary" />}
          {budget && (
            <Chip label="Budget" value={`${budget.toLocaleString("pl-PL")} PLN`} color="primary" />
          )}
          {rooms && <Chip label="Rooms" value={`${rooms}+`} color="secondary" />}
        </div>
      )}

      <button
        onClick={onRun}
        disabled={!isReady}
        className={cn(
          "flex items-center gap-3 px-10 py-4 rounded-2xl text-sm font-extrabold font-manrope tracking-wide transition-all",
          isReady
            ? "bg-gradient-to-r from-[#000666] to-[#1a237e] text-white hover:opacity-90 shadow-xl shadow-[#000666]/20"
            : "bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed"
        )}
      >
        <Sparkles size={16} />
        {isReady ? "Run AI Search" : "Complete interview first"}
      </button>

      {isReady && (
        <p className="text-[#94a3b8] text-[11px]">
          Phase 1: database filter · Phase 2: AI scoring
        </p>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "primary" | "secondary";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
        color === "primary"
          ? "bg-[#eff4ff] text-[#000666] border border-[rgba(0,6,102,0.1)]"
          : "bg-[#e6faf7] text-[#006b5f] border border-[rgba(0,107,95,0.15)]"
      )}
    >
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
