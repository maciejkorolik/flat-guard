import Link from "next/link";
import { MapPin, ArrowRight, Copy } from "lucide-react";
import { Project } from "@/lib/types/flatguard";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Active ${days}d ago`;
}

const STATUS_STYLES: Record<Project["status"], string> = {
  shortlist: "text-[#006b5f]",
  search: "text-[#d97706]",
  interview: "text-[#64748b]",
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col group">
      {/* Image */}
      <div className="h-48 overflow-hidden relative">
        <img
          src={project.imageUrl}
          alt={project.name}
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-100 group-hover:scale-105"
        />
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="backdrop-blur-sm bg-white/90 rounded-full px-3 py-1 shadow-sm">
            <span className={cn("text-[10px] font-semibold uppercase tracking-widest", STATUS_STYLES[project.status])}>
              {project.status}
            </span>
          </div>
          {project.aiMatched && (
            <div className="bg-[#006b5f] rounded-full px-3 py-1 flex items-center gap-1 shadow-sm">
              <span className="text-white text-[10px] font-semibold uppercase tracking-widest">AI Matched</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-manrope font-bold text-[#0d1c2e] text-xl leading-tight">{project.name}</h3>
              <div className="flex items-center gap-1 mt-1">
                <MapPin size={10} className="text-[#454652]" />
                <span className="text-[#454652] text-base">{project.city}, {project.country}</span>
              </div>
            </div>
            <span className="text-[#767683] text-[10px] font-semibold uppercase tracking-tight mt-1">
              {formatTimeAgo(project.lastActiveAt)}
            </span>
          </div>

          <div className="border-t border-b border-[rgba(198,197,212,0.1)] py-4 my-4 grid grid-cols-3 gap-4">
            {[
              { label: "Budget", value: `€${project.budgetMonthly.toLocaleString()}/mo` },
              { label: "Rooms", value: `${project.minRooms}+ BR` },
              { label: "Listings", value: `${project.savedListings} Saved` },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[#454652] text-[10px] font-semibold uppercase tracking-widest mb-1">{label}</div>
                <div className={cn(
                  "font-manrope font-bold text-base",
                  label === "Listings" ? "text-[#006b5f]" : "text-[#000666]"
                )}>{value}</div>
              </div>
            ))}
          </div>

          <p className="text-[#454652] text-sm leading-relaxed line-clamp-2 mb-6">{project.description}</p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/project/${project.id}/interview`}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#000666] to-[#1a237e] text-white text-sm font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Open project
            <ArrowRight size={12} />
          </Link>
          <button className="bg-[#dce9ff] flex items-center justify-center px-4 py-2 rounded-lg hover:bg-[#c5d9ff] transition-colors">
            <Copy size={16} className="text-[#000666]" />
          </button>
        </div>
      </div>
    </div>
  );
}
