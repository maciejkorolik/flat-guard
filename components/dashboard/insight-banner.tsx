import { TrendingUp } from "lucide-react";

interface InsightBannerProps {
  cityName: string;
  message: string;
}

export function InsightBanner({ cityName, message }: InsightBannerProps) {
  return (
    <div
      className="border border-[rgba(0,107,95,0.1)] rounded-2xl p-6 flex items-center gap-8 relative overflow-hidden"
      style={{ background: "linear-gradient(172deg, #ffffff 0%, #eff4ff 50%, rgba(0,107,95,0.05) 100%)" }}
    >
      <div className="absolute bottom-[-64px] right-[-64px] w-64 h-64 bg-[rgba(0,107,95,0.05)] rounded-full blur-3xl" />
      <div className="bg-[rgba(0,107,95,0.1)] w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
        <TrendingUp size={22} className="text-[#006b5f]" />
      </div>
      <div className="flex-1 relative z-10">
        <h4 className="font-manrope font-bold text-[#0d1c2e] text-lg mb-1">{"Curator's Weekly Insight"}</h4>
        <p className="text-[#454652] text-sm leading-relaxed">
          Based on your activity in{" "}
          <span className="font-semibold text-[#000666]">{cityName}</span>
          {", "}{message}
        </p>
      </div>
      <button className="border border-[rgba(0,107,95,0.2)] rounded-lg px-6 py-2 text-[#006b5f] text-xs font-semibold uppercase tracking-widest hover:bg-[rgba(0,107,95,0.05)] transition-colors shrink-0 relative z-10">
        View Data
      </button>
    </div>
  );
}
