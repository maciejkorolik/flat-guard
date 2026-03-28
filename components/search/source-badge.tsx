import { cn } from "@/lib/utils";

const SOURCE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  olx:    { label: "OLX",    bg: "bg-[#00963A]", text: "text-white" },
  otodom: { label: "Otodom", bg: "bg-[#EC3B21]", text: "text-white" },
  gratka: { label: "Gratka", bg: "bg-[#0071BC]", text: "text-white" },
};

interface SourceBadgeProps {
  source: string | null;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  if (!source) return null;
  const cfg = SOURCE_CONFIG[source.toLowerCase()] ?? {
    label: source.toUpperCase(),
    bg: "bg-[#64748b]",
    text: "text-white",
  };

  return (
    <span
      className={cn(
        "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm",
        cfg.bg,
        cfg.text,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
