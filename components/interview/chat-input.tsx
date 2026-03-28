"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend?: (message: string) => void;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder = "Type your response..." }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() && onSend) {
      onSend(value.trim());
      setValue("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="bg-white rounded-xl shadow-sm pr-14 pl-6 py-4 text-sm">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full outline-none text-[#0d1c2e] placeholder-[#6b7280] bg-transparent text-sm"
        />
      </div>
      <button
        type="submit"
        className="absolute right-3 top-3 w-8 h-8 bg-[#000666] rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <Send size={14} className="text-white" />
      </button>
    </form>
  );
}
