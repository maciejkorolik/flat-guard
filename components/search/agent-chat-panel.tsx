import { Send } from "lucide-react";

interface AgentMessage {
  role: "user" | "ai";
  content: string;
}

const AGENT_MESSAGES: AgentMessage[] = [
  { role: "user", content: "How much extra is a 2nd bedroom costing me on average in this search?" },
  { role: "ai", content: "In Ixelles and Saint-Gilles, a 2nd bedroom adds approximately €320 to the monthly rent based on current results." },
];

const QUICK_ACTIONS = ["Compare top 3", "Why 82 score?"];

export function AgentChatPanel() {
  return (
    <div className="w-96 bg-white border-l border-[rgba(198,197,212,0.1)] flex flex-col shrink-0">
      <div className="bg-[rgba(239,244,255,0.2)] border-b border-[rgba(198,197,212,0.1)] px-6 py-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-[#006b5f] rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <h3 className="font-manrope font-bold text-[#0d1c2e] text-sm">Agent Insight</h3>
        </div>
        <p className="text-[#454652] text-xs leading-relaxed">
          I found 14 properties matching your Profile v3. The Ixelles residence is particularly interesting given your priority for natural light.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {AGENT_MESSAGES.map((msg, i) => (
          <div
            key={i}
            className={`p-4 rounded-2xl text-xs leading-relaxed text-[#0d1c2e] ${
              msg.role === "user"
                ? "bg-[#eff4ff] border border-[rgba(198,197,212,0.05)] rounded-tl-none"
                : "bg-[rgba(0,107,95,0.05)] border border-[rgba(0,107,95,0.2)] rounded-tr-none"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div className="border-t border-[rgba(198,197,212,0.1)] p-4 flex flex-col gap-4">
        <div className="flex gap-2 flex-wrap">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              className="bg-[#dce9ff] text-[#000666] text-[10px] font-semibold px-3 py-1.5 rounded-full hover:bg-[#c5d9ff] transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
        <div className="relative">
          <div className="bg-[#eff4ff] rounded-xl px-4 py-3 pr-10">
            <input
              placeholder="Ask follow-up..."
              aria-label="Ask agent a follow-up question"
              className="w-full bg-transparent text-sm outline-none text-[#0d1c2e] placeholder-[rgba(118,118,131,0.6)]"
            />
          </div>
          <button
            aria-label="Send question"
            className="absolute right-3 top-2.5 w-6 h-6 bg-[rgba(0,6,102,0.05)] rounded-lg flex items-center justify-center"
          >
            <Send size={12} className="text-[#000666]" />
          </button>
        </div>
      </div>
    </div>
  );
}
