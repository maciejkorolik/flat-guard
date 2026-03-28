import { notFound } from "next/navigation";
import { getProject } from "@/lib/mock/projects";
import { AppShell } from "@/components/layout/app-shell";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params;
  const project = getProject(id);

  if (!project) notFound();

  return (
    <AppShell
      projectId={id}
      activeProject={project.city}
      breadcrumbs={[
        { label: project.name },
        { label: `Profile v3`, active: true },
      ]}
    >
      {children}
    </AppShell>
  );
}
