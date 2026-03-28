interface FilterItem {
  label: string;
  value: string;
  sublabel: string;
  color: "blue" | "green";
}

// TODO: wire these values to the active search run's profile config
const FILTERS: FilterItem[] = [
  { label: "Max Price", value: "€1,850", sublabel: "Max budget", color: "blue" },
  { label: "Min Area", value: "65 m²", sublabel: "Minimum", color: "blue" },
  { label: "Score Threshold", value: "85% Match", sublabel: "Threshold", color: "green" },
  { label: "Price Fit Weight", value: "High Impact", sublabel: "Weighting", color: "blue" },
];

export function FilterBar() {
  return (
    <div className="bg-white/50 border border-[rgba(198,197,212,0.2)] rounded-xl p-5 grid grid-cols-4 gap-8">
      {FILTERS.map(({ label, value, sublabel, color }) => (
        <div key={label} className="flex flex-col gap-2">
          <span className="text-[#767683] text-xs font-semibold uppercase tracking-widest">{label}</span>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${color === "green" ? "text-[#006b5f]" : "text-[#0d1c2e]"}`}>
              {value}
            </span>
            <span className="text-[#767683] text-xs">{sublabel}</span>
          </div>
          <div className={`h-1.5 rounded-full ${color === "green" ? "bg-[#8df5e4]" : "bg-[#d5e3fc]"}`} />
        </div>
      ))}
    </div>
  );
}
