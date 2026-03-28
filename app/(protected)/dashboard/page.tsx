import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NewProjectCard } from "@/components/dashboard/new-project-card";
import type { DbProject } from "@/lib/types/flatguard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects = [] } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  return (
    <AppShell breadcrumbs={[{ label: "My Projects", active: true }]}>
      <div className="px-10 py-10 flex flex-col gap-12 max-w-[1200px]">
        {/* Header */}
        <div>
          <h1 className="font-manrope font-extrabold text-[#0d1c2e] text-4xl tracking-tight">
            My Projects
          </h1>
          <p className="text-[#454652] text-base mt-2 leading-relaxed max-w-md">
            Manage your active apartment hunts and curated shortlists across European tech hubs.
          </p>
        </div>

        {/* Project grid */}
        <div className="grid grid-cols-2 gap-8">
          {(projects as DbProject[]).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          <NewProjectCard />
        </div>
      </div>
    </AppShell>
  );
}
