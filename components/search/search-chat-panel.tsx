"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef } from "react";
import { Send, BookmarkCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoredListing } from "@/lib/types/flatguard";

interface SearchChatPanelProps {
  projectId: string;
  scoredListings: ScoredListing[];
  allDone: boolean;
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
  allDone,
  onShortlistFromChat,
}: SearchChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasGreeted = useRef(false);

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/search/${projectId}/chat`,
      body: { scoredListings },
    }),
    experimental_throttle: 30,
  });

  // Send a greeting once all listings are scored
  useEffect(() => {
    if (allDone && !hasGreeted.current) {
      hasGreeted.current = true;
      sendMessage({ text: "__hello__" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

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
    <div className="w-80 bg-white border-l border-[rgba(198,197,212,0.15)] flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[rgba(198,197,212,0.15)] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#000666] rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-white" />
          </div>
          <div>
            <p className="font-manrope font-bold text-[#0d1c2e] text-sm leading-tight">
              Search Assistant
            </p>
            <p className="text-[10px] text-[#767683] font-medium">
              Ask about results · add to shortlist
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {displayMessages.length === 0 && scoredListings.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-[#94a3b8] text-xs leading-relaxed">
              Run a search first — then ask me anything about the results.
            </p>
          </div>
        )}

        {displayMessages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            {msg.parts?.map((part, i) => {
              const p = part as Record<string, unknown>;

              if (p.type === "text" && typeof p.text === "string" && p.text) {
                const isAI = msg.role === "assistant";
                return (
                  <div
                    key={i}
                    className={cn(
                      "px-3 py-2.5 rounded-xl text-xs leading-relaxed max-w-[95%]",
                      isAI
                        ? "bg-[#f8fafc] text-[#0d1c2e] self-start border border-[rgba(198,197,212,0.2)]"
                        : "bg-[#000666] text-white self-end rounded-tr-none"
                    )}
                  >
                    {p.text as string}
                  </div>
                );
              }

              // Show shortlist confirmation chip
              if (
                p.type === "tool-addToShortlist" &&
                p.state === "output-available" &&
                p.output
              ) {
                const out = p.output as { ok?: boolean; title?: string; alreadyExists?: boolean };
                if (out.ok) {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 self-start bg-[#e6faf7] text-[#006b5f] text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[rgba(0,107,95,0.2)]"
                    >
                      <BookmarkCheck size={11} />
                      {out.alreadyExists ? "Already shortlisted" : `Added: ${out.title ?? "listing"}`}
                    </div>
                  );
                }
              }

              return null;
            })}
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex gap-1 items-center px-3 py-2 bg-[#f8fafc] rounded-xl self-start border border-[rgba(198,197,212,0.2)]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 bg-[#000666] rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts — shown when no conversation yet */}
      {displayMessages.filter((m) => m.role === "user").length === 0 &&
        scoredListings.length > 0 && (
          <div className="px-4 pb-3 flex flex-col gap-1.5 shrink-0">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                disabled={isStreaming}
                className="text-left text-[11px] text-[#000666] bg-[#eff4ff] hover:bg-[#dce9ff] px-3 py-2 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

      {/* Input */}
      <div className="border-t border-[rgba(198,197,212,0.15)] px-4 py-3 shrink-0">
        <div className="relative">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || scoredListings.length === 0}
            placeholder={
              scoredListings.length === 0
                ? "Waiting for results…"
                : isStreaming
                ? "Thinking…"
                : "Ask about results…"
            }
            className="w-full bg-[#f8fafc] border border-[rgba(198,197,212,0.3)] rounded-xl px-3 py-2.5 pr-10 text-xs text-[#0d1c2e] placeholder-[#94a3b8] outline-none resize-none disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isStreaming}
            aria-label="Send"
            className="absolute right-2.5 bottom-2.5 w-6 h-6 bg-[#000666] rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            <Send size={11} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
