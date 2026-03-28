import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import { redirect } from "next/navigation";

function ProtectedShellFallback() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <span className="text-sm font-medium tracking-tight">App</span>
        <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
      </header>
      <main className="flex-1 p-6">
        <div className="h-4 max-w-xs animate-pulse rounded bg-muted" />
      </main>
    </div>
  );
}

async function ProtectedAuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <span className="text-sm font-medium tracking-tight">App</span>
        <LogoutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasEnvVars) {
    redirect("/auth/login");
  }

  return (
    <Suspense fallback={<ProtectedShellFallback />}>
      <ProtectedAuthShell>{children}</ProtectedAuthShell>
    </Suspense>
  );
}
