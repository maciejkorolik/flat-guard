import { MapPin } from "lucide-react";
import { ShortlistCard } from "@/components/shortlist/shortlist-card";
import { ShortlistMapShell } from "@/components/shortlist/shortlist-map-shell";
import { createClient } from "@/lib/supabase/server";
import type { DbShortlistEntry, NormalizedListing, ScoredListing } from "@/lib/types/flatguard";

interface ShortlistPageProps {
  params: Promise<{ id: string }>;
}

interface ListingLocationRow {
  id: string;
  lat: number | string | null;
  lng: number | string | null;
  geocode_lat: number | string | null;
  geocode_lng: number | string | null;
  title: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
}

function isScoredListing(snapshot: DbShortlistEntry["listing_snapshot"]): snapshot is ScoredListing {
  return "overallScore" in snapshot;
}

function toNullableNumber(value: number | string | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAddress(listing: Pick<NormalizedListing, "address" | "district" | "city">): string {
  const fallback = [listing.district, listing.city].filter(Boolean).join(", ") || "Location unavailable";
  return listing.address ?? fallback;
}

export default async function ShortlistPage({ params }: ShortlistPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawEntries = [] } = await supabase
    .from("shortlist_entries")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const entries = rawEntries as DbShortlistEntry[];
  const listingIds = entries.map((entry) => entry.listing_id);

  let locations: ListingLocationRow[] = [];
  if (listingIds.length > 0) {
    const { data } = await supabase
      .from("listings_normalized")
      .select("id, lat, lng, geocode_lat, geocode_lng, title, address, district, city")
      .in("id", listingIds);

    locations = (data ?? []) as ListingLocationRow[];
  }

  const locationById = new Map(locations.map((location) => [location.id, location]));
  const mapItems = entries.flatMap((entry) => {
    const liveLocation = locationById.get(entry.listing_id);
    const snapshotListing = entry.listing_snapshot.listing;
    const lat = toNullableNumber(
      liveLocation?.lat ?? liveLocation?.geocode_lat ?? snapshotListing.lat ?? null
    );
    const lng = toNullableNumber(
      liveLocation?.lng ?? liveLocation?.geocode_lng ?? snapshotListing.lng ?? null
    );

    if (lat == null || lng == null) {
      return [];
    }

    const title = liveLocation?.title ?? snapshotListing.title ?? "Apartment";
    const address = formatAddress({
      address: liveLocation?.address ?? snapshotListing.address,
      district: liveLocation?.district ?? snapshotListing.district,
      city: liveLocation?.city ?? snapshotListing.city,
    });
    const scoredSnapshot = isScoredListing(entry.listing_snapshot) ? entry.listing_snapshot : null;
    const price = snapshotListing.total_monthly_pln ?? snapshotListing.rent_pln;

    return [{
      id: entry.id,
      listingId: entry.listing_id,
      title,
      address,
      lat,
      lng,
      status: entry.status,
      priceLabel: price != null ? `${price.toLocaleString("pl-PL")} PLN` : "Price unavailable",
      score: scoredSnapshot?.overallScore ?? null,
      url: snapshotListing.url,
    }];
  });

  const missingCoordinatesCount = entries.length - mapItems.length;

  return (
    <div className="px-10 py-10 flex flex-col gap-8 max-w-[1280px]">
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
        <>
          <section className="rounded-3xl overflow-hidden border border-[rgba(198,197,212,0.16)] bg-white shadow-sm">
            <div className="flex items-start justify-between gap-6 px-6 py-5 border-b border-[rgba(198,197,212,0.16)]">
              <div>
                <div className="flex items-center gap-2 text-[#000666] mb-1.5">
                  <MapPin size={15} />
                  <span className="text-xs font-bold uppercase tracking-[0.24em]">Shortlist Map</span>
                </div>
                <h3 className="font-manrope font-bold text-[#0d1c2e] text-xl">See every shortlisted home on the map</h3>
                <p className="text-[#454652] text-sm mt-1">
                  Markers are based on live coordinates from `listings_normalized`.
                </p>
              </div>

              <div className="flex gap-3 shrink-0">
                <StatPill label="Mapped" value={String(mapItems.length)} tone="primary" />
                {missingCoordinatesCount > 0 && (
                  <StatPill label="Missing coords" value={String(missingCoordinatesCount)} tone="muted" />
                )}
              </div>
            </div>

            {mapItems.length > 0 ? (
              <ShortlistMapShell items={mapItems} />
            ) : (
              <div className="px-6 py-14 text-center">
                <h4 className="font-manrope font-bold text-[#0d1c2e] text-lg">No map points available yet</h4>
                <p className="text-[#454652] text-sm mt-2 max-w-lg mx-auto leading-relaxed">
                  Your shortlisted listings do not currently have latitude and longitude in the database, so they cannot be placed on the map yet.
                </p>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {entries.map((entry) => (
              <ShortlistCard key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "muted";
}) {
  return (
    <div
      className={
        tone === "primary"
          ? "rounded-2xl bg-[#eff4ff] px-4 py-3 min-w-[96px]"
          : "rounded-2xl bg-[#f8fafc] px-4 py-3 min-w-[96px]"
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#767683]">{label}</p>
      <p className="font-manrope font-extrabold text-[#0d1c2e] text-xl mt-1">{value}</p>
    </div>
  );
}
