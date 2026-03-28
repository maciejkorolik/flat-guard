import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ScoredListing } from "@/lib/types/flatguard";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const { data, error } = await supabase
    .from("shortlist_entries")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    listing_id: string;
    listing_snapshot: ScoredListing;
    notes?: string;
  };

  // Upsert — if already shortlisted just return existing entry
  const { data: existing } = await supabase
    .from("shortlist_entries")
    .select("id")
    .eq("project_id", projectId)
    .eq("listing_id", body.listing_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ entry: existing, alreadyExists: true });
  }

  const { data: entry, error } = await supabase
    .from("shortlist_entries")
    .insert({
      project_id: projectId,
      listing_id: body.listing_id,
      listing_snapshot: body.listing_snapshot,
      status: "saved",
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const { listing_id } = await req.json() as { listing_id: string };

  const { error } = await supabase
    .from("shortlist_entries")
    .delete()
    .eq("project_id", projectId)
    .eq("listing_id", listing_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
