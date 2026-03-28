"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Loader2, CheckCircle2, AlertCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedListing, ScoredListing } from "@/lib/types/flatguard";
import { mergeScoredListingsWithEnrichment } from "@/lib/scored-listing-enrichment";
import type { NearbyPlaceRow, SearchFlatsResultRow } from "@/lib/flat-search-chat-tools";
import {
  SearchFlatsToolUI,
  FlatSearchCardDataUI,
  GeoDataToolUI,
  SunDataToolUI,
  WeatherToolUI,
  AirQualityToolUI,
  PlacesNearbyToolUI,
  ExplainabilityToolUI,
  EnrichmentCoverageToolUI,
  ListingDetailsToolUI,
  GetListingsToolUI,
} from "./flat-chat-tool-ui";

const TOOL_LABELS: Record<string, { running: string; done: string }> = {
  searchFlats: { running: "Searching flats…", done: "Search complete" },
  getFlatSearchCardData: { running: "Loading card…", done: "Card loaded" },
  getGeoData: { running: "Loading map data…", done: "Location loaded" },
  getSunData: { running: "Loading sunlight…", done: "Sunlight loaded" },
  getWeatherData: { running: "Loading weather…", done: "Weather loaded" },
  getAirQualityData: { running: "Loading air quality…", done: "Air quality loaded" },
  getPlacesNearby: { running: "Loading nearby places…", done: "Nearby loaded" },
  getSearchExplainability: { running: "Summarizing signals…", done: "Summary ready" },
  getEnrichmentCoverage: { running: "Checking enrichment…", done: "Coverage loaded" },
  getListingDetails: {
    running: "Loading full listing details…",
    done: "Loaded listing details",
  },
  getListings: {
    running: "Loading all scored results…",
    done: "Loaded results",
  },
  addToShortlist: {
    running: "Saving to your shortlist…",
    done: "Shortlist updated",
  },
};

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-[#0d1c2e]">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-[#000666] underline font-medium break-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="bg-[#e2e8f0] px-1 py-0.5 rounded text-[11px] font-mono">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-[#0d1c2e] text-[#f1f5f9] p-2 rounded-lg text-[11px] overflow-x-auto mb-2">
            {children}
          </pre>
        ),
        h1: ({ children }) => (
          <h3 className="font-manrope font-bold text-sm mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        h2: ({ children }) => (
          <h3 className="font-manrope font-bold text-sm mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        h3: ({ children }) => (
          <h3 className="font-manrope font-bold text-sm mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#000666]/25 pl-2 my-2 text-[#454652]">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function ToolUseRow({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;

  const name = getToolName(part);
  const labels = TOOL_LABELS[name] ?? {
    running: `Working…`,
    done: `Done`,
  };

  if (part.state === "output-available") {
    const isShortlist = name === "addToShortlist";
    const out = part.output as {
      ok?: boolean;
      title?: string;
      alreadyExists?: boolean;
      error?: string;
    };

    if (isShortlist && out?.error) {
      return (
        <div className="flex items-start gap-2.5 self-start rounded-2xl border border-red-200/80 bg-red-50/90 px-3 py-2.5 text-xs text-red-800 max-w-[min(100%,36rem)] shadow-sm shadow-red-900/5">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{out.error}</span>
        </div>
      );
    }

    if (isShortlist && out?.ok) {
      return (
        <div
          className={cn(
            "flex items-start gap-2.5 self-start rounded-2xl border px-3 py-2.5 text-xs max-w-[min(100%,36rem)]",
            "bg-gradient-to-br from-teal-50 to-emerald-50/80 text-[#006b5f] border-teal-200/50 shadow-sm shadow-teal-900/5"
          )}
        >
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {out.alreadyExists ? "Already on shortlist" : "Added to shortlist"}
            </p>
            {out.title && (
              <p className="text-[#006b5f]/90 mt-0.5 leading-snug">{out.title}</p>
            )}
          </div>
        </div>
      );
    }

    const rich =
      name === "searchFlats" ? (
        <SearchFlatsToolUI
          output={part.output as { results?: SearchFlatsResultRow[]; count?: number; error?: string }}
        />
      ) : name === "getFlatSearchCardData" ? (
        <FlatSearchCardDataUI output={part.output as Record<string, unknown>} />
      ) : name === "getGeoData" ? (
        <GeoDataToolUI output={part.output as Record<string, unknown>} />
      ) : name === "getSunData" ? (
        <SunDataToolUI output={part.output as Record<string, unknown>} />
      ) : name === "getWeatherData" ? (
        <WeatherToolUI output={part.output as Record<string, unknown>} />
      ) : name === "getAirQualityData" ? (
        <AirQualityToolUI output={part.output as Record<string, unknown>} />
      ) : name === "getPlacesNearby" ? (
        <PlacesNearbyToolUI output={part.output as { places?: NearbyPlaceRow[]; error?: string }} />
      ) : name === "getSearchExplainability" ? (
        <ExplainabilityToolUI output={part.output as Record<string, unknown>} />
      ) : name === "getEnrichmentCoverage" ? (
        <EnrichmentCoverageToolUI
          output={
            part.output as {
              signals?: { name: string; status: string | null; fetchedAt: string | null }[];
              error?: string;
            }
          }
        />
      ) : name === "getListingDetails" ? (
        <ListingDetailsToolUI output={part.output as Record<string, unknown>} />
      ) : name === "getListings" ? (
        <GetListingsToolUI output={part.output} />
      ) : null;

    if (rich) return <div className="self-start max-w-full">{rich}</div>;

    return (
      <div className="flex items-center gap-2.5 self-start rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-xs text-slate-600 max-w-[min(100%,36rem)] shadow-sm">
        <Wrench size={13} className="shrink-0 text-indigo-600/80" />
        <span className="font-medium">{labels.done}</span>
      </div>
    );
  }

  if (part.state === "output-error") {
    return (
      <div className="flex items-start gap-2.5 self-start rounded-2xl border border-red-200/80 bg-red-50/90 px-3 py-2.5 text-xs text-red-800 max-w-[min(100%,36rem)] shadow-sm">
        <AlertCircle size={15} className="shrink-0 mt-0.5" />
        <span>{part.errorText ?? "Something went wrong"}</span>
      </div>
    );
  }

  if (part.state === "output-denied") {
    return (
      <div className="flex items-center gap-2.5 self-start rounded-2xl border border-slate-200/60 bg-slate-50/80 px-3 py-2 text-xs text-slate-500 max-w-[min(100%,36rem)]">
        <AlertCircle size={13} className="shrink-0" />
        <span>Action cancelled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 self-start rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs text-slate-600 max-w-[min(100%,36rem)] shadow-sm shadow-slate-900/5 backdrop-blur-sm">
      <Loader2 size={13} className="shrink-0 animate-spin text-indigo-600" />
      <span className="font-medium">{labels.running}</span>
    </div>
  );
}

interface SearchChatPanelProps {
  projectId: string;
  scoredListings: ScoredListing[];
  /** Full rows from DB (enrichment); merged into each scored listing sent to the API */
  rawListings: NormalizedListing[];
  /** True only when the scoring stream finished and every shown listing has a score */
  assistantReady: boolean;
  onShortlistFromChat: (listingId: string) => void;
}

const QUICK_PROMPTS = [
  "Which listing is the best value?",
  "Add the top match to shortlist",
  "Compare the top 3",
  "Which has the best commute?",
];

export function SearchChatPanel({
  projectId,
  scoredListings,
  rawListings,
  assistantReady,
  onShortlistFromChat,
}: SearchChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasGreeted = useRef(false);

  const scoredListingsForApi = useMemo(
    () => mergeScoredListingsWithEnrichment(scoredListings, rawListings),
    [scoredListings, rawListings]
  );

  // useChat keeps the first transport forever unless `id` changes — body was stuck at initial [].
  // Inject fresh listings on every POST via prepareSendMessagesRequest + ref.
  const scoredListingsRef = useRef(scoredListingsForApi);
  scoredListingsRef.current = scoredListingsForApi;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/search/${projectId}/chat`,
        prepareSendMessagesRequest: ({
          id,
          messages: chatMessages,
          body: requestBody,
          trigger,
          messageId,
          headers,
          credentials,
          api: reqApi,
        }) => ({
          api: reqApi,
          headers,
          credentials,
          body: {
            ...(requestBody && typeof requestBody === "object" ? requestBody : {}),
            id,
            messages: chatMessages,
            trigger,
            messageId,
            scoredListings: scoredListingsRef.current,
          },
        }),
      }),
    [projectId]
  );

  const { messages, status, sendMessage } = useChat({
    id: `search-chat-${projectId}`,
    transport,
    experimental_throttle: 30,
  });

  useEffect(() => {
    hasGreeted.current = false;
  }, [projectId]);

  // Open the assistant only after every listing has been analyzed (scores complete)
  useEffect(() => {
    if (assistantReady && !hasGreeted.current) {
      hasGreeted.current = true;
      sendMessage({ text: "__hello__" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantReady]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Watch for addToShortlist tool completions
  useEffect(() => {
    for (const msg of messages) {
      for (const part of msg.parts ?? []) {
        const p = part as Record<string, unknown>;
        if (
          p.type === "tool-addToShortlist" &&
          p.state === "output-available" &&
          p.output
        ) {
          const out = p.output as { ok?: boolean; listing_id?: string };
          if (out.ok && out.listing_id) {
            onShortlistFromChat(out.listing_id);
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const isStreaming = status === "streaming" || status === "submitted";

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage({ text: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  const displayMessages = messages.filter(
    (m) =>
      !(
        m.role === "user" &&
        m.parts?.some(
          (p) => (p as Record<string, unknown>).text === "__hello__"
        )
      )
  );

  return (
    <aside className="flex h-full w-[min(32rem,100%)] min-w-[21rem] shrink-0 flex-col border-l border-slate-200/90 bg-gradient-to-b from-slate-50/95 via-white to-white">
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-slate-200/60 bg-white/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#000666] to-[#1e3a8a] shadow-md shadow-indigo-900/15 ring-2 ring-white">
            <Sparkles size={18} className="text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-manrope font-bold text-[#0d1c2e] text-[0.9375rem] tracking-tight">
                Search Assistant
              </p>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-100">
                AI
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 leading-snug">
              Compare listings · shortlist · ask follow-ups
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">
        {!assistantReady && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
              <Loader2 size={22} className="animate-spin text-indigo-500" />
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-[16rem]">
              Unlocks when every listing has been scored for this run.
            </p>
          </div>
        )}

        {assistantReady && displayMessages.length === 0 && scoredListings.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
              <Sparkles size={20} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-[17rem]">
              No listings this time. Ask how to widen your search or tweak your profile.
            </p>
          </div>
        )}

        {displayMessages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-2">
            {msg.parts?.map((part, i) => {
              if (isToolUIPart(part)) {
                return <ToolUseRow key={i} part={part} />;
              }

              const p = part as Record<string, unknown>;

              if (p.type === "text" && typeof p.text === "string" && p.text) {
                const isAI = msg.role === "assistant";
                return (
                  <div
                    key={i}
                    className={cn(
                      "px-3.5 py-3 rounded-2xl text-[13px] leading-relaxed max-w-[min(100%,36rem)]",
                      isAI
                        ? "bg-white text-[#0d1c2e] self-start border border-slate-200/80 shadow-sm shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.03] [&_*]:text-inherit"
                        : "bg-gradient-to-br from-[#000666] to-[#1a237e] text-white self-end shadow-md shadow-indigo-900/20 whitespace-pre-wrap"
                    )}
                  >
                    {isAI ? (
                      <AssistantMarkdown content={p.text as string} />
                    ) : (
                      (p.text as string)
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex gap-1.5 items-center px-4 py-2.5 bg-white rounded-2xl self-start border border-slate-200/80 shadow-sm">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts — shown when no conversation yet */}
      {assistantReady &&
        displayMessages.filter((m) => m.role === "user").length === 0 &&
        scoredListings.length > 0 && (
          <div className="px-5 pb-3 flex flex-col gap-2 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-0.5">
              Suggestions
            </p>
            <div className="flex flex-col gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={isStreaming}
                  className="text-left text-xs text-slate-700 bg-white hover:bg-slate-50 hover:border-indigo-200 border border-slate-200/90 px-3.5 py-2.5 rounded-xl transition-all font-medium shadow-sm shadow-slate-900/[0.03] disabled:opacity-45 disabled:pointer-events-none active:scale-[0.99]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Input */}
      <div className="shrink-0 border-t border-slate-200/70 bg-white/80 backdrop-blur-md px-5 py-4">
        <div className="relative rounded-2xl border border-slate-200/90 bg-slate-50/80 shadow-inner shadow-slate-900/[0.03] focus-within:border-indigo-300/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!assistantReady || isStreaming}
            placeholder={
              !assistantReady
                ? "Scoring listings…"
                : isStreaming
                ? "Thinking…"
                : "Message the assistant…"
            }
            className="w-full bg-transparent rounded-2xl px-3.5 py-3 pr-12 text-sm text-[#0d1c2e] placeholder:text-slate-400 outline-none resize-none disabled:opacity-50 leading-relaxed"
          />
          <button
            type="button"
            onClick={() => handleSend(input)}
            disabled={!assistantReady || !input.trim() || isStreaming}
            aria-label="Send"
            className="absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#000666] to-[#1a237e] text-white shadow-md shadow-indigo-900/25 transition-all hover:brightness-110 active:scale-95 disabled:opacity-25 disabled:shadow-none disabled:hover:brightness-100"
          >
            <Send size={15} className="text-white -ml-0.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
