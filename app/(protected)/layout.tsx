import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function ProtectedAuth({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return <>{children}</>;
}

function ProtectedAuthFallback() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center text-[#454652] text-sm">
      Loading…
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ProtectedAuthFallback />}>
      <ProtectedAuth>{children}</ProtectedAuth>
    </Suspense>
  );
}
