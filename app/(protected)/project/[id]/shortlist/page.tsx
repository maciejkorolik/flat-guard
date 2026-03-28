import { ShortlistCard } from "@/components/shortlist/shortlist-card";
import { createClient } from "@/lib/supabase/server";
import type { DbShortlistEntry } from "@/lib/types/flatguard";

interface ShortlistPageProps {
  params: Promise<{ id: string }>;
}

export default async function ShortlistPage({ params }: ShortlistPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entries = [] } = await supabase
    .from("shortlist_entries")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="px-10 py-10 flex flex-col gap-8 max-w-[1100px]">
      <div>
        <h2 className="font-manrope font-extrabold text-[#0d1c2e] text-3xl tracking-tight">My Shortlist</h2>
        <p className="text-[#454652] text-sm mt-1">
          {entries.length === 0
            ? "Save promising listings from Search to build your shortlist."
            : `${entries.length} propert${entries.length === 1 ? "y" : "ies"} saved`}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[rgba(198,197,212,0.45)] bg-white px-8 py-16 text-center">
          <h3 className="font-manrope font-bold text-[#0d1c2e] text-xl">No shortlisted listings yet</h3>
          <p className="text-[#454652] text-sm mt-2 max-w-md mx-auto leading-relaxed">
            Run a search, then click the Shortlist button on any result you want to keep.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {(entries as DbShortlistEntry[]).map((entry) => (
            <ShortlistCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
