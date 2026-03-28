import { cn } from "@/lib/utils";

interface MatchScoreProps {
  score: number;
  size?: "sm" | "md";
}

export function MatchScore({ score, size = "md" }: MatchScoreProps) {
  const isLarge = size === "md";
  const dim = isLarge ? 80 : 60;
  const high = score >= 85;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "rounded-full flex items-center justify-center border-2",
          high
            ? "bg-[rgba(0,107,95,0.06)] border-[rgba(0,107,95,0.3)]"
            : "bg-[rgba(0,6,102,0.05)] border-[rgba(0,6,102,0.15)]"
        )}
        style={{ width: dim, height: dim }}
      >
        <span className={cn(
          "font-manrope font-extrabold",
          isLarge ? "text-2xl" : "text-xl",
          high ? "text-[#006b5f]" : "text-[#000666]"
        )}>
          {score}
        </span>
      </div>
      <span className="text-[#767683] text-[10px] font-semibold uppercase tracking-widest">
        Match Score
      </span>
    </div>
  );
}
