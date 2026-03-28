"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function NewProjectCard() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (pathname === "/dashboard") setIsLoading(false);
  }, [pathname]);

  async function handleCreate() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Apartment Hunt" }),
      });
      const { data, error } = await res.json();
      if (error) throw new Error(error);
      setIsLoading(false);
      router.push(`/project/${data.id}/interview`);
    } catch {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={isLoading}
      className="bg-[#eff4ff] border-2 border-dashed border-[rgba(198,197,212,0.3)] rounded-xl p-10 flex flex-col items-center justify-center text-center min-h-[200px] hover:bg-[#dce9ff] hover:border-[rgba(0,6,102,0.2)] transition-all group disabled:opacity-60 disabled:cursor-not-allowed w-full"
    >
      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-6 group-hover:shadow-md transition-shadow">
        {isLoading ? (
          <Loader2 size={22} className="text-[#000666] animate-spin" />
        ) : (
          <Plus size={25} className="text-[#000666]" />
        )}
      </div>
      <h3 className="font-manrope font-bold text-[#000666] text-lg mb-2">
        {isLoading ? "Creating…" : "Start a New Hunt"}
      </h3>
      <p className="text-[#454652] text-sm max-w-[240px] leading-relaxed">
        Define your criteria and let FlatGuard curator start finding your next home.
      </p>
    </button>
  );
}
