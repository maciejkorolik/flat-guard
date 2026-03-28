import { createClient } from "@/lib/supabase/server";
import { SearchClient } from "@/components/search/search-client";
import type { DbSearchProfile } from "@/lib/types/flatguard";

interface SearchPageProps {
  params: Promise<{ id: string }>;
}

export default async function SearchPage({ params }: SearchPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("project_id", id)
    .eq("is_current", true)
    .maybeSingle();

  return (
    <SearchClient
      projectId={id}
      profile={(profile as DbSearchProfile) ?? null}
    />
  );
}
