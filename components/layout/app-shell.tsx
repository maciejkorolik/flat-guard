import { SideNav } from "./side-nav";
import { TopAppBar } from "./top-app-bar";

interface AppShellProps {
  children: React.ReactNode;
  projectId?: string;
  activeProject?: string;
  breadcrumbs?: { label: string; active?: boolean }[];
}

export function AppShell({ children, projectId, activeProject, breadcrumbs }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <SideNav projectId={projectId} activeProject={activeProject} />
      <TopAppBar breadcrumbs={breadcrumbs} />
      <main className="pl-64 pt-16 min-h-screen">
        {children}
      </main>
    </div>
  );
}
