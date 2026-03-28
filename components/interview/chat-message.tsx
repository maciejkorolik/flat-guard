import { ChatMessage } from "@/lib/types/flatguard";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessage;
}

function formatTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60000) return "Just now";
  return new Date(isoString).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isAI = message.role === "ai";

  return (
    <div className={cn("flex gap-4 max-w-xl", !isAI && "ml-auto flex-row-reverse")}>
      {isAI && (
        <div className="w-8 h-8 bg-[#8df5e4] rounded-lg flex items-center justify-center shrink-0 mt-5">
          <span className="text-[#006b5f] text-xs font-bold">AI</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className={cn("flex items-center gap-2", !isAI && "flex-row-reverse")}>
          <span className="text-[#0d1c2e] text-xs font-semibold">
            {isAI ? "FlatGuard Curator" : "You"}
          </span>
          <span className="text-[#454652] text-[10px]">{formatTime(message.timestamp)}</span>
        </div>
        <div
          className={cn(
            "px-4 py-3 text-sm text-[#0d1c2e] leading-relaxed shadow-sm",
            isAI
              ? "bg-white border border-[rgba(0,107,95,0.05)] rounded-tl-none rounded-lg"
              : "bg-[#000666] text-white rounded-tr-none rounded-lg"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
