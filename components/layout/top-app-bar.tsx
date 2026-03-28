import { Bell, Settings } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  active?: boolean;
}

interface TopAppBarProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function TopAppBar({ breadcrumbs = [] }: TopAppBarProps) {
  return (
    <header className="fixed top-0 right-0 left-52 h-16 bg-white/70 backdrop-blur-xl border-b border-[rgba(226,232,240,0.2)] flex items-center justify-between px-8 z-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-6">
        {breadcrumbs.map((item, i) => (
          <span
            key={i}
            className={
              item.active
                ? "font-manrope font-semibold text-[#312e81] text-sm tracking-tight"
                : "font-manrope text-[#94a3b8] text-sm tracking-tight"
            }
          >
            {item.label}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-[#454652]" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Settings size={20} className="text-[#454652]" />
        </button>
        <div className="w-8 h-8 rounded-full bg-[#d5e3fc] border border-[rgba(198,197,212,0.2)] flex items-center justify-center text-[#000666] font-semibold text-sm">
          U
        </div>
      </div>
    </header>
  );
}
