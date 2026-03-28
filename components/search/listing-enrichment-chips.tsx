"use client";

import type { ReactNode } from "react";
import { Sun, CloudRain, Wind, MapPinned, Trees, Dumbbell, ShoppingBasket } from "lucide-react";
import { parseProximityMatches } from "@/lib/flat-search-chat-tools";
import { displayAirQualityCategory } from "@/lib/enrichment-display";
import type { NormalizedListing } from "@/lib/types/flatguard";
import { cn } from "@/lib/utils";

function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none",
        className
      )}
    >
      {children}
    </span>
  );
}

function walkLabel(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

/** True when {@link ListingEnrichmentChips} would render at least one chip (for layout dividers elsewhere). */
export function listingHasEnrichmentChips(listing: NormalizedListing): boolean {
  const sun = listing.sunlight_score != null;
  const aqi = listing.air_quality_aqi_value != null;
  const rain =
    listing.weather_next12h_rain_hours != null && listing.weather_next12h_rain_hours > 0;
  const geoOk =
    listing.geocode_status != null && String(listing.geocode_status).toLowerCase() === "succeeded";
  const geoOther = listing.geocode_status != null && String(listing.geocode_status).length > 0 && !geoOk;
  const places = parseProximityMatches(listing.proximity_matches);
  if (sun || aqi || rain || geoOk || geoOther || places.length > 0) return true;
  if (listing.weather_temperature_c != null && !rain) return true;
  if (listing.geocode_partial_match === true) return true;
  return false;
}

export function ListingEnrichmentChips({
  listing,
  withTopBorder = true,
}: {
  listing: NormalizedListing;
  /** When false, omit the dashed top border (e.g. inside modal sub-section). */
  withTopBorder?: boolean;
}) {
  const sun = listing.sunlight_score != null;
  const aqi = listing.air_quality_aqi_value != null;
  const rain =
    listing.weather_next12h_rain_hours != null && listing.weather_next12h_rain_hours > 0;
  const geoOk =
    listing.geocode_status != null && String(listing.geocode_status).toLowerCase() === "succeeded";
  const geoOther = listing.geocode_status != null && String(listing.geocode_status).length > 0 && !geoOk;
  const places = parseProximityMatches(listing.proximity_matches);
  const park = places.find((p) => p.categoryKey.toLowerCase() === "park");
  const gym = places.find((p) => p.categoryKey.toLowerCase() === "gym");
  const grocery = places.find((p) => p.categoryKey.toLowerCase() === "grocery");

  if (!listingHasEnrichmentChips(listing)) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 items-center",
        withTopBorder && "pt-2.5 mt-1 border-t border-dashed border-[rgba(198,197,212,0.25)]"
      )}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest text-[#767683] w-full mb-0.5">
        Environment & location
      </span>
      {sun && (
        <Chip className="bg-amber-50 text-amber-900 ring-1 ring-amber-200/80">
          <Sun size={11} className="shrink-0" />
          Sun {listing.sunlight_score}
          {listing.sunlight_confidence && (
            <span className="font-normal opacity-80">· {listing.sunlight_confidence}</span>
          )}
        </Chip>
      )}
      {aqi && (
        <Chip className="bg-sky-50 text-sky-900 ring-1 ring-sky-200/80">
          <Wind size={11} className="shrink-0" />
          AQI {listing.air_quality_aqi_value}
          {listing.air_quality_aqi_category && (
            <span className="font-normal opacity-80">
              · {displayAirQualityCategory(listing.air_quality_aqi_category)}
            </span>
          )}
        </Chip>
      )}
      {rain && (
        <Chip className="bg-blue-50 text-blue-900 ring-1 ring-blue-200/80">
          <CloudRain size={11} className="shrink-0" />
          Rain ~{listing.weather_next12h_rain_hours}h / 12h
        </Chip>
      )}
      {listing.weather_temperature_c != null && !rain && (
        <Chip className="bg-slate-50 text-slate-700 ring-1 ring-slate-200/80">
          ~{listing.weather_temperature_c}°C
        </Chip>
      )}
      {geoOk && (
        <Chip className="bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80">
          <MapPinned size={11} className="shrink-0" />
          Geocoded
        </Chip>
      )}
      {geoOther && (
        <Chip className="bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
          <MapPinned size={11} className="shrink-0" />
          {String(listing.geocode_status)}
        </Chip>
      )}
      {listing.geocode_partial_match === true && (
        <Chip className="bg-amber-50 text-amber-800 ring-1 ring-amber-200/60">Partial address match</Chip>
      )}
      {park?.placeName && (
        <Chip className="bg-green-50 text-green-900 ring-1 ring-green-200/70 max-w-full">
          <Trees size={11} className="shrink-0" />
          <span className="truncate max-w-[7rem]">{park.placeName}</span>
          {walkLabel(park.walkingDurationSeconds) ? (
            <span className="shrink-0 opacity-80">· {walkLabel(park.walkingDurationSeconds)}</span>
          ) : null}
        </Chip>
      )}
      {gym?.placeName && (
        <Chip className="bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200/70 max-w-full">
          <Dumbbell size={11} className="shrink-0" />
          <span className="truncate max-w-[7rem]">{gym.placeName}</span>
          {walkLabel(gym.walkingDurationSeconds) ? (
            <span className="shrink-0 opacity-80">· {walkLabel(gym.walkingDurationSeconds)}</span>
          ) : null}
        </Chip>
      )}
      {grocery?.placeName && (
        <Chip className="bg-orange-50 text-orange-900 ring-1 ring-orange-200/70 max-w-full">
          <ShoppingBasket size={11} className="shrink-0" />
          <span className="truncate max-w-[7rem]">{grocery.placeName}</span>
          {walkLabel(grocery.walkingDurationSeconds) ? (
            <span className="shrink-0 opacity-80">· {walkLabel(grocery.walkingDurationSeconds)}</span>
          ) : null}
        </Chip>
      )}
    </div>
  );
}
