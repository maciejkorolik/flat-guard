import { MOCK_PROJECTS } from "@/lib/mock/projects";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NewProjectCard } from "@/components/dashboard/new-project-card";
import { InsightBanner } from "@/components/dashboard/insight-banner";

export default function DashboardPage() {
  return (
    <AppShell breadcrumbs={[{ label: "My Projects", active: true }]}>
      <div className="px-10 py-10 flex flex-col gap-12 max-w-[1200px]">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-manrope font-extrabold text-[#0d1c2e] text-4xl tracking-tight">My Projects</h1>
            <p className="text-[#454652] text-base mt-2 leading-relaxed max-w-md">
              Manage your active apartment hunts and curated shortlists across European tech hubs.
            </p>
          </div>
          <div className="bg-[#eff4ff] rounded-lg p-1 flex items-center">
            <button className="bg-white shadow-sm rounded px-4 py-2 text-[#000666] text-xs font-semibold uppercase tracking-widest">
              Grid
            </button>
            <button className="px-4 py-2 text-[#454652] text-xs font-medium uppercase tracking-widest">
              List
            </button>
          </div>
        </div>

        {/* Project grid */}
        <div className="grid grid-cols-2 gap-8">
          {MOCK_PROJECTS.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          <NewProjectCard />
        </div>

        {/* Insight banner */}
        <InsightBanner
          cityName="Warsaw"
          message="average rents in Mokotów have dipped by 4% this month. It might be a good time to increase your shortlist activity there."
        />
      </div>
    </AppShell>
  );
}
