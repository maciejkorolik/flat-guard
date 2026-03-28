import { cn } from "@/lib/utils";

interface MatchScoreProps {
  score: number;
  size?: "sm" | "md";
}

export function MatchScore({ score, size = "md" }: MatchScoreProps) {
  const isLarge = size === "md";
  const dim = isLarge ? 112 : 80;
  const high = score >= 85;
  const pentagon = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center"
        style={{ width: dim, height: dim }}
      >
        <div
          className={cn("absolute inset-0", high ? "bg-[rgba(0,107,95,0.05)]" : "bg-[rgba(0,6,102,0.04)]")}
          style={{ clipPath: pentagon }}
        />
        <div
          className={cn("absolute", high ? "bg-[rgba(0,107,95,0.15)]" : "bg-[rgba(0,6,102,0.08)]")}
          style={{ clipPath: pentagon, inset: `${dim * 0.1}px` }}
        />
        <span className={cn(
          "relative z-10 font-manrope font-extrabold",
          isLarge ? "text-3xl" : "text-2xl",
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
