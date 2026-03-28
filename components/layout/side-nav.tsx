"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Search, Bookmark, TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SideNavProps {
  projectId?: string;
  activeProject?: string;
}

const NAV_ITEMS = [
  { label: "Interview", icon: MessageSquare, href: (id: string) => `/project/${id}/interview` },
  { label: "Search", icon: Search, href: (id: string) => `/project/${id}/search` },
  { label: "Shortlist", icon: Bookmark, href: (id: string) => `/project/${id}/shortlist` },
  { label: "Deal-flow", icon: TrendingUp, href: (id: string) => `/project/${id}/deal-flow` },
];

export function SideNav({ projectId, activeProject }: SideNavProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#f8fafc] flex flex-col justify-between p-4 z-20">
      {/* Logo */}
      <div className="flex flex-col gap-8">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-[#000666] rounded flex items-center justify-center">
            <span className="text-white font-semibold text-sm">F</span>
          </div>
          <div>
            <div className="font-manrope font-bold text-[#312e81] text-xl leading-none">FlatGuard</div>
            {activeProject && (
              <div className="text-[#64748b] text-xs mt-0.5">{activeProject}</div>
            )}
          </div>
        </Link>

        {/* Nav items — only show when inside a project */}
        {projectId && (
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
              const itemHref = href(projectId);
              const isActive = pathname.startsWith(itemHref);
              return (
                <Link
                  key={label}
                  href={itemHref}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-white shadow-sm text-[#047857] font-medium"
                      : "text-[#64748b] hover:text-[#0d1c2e] hover:bg-white/50"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="flex flex-col gap-2">
        {projectId && (
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[#64748b] hover:text-[#0d1c2e] rounded-lg"
          >
            <TrendingUp size={15} />
            Project History
          </Link>
        )}
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 bg-[#000666] text-white text-sm font-bold font-manrope px-4 py-3 rounded-lg shadow-[0px_10px_15px_-3px_rgba(0,6,102,0.2)] hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          New Project
        </Link>
      </div>
    </aside>
  );
}
