import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NormalizedListing } from "@/lib/types/flatguard";

const CITY_NAME_MAP: Record<string, string> = {
  warsaw: "Warszawa",
  krakow: "Kraków",
  cracow: "Kraków",
  wroclaw: "Wrocław",
  gdansk: "Gdańsk",
  poznan: "Poznań",
  lodz: "Łódź",
};

function normalizeCity(input: string): string {
  return CITY_NAME_MAP[input.toLowerCase()] ?? input;
}

function firstLine(value: string | null): string | null {
  if (!value) return null;
  return value.split("\n")[0].trim() || null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("search_profiles")
    .select("preferred_cities, budget_target_pln")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();

  const rawCity = (profile?.preferred_cities as string[] | null)?.[0];
  const budget = profile?.budget_target_pln as number | null;
  const dbCity = rawCity ? normalizeCity(rawCity) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("listings_normalized")
    .select("*")
    .eq("is_active", true)
    .lt("rent_pln", 20000)
    .limit(20);

  if (dbCity) query = query.ilike("city", `%${dbCity}%`);
  if (budget) query = query.lte("total_monthly_pln", Math.round(budget * 1.3));

  const { data: rawListings, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const listings: NormalizedListing[] = (rawListings ?? []).map((l: NormalizedListing) => ({
    ...l,
    district: firstLine(l.district),
    address: firstLine(l.address),
    area_m2: l.area_m2 != null ? parseFloat(String(l.area_m2)) || null : null,
  }));

  return NextResponse.json({ listings });
}
