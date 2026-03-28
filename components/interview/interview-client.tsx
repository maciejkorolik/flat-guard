"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useMemo, useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchProfilePanel } from "./search-profile-panel";
import type { DbSearchProfile } from "@/lib/types/flatguard";

interface InterviewClientProps {
  projectId: string;
  initialProfile: DbSearchProfile | null;
}

function TypingIndicator() {
  return (
    <div className="flex gap-4 max-w-xl">
      <div className="w-8 h-8 bg-[#8df5e4] rounded-lg flex items-center justify-center shrink-0">
        <span className="text-[#006b5f] text-xs font-bold">AI</span>
      </div>
      <div className="bg-white border border-[rgba(0,107,95,0.05)] rounded-lg rounded-tl-none px-4 py-3 flex items-center gap-1.5 shadow-sm">
        <span className="w-1.5 h-1.5 bg-[#006b5f] rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-[#006b5f] rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-[#006b5f] rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function ProfileUpdateBadge() {
  return (
    <div className="flex items-center gap-2 text-[#006b5f] text-[11px] font-medium py-1 pl-12">
      <Sparkles size={11} className="animate-pulse shrink-0" />
      <span className="opacity-70">Updating your profile…</span>
    </div>
  );
}

interface MessageBubbleProps {
  role: string;
  text: string;
}

function MessageBubble({ role, text }: MessageBubbleProps) {
  const isAI = role === "assistant";
  return (
    <div className={cn("flex gap-3 max-w-xl", !isAI && "ml-auto flex-row-reverse")}>
      {isAI && (
        <div className="w-8 h-8 bg-[#8df5e4] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[#006b5f] text-xs font-bold">AI</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className={cn("text-[#454652] text-[10px] font-semibold px-1", !isAI && "text-right")}>
          {isAI ? "FlatGuard Curator" : "You"}
        </span>
        <div
          className={cn(
            "px-4 py-3 text-sm leading-relaxed shadow-sm",
            isAI
              ? "bg-white text-[#0d1c2e] border border-[rgba(0,107,95,0.05)] rounded-tl-none rounded-lg"
              : "bg-[#000666] text-white rounded-tr-none rounded-lg"
          )}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export function InterviewClient({ projectId, initialProfile }: InterviewClientProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: `/api/interview/${projectId}` }),
    experimental_throttle: 30,
  });

  // Auto-start interview on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      sendMessage({ text: "__start__" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Extract latest search profile from tool results in messages
  const searchProfile = useMemo<DbSearchProfile | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg.parts) continue;
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j] as Record<string, unknown>;
        if (
          part.type === "tool-updateSearchProfile" &&
          part.state === "output-available" &&
          part.output
        ) {
          return part.output as DbSearchProfile;
        }
      }
    }
    return initialProfile;
  }, [messages, initialProfile]);

  // Filter the auto-start trigger from display
  const displayMessages = messages.filter(
    (m) =>
      !(
        m.role === "user" &&
        m.parts?.some(
          (p) => (p as Record<string, unknown>).type === "text" && (p as Record<string, unknown>).text === "__start__"
        )
      )
  );

  const isStreaming = status === "streaming" || status === "submitted";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const showTyping = status === "submitted";

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* ── Left: Chat Panel ── */}
      <div className="flex-1 flex flex-col bg-[#eff4ff] border-r border-[rgba(226,232,240,0.15)] min-w-0">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-sm border-b border-[rgba(226,232,240,0.2)] px-6 py-4 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-[#000666] rounded-xl flex items-center justify-center shrink-0">
            <MessageSquare size={16} className="text-white" />
          </div>
          <div>
            <h2 className="font-manrope font-bold text-[#0d1c2e] text-base leading-tight">
              Interview with FlatGuard AI
            </h2>
            <p className="text-[#454652] text-[11px] font-medium leading-tight">
              Tell me what you're looking for — I'll build your search profile
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-5">
          {displayMessages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-1">
              {msg.parts?.map((part, i) => {
                const p = part as Record<string, unknown>;
                if (p.type === "text" && typeof p.text === "string" && p.text) {
                  return <MessageBubble key={i} role={msg.role} text={p.text} />;
                }
                if (
                  p.type === "tool-updateSearchProfile" &&
                  p.state !== "output-available"
                ) {
                  return <ProfileUpdateBadge key={i} />;
                }
                return null;
              })}
            </div>
          ))}

          {showTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white/60 backdrop-blur-sm border-t border-[rgba(226,232,240,0.2)] px-6 py-4 shrink-0">
          <form onSubmit={handleSubmit} className="relative">
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(198,197,212,0.2)] pr-14 pl-5 py-3.5">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? "Curator is thinking…" : "Type your response…"}
                disabled={isStreaming}
                className="w-full outline-none text-[#0d1c2e] placeholder-[#94a3b8] bg-transparent text-sm resize-none disabled:opacity-50 leading-relaxed"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              aria-label="Send message"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#000666] rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <Send size={14} className="text-white" />
            </button>
          </form>
        </div>
      </div>

      {/* ── Right: Search Profile Panel ── */}
      <SearchProfilePanel profile={searchProfile} />
    </div>
  );
}
