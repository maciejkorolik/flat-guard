import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { DbProject } from "@/lib/types/flatguard";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: DbProject;
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-[#006b5f]", bg: "bg-[#e6faf7]" },
  archived: { label: "Archived", color: "text-[#64748b]", bg: "bg-[#f1f5f9]" },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;

  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col group border border-[rgba(198,197,212,0.1)] hover:shadow-md transition-shadow">
      {/* Cover image or gradient fallback */}
      <div className="h-32 bg-gradient-to-br from-[#000666] via-[#1a237e] to-[#006b5f] relative flex items-end p-5 overflow-hidden">
        {project.cover_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_image}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        )}
        <div className="absolute top-4 left-4">
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-sm",
              statusCfg.bg,
              statusCfg.color
            )}
          >
            {statusCfg.label}
          </span>
        </div>
        <h3 className="font-manrope font-bold text-white text-xl leading-tight line-clamp-2">
          {project.name}
        </h3>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1 gap-4">
        <div className="flex items-center gap-1.5 text-[#767683]">
          <Clock size={12} />
          <span className="text-[11px] font-medium">
            Updated {formatTimeAgo(project.updated_at)}
          </span>
        </div>

        <div className="flex gap-3 mt-auto pt-2">
          <Link
            href={`/project/${project.id}/interview`}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#000666] to-[#1a237e] text-white text-sm font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Continue Interview
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
