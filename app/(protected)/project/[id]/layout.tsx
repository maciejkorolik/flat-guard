import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function ProjectLayoutInner({ children, params }: ProjectLayoutProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (!project) notFound();

  return (
    <AppShell
      projectId={id}
      activeProject={project.name}
      breadcrumbs={[
        { label: project.name },
        { label: "Interview", active: true },
      ]}
    >
      {children}
    </AppShell>
  );
}

function ProjectLayoutFallback() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center text-[#454652] text-sm">
      Loading project…
    </div>
  );
}

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  return (
    <Suspense fallback={<ProjectLayoutFallback />}>
      <ProjectLayoutInner params={params}>{children}</ProjectLayoutInner>
    </Suspense>
  );
}
