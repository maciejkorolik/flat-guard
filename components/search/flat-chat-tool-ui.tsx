"use client";

import type { ComponentType, ReactNode } from "react";
import {
  MapPin,
  Sun,
  Cloud,
  Wind,
  Trees,
  Dumbbell,
  ShoppingBasket,
  Search,
  ClipboardList,
  Activity,
  Image as ImageLucide,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NearbyPlaceRow, SearchFlatsResultRow } from "@/lib/flat-search-chat-tools";
import {
  displayAirQualityCategory,
  isAirQualityCategoryConcerning,
} from "@/lib/enrichment-display";

function Badge({
  children,
  variant = "secondary",
}: {
  children: ReactNode;
  variant?: "secondary" | "outline" | "destructive" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variant === "secondary" && "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
        variant === "outline" && "bg-white text-indigo-800 ring-1 ring-indigo-200",
        variant === "destructive" && "bg-red-50 text-red-800 ring-1 ring-red-200",
        variant === "ok" && "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      )}
    >
      {children}
    </span>
  );
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toLocaleString("pl-PL")} PLN`;
}

function fmtMin(sec: number | null | undefined) {
  if (sec == null) return null;
  return `${Math.round(sec / 60)} min walk`;
}

export function SearchFlatsToolUI({ output }: { output: { results?: SearchFlatsResultRow[]; count?: number; error?: string } }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-amber-200/80 bg-amber-50/50 shadow-sm">
        <CardContent className="p-3 text-xs text-amber-900">{output.error}</CardContent>
      </Card>
    );
  }
  const results = output.results ?? [];
  const shown = results.slice(0, 6);
  return (
    <Card className="max-w-[min(100%,36rem)] border-slate-200/90 shadow-md shadow-slate-900/[0.04] overflow-hidden">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-indigo-50/80 to-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-indigo-600" />
          <CardTitle className="text-sm font-manrope font-bold text-[#0d1c2e]">
            Filtered flats
            <span className="ml-2 font-normal text-slate-500">({output.count ?? results.length})</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0 max-h-64 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">No listings match these filters in your current results.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <li key={r.id} className="px-4 py-2.5 hover:bg-slate-50/80 transition-colors">
                <p className="text-xs font-semibold text-[#0d1c2e] line-clamp-1">{r.title ?? "Listing"}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                  <Badge variant="outline">{fmtMoney(r.totalMonthlyPln ?? r.rentPln)}</Badge>
                  {r.rooms != null && <Badge>{r.rooms} rooms</Badge>}
                  {r.areaM2 != null && <Badge>{r.areaM2} m²</Badge>}
                  {r.sunlightScore != null && (
                    <Badge variant="ok">
                      <Sun size={10} className="mr-0.5 inline" />
                      sun {r.sunlightScore}
                    </Badge>
                  )}
                  {r.airQualityAqiValue != null && <Badge>AQI {r.airQualityAqiValue}</Badge>}
                  {r.weatherNext12hRainHours != null && r.weatherNext12hRainHours > 0 && (
                    <Badge variant="destructive">rain {r.weatherNext12hRainHours}h</Badge>
                  )}
                </div>
                {(r.district || r.neighbourhood) && (
                  <p className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                    <MapPin size={10} /> {[r.neighbourhood, r.district].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {results.length > 6 && (
          <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
            +{results.length - 6} more in tool result (ask the assistant to narrow or list ids).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function FlatCardToolUI({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
}) {
  return (
    <Card className="max-w-[min(100%,36rem)] border-slate-200/90 shadow-sm">
      <CardHeader className="py-2.5 px-3 border-b border-slate-100 bg-slate-50/50">
        <CardTitle className="text-xs font-bold flex items-center gap-2 text-[#0d1c2e]">
          {Icon && <Icon size={14} className="text-indigo-600" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 text-xs text-slate-700 space-y-2">{children}</CardContent>
    </Card>
  );
}

export function FlatSearchCardDataUI({ output }: { output: Record<string, unknown> }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs text-red-800">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const p = output as Record<string, unknown>;
  const park = p.closestPark as NearbyPlaceRow | null | undefined;
  const gym = p.closestGym as NearbyPlaceRow | null | undefined;
  const grocery = p.closestGrocery as NearbyPlaceRow | null | undefined;

  return (
    <FlatCardToolUI title="Listing card" icon={ClipboardList}>
      <p className="font-semibold text-sm text-[#0d1c2e]">{String(p.title ?? "—")}</p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{fmtMoney(p.rentPln as number | null)} rent</Badge>
        {p.totalMonthlyPln != null && <Badge>{fmtMoney(p.totalMonthlyPln as number)} total</Badge>}
        {p.rooms != null && <Badge>{String(p.rooms)} rooms</Badge>}
        {p.areaM2 != null && <Badge>{String(p.areaM2)} m²</Badge>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.sunlightScore != null && (
          <Badge variant="ok">
            <Sun size={10} className="mr-0.5 inline" />
            Sun {String(p.sunlightScore)}
          </Badge>
        )}
        {p.airQualityCategory != null && String(p.airQualityCategory).length > 0 ? (
          <Badge>{displayAirQualityCategory(String(p.airQualityCategory))}</Badge>
        ) : null}
        {p.airQualityAqiValue != null && <Badge>AQI {String(p.airQualityAqiValue)}</Badge>}
        {p.weatherNext12hRainHours != null && Number(p.weatherNext12hRainHours) > 0 && (
          <Badge variant="destructive">Rain {String(p.weatherNext12hRainHours)}h / 12h</Badge>
        )}
      </div>
      {(String(p.district ?? "") || String(p.address ?? "")) ? (
        <p className="text-slate-600 flex items-start gap-1">
          <MapPin size={12} className="shrink-0 mt-0.5" />
          <span>{[p.address, p.district].filter(Boolean).map(String).join(" · ")}</span>
        </p>
      ) : null}
      {(park || gym || grocery) && (
        <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nearby</p>
          {park?.placeName && (
            <p className="flex items-center gap-1">
              <Trees size={12} className="text-emerald-600" /> {park.placeName}
              {fmtMin(park.walkingDurationSeconds) && (
                <span className="text-slate-400">· {fmtMin(park.walkingDurationSeconds)}</span>
              )}
            </p>
          )}
          {gym?.placeName && (
            <p className="flex items-center gap-1">
              <Dumbbell size={12} className="text-indigo-600" /> {gym.placeName}
              {fmtMin(gym.walkingDurationSeconds) && (
                <span className="text-slate-400">· {fmtMin(gym.walkingDurationSeconds)}</span>
              )}
            </p>
          )}
          {grocery?.placeName && (
            <p className="flex items-center gap-1">
              <ShoppingBasket size={12} className="text-amber-700" /> {grocery.placeName}
              {fmtMin(grocery.walkingDurationSeconds) && (
                <span className="text-slate-400">· {fmtMin(grocery.walkingDurationSeconds)}</span>
              )}
            </p>
          )}
        </div>
      )}
      {Array.isArray(p.pictureUrls) && p.pictureUrls.length > 0 && (
        <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <ImageLucide size={12} className="text-slate-500" />
            Photos (normalized)
          </p>
          <p className="text-slate-600">{p.pictureUrls.length} image URL(s) stored for this listing.</p>
        </div>
      )}
      {p.pictureInspectionNotes != null && String(p.pictureInspectionNotes).trim().length > 0 && (
        <div className="rounded-lg bg-indigo-50/60 ring-1 ring-indigo-100/80 p-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Photo notes (AI)</p>
          <p className="text-slate-600 whitespace-pre-wrap line-clamp-4">
            {String(p.pictureInspectionNotes).slice(0, 400)}
            {String(p.pictureInspectionNotes).length > 400 ? "…" : ""}
          </p>
        </div>
      )}
    </FlatCardToolUI>
  );
}

export function GeoDataToolUI({ output }: { output: Record<string, unknown> }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const lat = output.geocodeLat as number | null;
  const lng = output.geocodeLng as number | null;
  return (
    <FlatCardToolUI title="Location & geocode" icon={MapPin}>
      <div className="flex flex-wrap gap-1.5">
        {output.geocodeStatus != null && String(output.geocodeStatus).length > 0 ? (
          <Badge>{String(output.geocodeStatus)}</Badge>
        ) : null}
        {output.geocodePartialMatch === true && <Badge variant="destructive">Partial match</Badge>}
        {output.geocodeLocationType != null && String(output.geocodeLocationType).length > 0 ? (
          <Badge variant="secondary">{String(output.geocodeLocationType)}</Badge>
        ) : null}
      </div>
      {output.geocodeFormattedAddress != null && String(output.geocodeFormattedAddress).length > 0 ? (
        <p className="text-slate-600">{String(output.geocodeFormattedAddress)}</p>
      ) : null}
      {lat != null && lng != null && (
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-700 font-semibold underline text-[11px]"
        >
          Open map ({lat.toFixed(4)}, {lng.toFixed(4)})
        </a>
      )}
    </FlatCardToolUI>
  );
}

export function SunDataToolUI({ output }: { output: Record<string, unknown> }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const reasons = (output.sunlightReasons as string[]) ?? [];
  return (
    <FlatCardToolUI title="Sunlight" icon={Sun}>
      <div className="flex flex-wrap gap-1.5">
        {output.sunlightStatus != null && String(output.sunlightStatus).length > 0 ? (
          <Badge>{String(output.sunlightStatus)}</Badge>
        ) : null}
        {output.sunlightScore != null && <Badge variant="ok">Score {String(output.sunlightScore)}</Badge>}
        {output.sunlightConfidence != null && String(output.sunlightConfidence).length > 0 ? (
          <Badge variant="outline">{String(output.sunlightConfidence)}</Badge>
        ) : null}
      </div>
      {output.sunlightEstimatedOrientationHint != null &&
      String(output.sunlightEstimatedOrientationHint).length > 0 ? (
        <p className="text-slate-600">{String(output.sunlightEstimatedOrientationHint)}</p>
      ) : null}
      {reasons.length > 0 && (
        <details className="rounded-lg bg-amber-50/50 ring-1 ring-amber-100 px-2 py-1.5">
          <summary className="text-[11px] font-semibold cursor-pointer text-amber-900">Why this score</summary>
          <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-950/90 space-y-0.5">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      )}
    </FlatCardToolUI>
  );
}

export function WeatherToolUI({ output }: { output: Record<string, unknown> }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const rainH = output.weatherNext12hRainHours as number | null | undefined;
  const risky = rainH != null && rainH >= 3;
  if (risky) {
    return (
      <div className="max-w-[min(100%,36rem)] rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 shadow-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Cloud size={16} className="text-amber-700" />
          Weather — elevated rain risk
        </div>
        <p className="mt-1 opacity-90">
          ~{String(rainH)} rainy hours in next 12h
          {output.weatherConditionText ? ` · ${String(output.weatherConditionText)}` : ""}
        </p>
        {output.weatherTemperatureC != null && (
          <p className="mt-0.5 text-[11px]">~{String(output.weatherTemperatureC)}°C</p>
        )}
      </div>
    );
  }
  return (
    <FlatCardToolUI title="Weather" icon={Cloud}>
      <div className="flex flex-wrap gap-1.5">
        {output.weatherStatus != null && String(output.weatherStatus).length > 0 ? (
          <Badge>{String(output.weatherStatus)}</Badge>
        ) : null}
        {rainH != null && <Badge variant="outline">{rainH}h rain (12h)</Badge>}
        {output.weatherTemperatureC != null && <Badge>{String(output.weatherTemperatureC)}°C</Badge>}
      </div>
      {output.weatherConditionText != null && String(output.weatherConditionText).length > 0 ? (
        <p>{String(output.weatherConditionText)}</p>
      ) : null}
    </FlatCardToolUI>
  );
}

export function AirQualityToolUI({ output }: { output: Record<string, unknown> }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const aqi = output.airQualityAqiValue as number | null | undefined;
  const bad = isAirQualityCategoryConcerning(String(output.airQualityAqiCategory ?? ""));
  return (
    <FlatCardToolUI title="Air quality" icon={Wind}>
      <div className="flex flex-wrap gap-1.5 items-center">
        {output.airQualityStatus != null && String(output.airQualityStatus).length > 0 ? (
          <Badge>{String(output.airQualityStatus)}</Badge>
        ) : null}
        {output.airQualityAqiCategory != null && String(output.airQualityAqiCategory).length > 0 ? (
          <Badge variant={bad ? "destructive" : "ok"}>
            {displayAirQualityCategory(String(output.airQualityAqiCategory))}
          </Badge>
        ) : null}
        {aqi != null && <Badge variant="outline">AQI {aqi}</Badge>}
      </div>
      {output.airQualityDominantPollutant != null &&
      String(output.airQualityDominantPollutant).length > 0 ? (
        <p className="text-slate-600">Main: {String(output.airQualityDominantPollutant)}</p>
      ) : null}
    </FlatCardToolUI>
  );
}

export function PlacesNearbyToolUI({ output }: { output: { places?: NearbyPlaceRow[]; error?: string } }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const places = output.places ?? [];
  const byCat = (cat: string) => places.filter((p) => p.categoryKey.toLowerCase() === cat);
  const tabs = ["park", "gym", "grocery"] as const;
  const icons = { park: Trees, gym: Dumbbell, grocery: ShoppingBasket };

  return (
    <Card className="max-w-[min(100%,36rem)] border-slate-200/90 shadow-sm overflow-hidden">
      <CardHeader className="py-2 px-3 border-b border-slate-100">
        <CardTitle className="text-xs font-bold flex items-center gap-2">
          <Activity size={14} className="text-indigo-600" />
          Nearby (enriched)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide">
          {tabs.map((key) => {
            const Icon = icons[key];
            const list = byCat(key);
            return (
              <div
                key={key}
                className="flex-1 px-2 py-2 text-center border-r border-slate-100 last:border-r-0 bg-slate-50/80"
              >
                <Icon size={12} className="inline mr-1 opacity-70" />
                {key}
                <span className="block text-slate-400 font-normal normal-case">{list.length ? `${list.length}` : "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-0 divide-x divide-slate-100 text-[11px] p-2 bg-white">
          {tabs.map((key) => {
            const list = byCat(key);
            const top = list[0];
            return (
              <div key={key} className="px-1.5 min-h-[4rem]">
                {top ? (
                  <>
                    <p className="font-semibold text-[#0d1c2e] line-clamp-2">{top.placeName ?? "—"}</p>
                    {fmtMin(top.walkingDurationSeconds) && (
                      <p className="text-slate-500 mt-0.5">{fmtMin(top.walkingDurationSeconds)}</p>
                    )}
                    {top.walkingDistanceMeters != null && (
                      <p className="text-slate-400">{top.walkingDistanceMeters} m</p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-400">No data</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ExplainabilityToolUI({ output }: { output: Record<string, unknown> }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const prox = (output.proximitySummary as { category: string; name: string | null; walkMin: number | null }[]) ?? [];
  return (
    <FlatCardToolUI title="Why this flat" icon={Search}>
      <ul className="space-y-1.5 text-[11px]">
        <li>
          <span className="font-semibold text-slate-600">Geocode:</span>{" "}
          {String((output.geocode as Record<string, unknown>)?.status ?? "—")}
          {(output.geocode as Record<string, unknown>)?.partialMatch === true ? " · partial match" : ""}
        </li>
        <li>
          <span className="font-semibold text-slate-600">Sunlight:</span>{" "}
          {String((output.sunlight as Record<string, unknown>)?.score ?? "—")} (
          {String((output.sunlight as Record<string, unknown>)?.confidence ?? "—")})
        </li>
        <li>
          <span className="font-semibold text-slate-600">Air:</span> AQI{" "}
          {String((output.airQuality as Record<string, unknown>)?.aqi ?? "—")} —{" "}
          {displayAirQualityCategory(
            String((output.airQuality as Record<string, unknown>)?.category ?? "—")
          ) ?? "—"}
        </li>
        <li>
          <span className="font-semibold text-slate-600">Rain (12h):</span>{" "}
          {String((output.rain as Record<string, unknown>)?.next12hRainHours ?? "—")} h
        </li>
      </ul>
      {prox.length > 0 && (
        <div className="pt-1 border-t border-slate-100">
          <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Walk times</p>
          <div className="flex flex-wrap gap-1">
            {prox.map((p, i) => (
              <Badge key={i} variant="secondary">
                {p.category}: {p.walkMin != null ? `${p.walkMin}m` : "—"}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </FlatCardToolUI>
  );
}

export function EnrichmentCoverageToolUI({ output }: { output: { signals?: { name: string; status: string | null; fetchedAt: string | null }[]; error?: string } }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const signals = output.signals ?? [];
  return (
    <FlatCardToolUI title="Enrichment coverage" icon={Activity}>
      <div className="grid grid-cols-1 gap-1.5">
        {signals.map((sig) => (
          <div key={sig.name} className="flex justify-between gap-2 text-[11px] border-b border-slate-50 pb-1 last:border-0">
            <span className="font-medium capitalize text-slate-600">{sig.name.replace(/_/g, " ")}</span>
            <span className="text-right">
              <Badge variant={sig.status ? "outline" : "secondary"}>{sig.status ?? "missing"}</Badge>
              {sig.fetchedAt && <span className="block text-[10px] text-slate-400 mt-0.5">{sig.fetchedAt}</span>}
            </span>
          </div>
        ))}
      </div>
    </FlatCardToolUI>
  );
}

export function ListingDetailsToolUI({ output }: { output: Record<string, unknown> }) {
  if (output.error) {
    return (
      <Card className="max-w-[min(100%,36rem)] border-red-200 bg-red-50/50">
        <CardContent className="p-3 text-xs">{String(output.error)}</CardContent>
      </Card>
    );
  }
  const norm = output.normalized as Record<string, unknown> | undefined;
  const title = norm?.title ?? "Listing";
  return (
    <FlatCardToolUI title="Full listing details" icon={ClipboardList}>
      <p className="font-semibold text-sm">{String(title)}</p>
      <p className="text-slate-500 text-[11px]">
        Loaded normalized row + AI score + source scrape payload for the assistant.
      </p>
      {norm?.description != null && String(norm.description).length > 0 ? (
        <p className="text-[11px] text-slate-600 line-clamp-4 whitespace-pre-wrap">{String(norm.description)}</p>
      ) : null}
    </FlatCardToolUI>
  );
}

export function GetListingsToolUI({ output }: { output: unknown }) {
  const n = Array.isArray(output) ? output.length : 0;
  return (
    <Card className="max-w-[min(100%,36rem)] border-slate-200/90 shadow-sm">
      <CardContent className="p-3 flex items-center gap-2 text-xs text-slate-700">
        <ClipboardList size={14} className="text-indigo-600" />
        <span className="font-semibold">Loaded {n} scored listing{n === 1 ? "" : "s"}</span>
      </CardContent>
    </Card>
  );
}
