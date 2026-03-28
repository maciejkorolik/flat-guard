import { MOCK_CHAT_MESSAGES, MOCK_SEARCH_PROFILE } from "@/lib/mock/interview";
import { ChatMessageBubble } from "@/components/interview/chat-message";
import { ChatInput } from "@/components/interview/chat-input";
import { SearchProfilePanel } from "@/components/interview/search-profile-panel";
import { MessageSquare } from "lucide-react";

export default function InterviewPage() {
  // TODO: fetch from DB: supabase.from('chat_messages').select().eq('project_id', id)
  // TODO: fetch profile from DB: supabase.from('search_profiles').select().eq('project_id', id).single()
  const messages = MOCK_CHAT_MESSAGES;
  const profile = MOCK_SEARCH_PROFILE;
  const hasProfile = profile.city !== "";

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left: Chat Panel */}
      <div className="flex-1 flex flex-col bg-[#eff4ff] border-r border-[rgba(226,232,240,0.1)]">
        <div className="bg-white/50 border-b border-[rgba(226,232,240,0.2)] px-6 py-5">
          <div className="flex items-center gap-2">
            <MessageSquare size={22} className="text-[#006b5f]" />
            <h2 className="font-manrope font-bold text-[#0d1c2e] text-lg">Interview with FlatGuard AI</h2>
          </div>
          <p className="text-[#454652] text-xs mt-1 font-medium">
            Helping you refine your architectural living preferences
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
        </div>
        <div className="bg-white/50 p-6">
          <ChatInput placeholder="Type your response..." />
        </div>
      </div>

      {/* Right: Search Profile Panel */}
      <SearchProfilePanel
        profile={hasProfile ? profile : null}
        isReady={hasProfile && profile.preferredDistricts.length > 0}
      />
    </div>
  );
}
