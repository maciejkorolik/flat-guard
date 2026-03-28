import { summarizeSunlightEstimate } from "./sunlight.mjs";

export const ENRICHMENT_QUERY_COMPONENTS = ["street", "district", "city"];
export const DISTRICT_FALLBACK_QUERY_COMPONENTS = ["district", "city"];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    return (
      getNumber(value.value) ??
      getNumber(value.degrees) ??
      getNumber(value.meters) ??
      getNumber(value.kilometers) ??
      getNumber(value.celsius) ??
      null
    );
  }

  return null;
}

function getText(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    return (
      value.text ??
      value.localizedText ??
      value.displayName?.text ??
      value.description?.text ??
      null
    );
  }

  return null;
}

function normalizeListingSource(value) {
  return value === "olx.pl" ? "olx" : value;
}

export function normalizeCrawlerRecord(record) {
  return {
    rawListingId: null,
    normalizedListingId: null,
    ingestRunId: record.crawl_run_id || null,
    source: normalizeListingSource(record.source || "olx"),
    sourceListingId: record.listing_id || null,
    sourceUrl: record.listing_url || null,
    searchCity: record.city_query || null,
    listingTitle: record.title_raw || null,
    descriptionRaw: record.description_raw || null,
    district: record.district_breadcrumb_raw || record.district_hint_raw || null,
    districtBreadcrumbRaw: record.district_breadcrumb_raw || null,
    districtHintRaw: record.district_hint_raw || null,
    streetHintRaw: record.street_hint_raw || null,
    exactLocationAvailableRaw:
      typeof record.exact_location_available_raw === "boolean"
        ? record.exact_location_available_raw
        : null,
    rawDetailPayload: record.raw_detail_json || null,
  };
}

export function normalizeDbRecord(record) {
  return {
    rawListingId: record.id ?? null,
    normalizedListingId: null,
    ingestRunId: record.ingest_run_id ?? null,
    source: normalizeListingSource(record.source || "olx"),
    sourceListingId: record.source_listing_id ?? null,
    sourceUrl: record.source_url ?? null,
    searchCity: record.search_city ?? null,
    listingTitle: record.listing_title ?? null,
    descriptionRaw: record.description_raw ?? null,
    district: record.district_breadcrumb_raw || record.district || record.district_hint_raw || null,
    districtBreadcrumbRaw: record.district_breadcrumb_raw ?? null,
    districtHintRaw: record.district_hint_raw ?? null,
    streetHintRaw: record.street_hint_raw ?? null,
    exactLocationAvailableRaw:
      typeof record.exact_location_available_raw === "boolean"
        ? record.exact_location_available_raw
        : null,
    rawDetailPayload: record.raw_detail_payload ?? null,
  };
}

export function normalizeNormalizedRecord(record) {
  return {
    rawListingId: record.raw_listing_id ?? null,
    normalizedListingId: record.id ?? null,
    ingestRunId: null,
    source: normalizeListingSource(record.source || "olx"),
    sourceListingId: record.external_id ?? null,
    sourceUrl: record.url ?? null,
    searchCity: record.city ?? null,
    listingTitle: record.title ?? null,
    descriptionRaw: record.description ?? null,
    district:
      record.district ?? record.neighbourhood ?? null,
    districtBreadcrumbRaw: record.district ?? null,
    districtHintRaw: record.neighbourhood ?? null,
    streetHintRaw: record.address ?? null,
    geocodeLat: getNumber(record.geocode_lat),
    geocodeLng: getNumber(record.geocode_lng),
    exactLocationAvailableRaw:
      typeof record.exact_location_available === "boolean"
        ? record.exact_location_available
        : null,
    rawDetailPayload: record.source_detail_payload ?? null,
  };
}

export function describeGeocodeQueryRequirements(listing) {
  const street = listing.streetHintRaw?.trim() || null;
  const district =
    listing.districtBreadcrumbRaw?.trim() ||
    listing.districtHintRaw?.trim() ||
    listing.district?.trim() ||
    null;
  const city = listing.searchCity?.trim() || null;

  const components = {
    street,
    district,
    city,
  };
  const missingComponents = ENRICHMENT_QUERY_COMPONENTS.filter(
    (componentName) => !components[componentName],
  );

  return {
    components,
    missingComponents,
    isReady: missingComponents.length === 0,
  };
}

export function describeDistrictFallbackRequirements(listing) {
  const district =
    listing.districtBreadcrumbRaw?.trim() ||
    listing.districtHintRaw?.trim() ||
    listing.district?.trim() ||
    null;
  const city = listing.searchCity?.trim() || null;

  const components = {
    district,
    city,
  };
  const missingComponents = DISTRICT_FALLBACK_QUERY_COMPONENTS.filter(
    (componentName) => !components[componentName],
  );

  return {
    components,
    missingComponents,
    isReady: missingComponents.length === 0,
  };
}

export function buildGeocodeInput(listing) {
  const { components, isReady } = describeGeocodeQueryRequirements(listing);
  const { street, district, city } = components;

  if (!isReady) {
    return {
      status: "insufficient_input",
      query: null,
      components,
    };
  }

  return {
    status: "ready",
    query: `${street}, ${district}, ${city}, Poland`,
    components: {
      street,
      district,
      city,
    },
  };
}

export function buildDistrictFallbackGeocodeInput(listing) {
  const { components, isReady } = describeDistrictFallbackRequirements(listing);
  const { district, city } = components;

  if (!isReady) {
    return {
      status: "insufficient_input",
      query: null,
      components,
    };
  }

  return {
    status: "ready",
    query: `${district}, ${city}, Poland`,
    components,
  };
}

export function parseGeocodeResponse(geocodeInput, responseBody) {
  if (!geocodeInput || geocodeInput.status !== "ready") {
    return {
      status: "insufficient_input",
      query: geocodeInput?.query ?? null,
      input: geocodeInput?.components ?? {},
      partialMatch: false,
      formattedAddress: null,
      placeId: null,
      locationType: null,
      resultTypes: [],
      latitude: null,
      longitude: null,
      payload: {},
    };
  }

  const providerStatus = String(responseBody?.status || "").toUpperCase();
  if (
    providerStatus &&
    providerStatus !== "OK" &&
    providerStatus !== "ZERO_RESULTS"
  ) {
    return {
      status: "failed",
      query: geocodeInput.query,
      input: geocodeInput.components,
      partialMatch: false,
      formattedAddress: null,
      placeId: null,
      locationType: null,
      resultTypes: [],
      latitude: null,
      longitude: null,
      payload: responseBody || {},
    };
  }

  const result = Array.isArray(responseBody?.results) ? responseBody.results[0] : null;
  if (!result) {
    return {
      status: "zero_results",
      query: geocodeInput.query,
      input: geocodeInput.components,
      partialMatch: false,
      formattedAddress: null,
      placeId: null,
      locationType: null,
      resultTypes: [],
      latitude: null,
      longitude: null,
      payload: responseBody || {},
    };
  }

  return {
    status: "succeeded",
    provider: "google_maps",
    query: geocodeInput.query,
    input: geocodeInput.components,
    partialMatch: Boolean(result.partial_match),
    formattedAddress: result.formatted_address || null,
    placeId: result.place_id || null,
    locationType: result.geometry?.location_type || null,
    resultTypes: Array.isArray(result.types) ? result.types : [],
    latitude: getNumber(result.geometry?.location?.lat),
    longitude: getNumber(result.geometry?.location?.lng),
    payload: result,
  };
}

function createDeterministicUnitInterval(seed) {
  let hash = 2166136261;
  const input = String(seed || "fallback");

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function offsetCoordinate({ latitude, longitude, distanceMeters, bearingRadians }) {
  const earthRadiusMeters = 6_371_000;
  const angularDistance = distanceMeters / earthRadiusMeters;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;

  const shiftedLatitude = Math.asin(
    Math.sin(latitudeRadians) * Math.cos(angularDistance) +
      Math.cos(latitudeRadians) *
        Math.sin(angularDistance) *
        Math.cos(bearingRadians),
  );

  const shiftedLongitude =
    longitudeRadians +
    Math.atan2(
      Math.sin(bearingRadians) *
        Math.sin(angularDistance) *
        Math.cos(latitudeRadians),
      Math.cos(angularDistance) -
        Math.sin(latitudeRadians) * Math.sin(shiftedLatitude),
    );

  return {
    latitude: (shiftedLatitude * 180) / Math.PI,
    longitude: (shiftedLongitude * 180) / Math.PI,
  };
}

export function applyDistrictFallbackScatter(
  geocodeResult,
  listing,
  { minRadiusMeters = 120, maxRadiusMeters = 420 } = {},
) {
  if (
    geocodeResult?.status !== "succeeded" ||
    !Number.isFinite(geocodeResult.latitude) ||
    !Number.isFinite(geocodeResult.longitude)
  ) {
    return geocodeResult;
  }

  const seedBase =
    listing.normalizedListingId ||
    listing.sourceListingId ||
    listing.rawListingId ||
    `${listing.source}:${listing.listingTitle || "unknown"}`;
  const angleSeed = createDeterministicUnitInterval(`${seedBase}:angle`);
  const radiusSeed = createDeterministicUnitInterval(`${seedBase}:radius`);
  const distanceMeters =
    minRadiusMeters + (maxRadiusMeters - minRadiusMeters) * radiusSeed;
  const bearingRadians = angleSeed * Math.PI * 2;
  const shiftedPoint = offsetCoordinate({
    latitude: geocodeResult.latitude,
    longitude: geocodeResult.longitude,
    distanceMeters,
    bearingRadians,
  });

  return {
    ...geocodeResult,
    provider: "google_maps_district_fallback",
    partialMatch: true,
    latitude: shiftedPoint.latitude,
    longitude: shiftedPoint.longitude,
    payload: {
      ...(geocodeResult.payload || {}),
      fallback_strategy: "district_centroid_scatter",
      fallback_seed: seedBase,
      fallback_radius_meters: Math.round(distanceMeters),
      fallback_bearing_degrees: Math.round((bearingRadians * 180) / Math.PI),
      fallback_origin_latitude: geocodeResult.latitude,
      fallback_origin_longitude: geocodeResult.longitude,
    },
  };
}

function isRainCondition(conditionType) {
  return /RAIN|SHOWERS|THUNDER/i.test(String(conditionType || ""));
}

export function summarizeWeatherSnapshot({ currentWeather, hourlyForecast }) {
  const current = currentWeather?.currentConditions || currentWeather || {};
  const forecastHours = Array.isArray(hourlyForecast?.forecastHours)
    ? hourlyForecast.forecastHours
    : Array.isArray(hourlyForecast?.hours)
      ? hourlyForecast.hours
      : [];

  const rainyHours = forecastHours.filter((hour) => {
    const precipitationProbability =
      getNumber(hour?.precipitation?.probability?.percent) ??
      getNumber(hour?.precipitationProbability?.percent);
    return (
      isRainCondition(hour?.weatherCondition?.type) ||
      (Number.isFinite(precipitationProbability) && precipitationProbability >= 40)
    );
  });

  const maxPrecipProbability = forecastHours.reduce((maxValue, hour) => {
    const probability =
      getNumber(hour?.precipitation?.probability?.percent) ??
      getNumber(hour?.precipitationProbability?.percent);
    if (!Number.isFinite(probability)) return maxValue;
    return Math.max(maxValue, probability);
  }, 0);

  return {
    summaryTime: current?.currentTime || currentWeather?.currentTime || null,
    conditionType: current?.weatherCondition?.type || null,
    conditionText: getText(current?.weatherCondition?.description) || null,
    temperatureC:
      getNumber(current?.temperature?.degrees) ??
      getNumber(current?.temperature) ??
      null,
    precipitationProbabilityPercent:
      getNumber(current?.precipitation?.probability?.percent) ?? null,
    next12hRainHourCount: rainyHours.length,
    next12hMaxPrecipProbabilityPercent: Number.isFinite(maxPrecipProbability)
      ? maxPrecipProbability
      : null,
  };
}

export function summarizeAirQualitySnapshot(currentAirQuality) {
  const indexes = Array.isArray(currentAirQuality?.indexes)
    ? currentAirQuality.indexes
    : [];
  const preferredIndex =
    indexes.find((index) => slugify(index?.code) === "uaqi") ||
    indexes.find((index) => slugify(index?.code).includes("aqi")) ||
    indexes[0] ||
    null;

  return {
    summaryTime: currentAirQuality?.dateTime || null,
    aqiIndexCode: preferredIndex?.code || null,
    aqiDisplayName: getText(preferredIndex?.displayName) || null,
    aqiValue: getNumber(preferredIndex?.aqi) ?? null,
    aqiCategory:
      getText(preferredIndex?.category) ||
      preferredIndex?.category?.displayName ||
      null,
    dominantPollutant:
      getText(currentAirQuality?.dominantPollutant?.displayName) ||
      currentAirQuality?.dominantPollutant?.code ||
      null,
  };
}

export function haversineDistanceMeters(origin, destination) {
  if (
    !Number.isFinite(origin?.latitude) ||
    !Number.isFinite(origin?.longitude) ||
    !Number.isFinite(destination?.latitude) ||
    !Number.isFinite(destination?.longitude)
  ) {
    return null;
  }

  const earthRadiusMeters = 6_371_000;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lat2 = (destination.latitude * Math.PI) / 180;
  const deltaLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const deltaLng = ((destination.longitude - origin.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
}

function parseDurationSeconds(duration) {
  const match = String(duration || "").match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) return null;
  return Math.round(Number(match[1]));
}

function normalizePlace(place) {
  return {
    id: place?.id || null,
    resourceName: place?.name || null,
    name: getText(place?.displayName) || null,
    formattedAddress: place?.formattedAddress || null,
    primaryType: place?.primaryType || null,
    types: Array.isArray(place?.types) ? place.types : [],
    latitude: getNumber(place?.location?.latitude),
    longitude: getNumber(place?.location?.longitude),
    payload: place || {},
  };
}

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function filterPlacesByAllowedBrandNames(places, allowedBrandNames) {
  if (!Array.isArray(allowedBrandNames) || !allowedBrandNames.length) {
    return places;
  }

  const normalizedBrandNames = allowedBrandNames.map((brandName) =>
    normalizeToken(brandName),
  );

  return places.filter((place) => {
    const haystack = normalizeToken(
      `${getText(place?.displayName)} ${place?.formattedAddress || ""}`,
    );
    return normalizedBrandNames.some((brandName) => haystack.includes(brandName));
  });
}

function matchRoutesToDestinations(routeMatrixResponse, destinations) {
  const rows = Array.isArray(routeMatrixResponse) ? routeMatrixResponse : [];
  return destinations.map((destination, index) => {
    const row = rows.find((item) => item?.destinationIndex === index) || null;
    return {
      destination,
      route: row,
      distanceMeters: row?.distanceMeters ?? null,
      durationSeconds: parseDurationSeconds(row?.duration),
      condition: row?.condition || null,
    };
  });
}

export function selectBestPlaceMatch({
  geocodeResult,
  category,
  placesResponse,
  routeMatrixResponse,
  routeError = null,
}) {
  const places = Array.isArray(placesResponse?.places)
    ? placesResponse.places.map(normalizePlace)
    : [];

  if (!places.length) {
    const placeErrorPayload = placesResponse?.api
      ? {
          api: placesResponse.api,
          status: placesResponse.status || null,
          error_message:
            placesResponse.error_message || placesResponse.error || null,
          error: placesResponse.error || null,
        }
      : {};

    return {
      categoryKey: category.key,
      categoryLabel: category.label,
      categorySource: category.source,
      searchMethod: category.searchMethod || "nearby_search",
      searchConfidence: category.confidence,
      requestedQuery: (category.includedTypes || []).join(","),
      requestedQueryPayload: {
        includedTypes: category.includedTypes || [],
        allowedBrandNames: category.allowedBrandNames || [],
        radiusMeters: category.radiusMeters,
      },
      placeId: null,
      placeResourceName: null,
      placeName: null,
      placeFormattedAddress: null,
      placePrimaryType: null,
      placeTypes: [],
      placeLat: null,
      placeLng: null,
      straightLineDistanceMeters: null,
      walkingDistanceMeters: null,
      walkingDurationSeconds: null,
      routeCondition: placesResponse?.api ? "SEARCH_FAILED" : "NO_MATCH",
      routePayload: routeError ? { error: String(routeError.message || routeError) } : {},
      placePayload: placeErrorPayload,
    };
  }

  const destinationWithRoutes = matchRoutesToDestinations(routeMatrixResponse, places)
    .map((entry) => ({
      ...entry,
      straightLineDistanceMeters: haversineDistanceMeters(
        {
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
        },
        {
          latitude: entry.destination.latitude,
          longitude: entry.destination.longitude,
        },
      ),
    }))
    .filter((entry) => entry.route?.condition === "ROUTE_EXISTS");

  if (!destinationWithRoutes.length) {
    return {
      categoryKey: category.key,
      categoryLabel: category.label,
      categorySource: category.source,
      searchMethod: category.searchMethod || "nearby_search",
      searchConfidence: "low",
      requestedQuery: (category.includedTypes || []).join(","),
      requestedQueryPayload: {
        includedTypes: category.includedTypes || [],
        allowedBrandNames: category.allowedBrandNames || [],
        radiusMeters: category.radiusMeters,
      },
      placeId: null,
      placeResourceName: null,
      placeName: null,
      placeFormattedAddress: null,
      placePrimaryType: null,
      placeTypes: [],
      placeLat: null,
      placeLng: null,
      straightLineDistanceMeters: null,
      walkingDistanceMeters: null,
      walkingDurationSeconds: null,
      routeCondition: routeError ? "ROUTE_FAILED" : "NO_ROUTE",
      routePayload: routeError ? { error: String(routeError.message || routeError) } : {},
      placePayload: {},
    };
  }

  const winner = destinationWithRoutes.sort((left, right) => {
    const leftDuration = left.durationSeconds ?? Number.MAX_SAFE_INTEGER;
    const rightDuration = right.durationSeconds ?? Number.MAX_SAFE_INTEGER;
    if (leftDuration !== rightDuration) return leftDuration - rightDuration;
    return (
      (left.straightLineDistanceMeters ?? Number.MAX_SAFE_INTEGER) -
      (right.straightLineDistanceMeters ?? Number.MAX_SAFE_INTEGER)
    );
  })[0];

  return {
    categoryKey: category.key,
    categoryLabel: category.label,
    categorySource: category.source,
    searchMethod: category.searchMethod || "nearby_search",
    searchConfidence: category.confidence,
    requestedQuery: (category.includedTypes || []).join(","),
    requestedQueryPayload: {
      includedTypes: category.includedTypes || [],
      allowedBrandNames: category.allowedBrandNames || [],
      radiusMeters: category.radiusMeters,
      maxResultCount: category.maxResultCount,
    },
    placeId: winner.destination.id,
    placeResourceName: winner.destination.resourceName,
    placeName: winner.destination.name,
    placeFormattedAddress: winner.destination.formattedAddress,
    placePrimaryType: winner.destination.primaryType,
    placeTypes: winner.destination.types,
    placeLat: winner.destination.latitude,
    placeLng: winner.destination.longitude,
    straightLineDistanceMeters: winner.straightLineDistanceMeters,
    walkingDistanceMeters: winner.distanceMeters,
    walkingDurationSeconds: winner.durationSeconds,
    routeCondition: winner.condition,
    routePayload: winner.route || {},
    placePayload: winner.destination.payload,
  };
}

function buildListingExportCore(enrichment) {
  const proximityColumns = {};
  for (const proximity of enrichment.proximityMatches) {
    const prefix = proximity.categoryKey;
    proximityColumns[`${prefix}_place_name`] = proximity.placeName;
    proximityColumns[`${prefix}_walk_minutes`] = Number.isFinite(
      proximity.walkingDurationSeconds,
    )
      ? Math.round((proximity.walkingDurationSeconds / 60) * 10) / 10
      : null;
    proximityColumns[`${prefix}_walk_distance_m`] = proximity.walkingDistanceMeters;
    proximityColumns[`${prefix}_route_condition`] = proximity.routeCondition;
  }

  return {
    source: enrichment.listing.source,
    source_listing_id: enrichment.listing.sourceListingId,
    source_url: enrichment.listing.sourceUrl,
    search_city: enrichment.listing.searchCity,
    geocode_status: enrichment.geocode.status,
    geocode_query: enrichment.geocode.query,
    formatted_address: enrichment.geocode.formattedAddress,
    lat: enrichment.geocode.latitude,
    lng: enrichment.geocode.longitude,
    weather_condition: enrichment.weather.snapshot?.conditionText ?? null,
    weather_temperature_c: enrichment.weather.snapshot?.temperatureC ?? null,
    weather_next12h_rain_hours: enrichment.weather.snapshot?.next12hRainHourCount ?? null,
    weather_next12h_max_precip_probability:
      enrichment.weather.snapshot?.next12hMaxPrecipProbabilityPercent ?? null,
    air_quality_aqi: enrichment.airQuality.snapshot?.aqiValue ?? null,
    air_quality_category: enrichment.airQuality.snapshot?.aqiCategory ?? null,
    air_quality_dominant_pollutant:
      enrichment.airQuality.snapshot?.dominantPollutant ?? null,
    sunlight_score: enrichment.sunlight.score,
    sunlight_confidence: enrichment.sunlight.confidence,
    sunlight_orientation_hint: enrichment.sunlight.estimatedOrientationHint,
    sunlight_reasons: enrichment.sunlight.reasons.join(" | "),
    ...proximityColumns,
  };
}

export function flattenEnrichmentForCsv(enrichments) {
  return enrichments.map((enrichment) => buildListingExportCore(enrichment));
}

export async function enrichListing({
  googleClient,
  listing,
  categories,
  allowDistrictFallback = false,
}) {
  const geocodeInput = buildGeocodeInput(listing);
  let geocodeResponse = null;
  let geocode = parseGeocodeResponse(geocodeInput, null);

  if (geocodeInput.status === "ready") {
    try {
      geocodeResponse = await googleClient.geocodeAddress({
        query: geocodeInput.query,
        city: geocodeInput.components.city,
      });
      geocode = parseGeocodeResponse(geocodeInput, geocodeResponse);
    } catch (error) {
      geocode = {
        ...geocode,
        status: "failed",
        payload: {
          api: error.operationName || "geocode",
          status: error.providerStatus || null,
          error_message: error.providerErrorMessage || null,
          error: String(error.message || error),
        },
      };
    }
  } else if (allowDistrictFallback && !listing.streetHintRaw?.trim()) {
    const fallbackInput = buildDistrictFallbackGeocodeInput(listing);
    geocode = parseGeocodeResponse(fallbackInput, null);

    if (fallbackInput.status === "ready") {
      try {
        geocodeResponse = await googleClient.geocodeAddress({
          query: fallbackInput.query,
          city: fallbackInput.components.city,
        });
        geocode = applyDistrictFallbackScatter(
          parseGeocodeResponse(fallbackInput, geocodeResponse),
          listing,
        );
      } catch (error) {
        geocode = {
          ...geocode,
          status: "failed",
          payload: {
            api: error.operationName || "geocode",
            status: error.providerStatus || null,
            error_message: error.providerErrorMessage || null,
            error: String(error.message || error),
          },
        };
      }
    }
  }

  const weather = {
    status: "skipped",
    snapshot: {},
    payload: {},
    fetchedAt: null,
  };
  const airQuality = {
    status: "skipped",
    snapshot: {},
    payload: {},
    fetchedAt: null,
  };
  const sunlight = {
    status: "skipped",
    score: null,
    confidence: null,
    estimatedOrientationHint: null,
    reasons: [],
    payload: {},
    fetchedAt: null,
  };
  const proximityMatches = [];

  if (geocode.status === "succeeded") {
    try {
      const [currentWeather, hourlyForecast] = await Promise.all([
        googleClient.getCurrentWeather({
          latitude: geocode.latitude,
          longitude: geocode.longitude,
        }),
        googleClient.getHourlyForecast({
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          hours: 12,
        }),
      ]);
      weather.status = "succeeded";
      weather.snapshot = summarizeWeatherSnapshot({
        currentWeather,
        hourlyForecast,
      });
      weather.payload = {
        currentWeather,
        hourlyForecast,
      };
      weather.fetchedAt = new Date().toISOString();
    } catch (error) {
      weather.status = "failed";
      weather.payload = {
        api: error.operationName || "weather",
        status: error.providerStatus || null,
        error_message: error.providerErrorMessage || null,
        error: String(error.message || error),
      };
      weather.fetchedAt = new Date().toISOString();
    }

    try {
      const currentAirQuality = await googleClient.getCurrentAirQuality({
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      });
      airQuality.status = "succeeded";
      airQuality.snapshot = summarizeAirQualitySnapshot(currentAirQuality);
      airQuality.payload = currentAirQuality;
      airQuality.fetchedAt = new Date().toISOString();
    } catch (error) {
      airQuality.status = "failed";
      airQuality.payload = {
        api: error.operationName || "air_quality",
        status: error.providerStatus || null,
        error_message: error.providerErrorMessage || null,
        error: String(error.message || error),
      };
      airQuality.fetchedAt = new Date().toISOString();
    }

    try {
      const buildingInsights = await googleClient.getBuildingInsights({
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      });
      const sunlightEstimate = summarizeSunlightEstimate({
        buildingInsights,
        listing,
        geocodeResult: geocode,
      });
      sunlight.status = sunlightEstimate.status;
      sunlight.score = sunlightEstimate.score;
      sunlight.confidence = sunlightEstimate.confidence;
      sunlight.estimatedOrientationHint =
        sunlightEstimate.estimatedOrientationHint;
      sunlight.reasons = sunlightEstimate.reasons;
      sunlight.payload = {
        buildingInsights,
        summary: sunlightEstimate.payload,
      };
      sunlight.fetchedAt = new Date().toISOString();
    } catch (error) {
      sunlight.status = "failed";
      sunlight.payload = {
        api: error.operationName || "sunlight",
        status: error.providerStatus || null,
        error_message: error.providerErrorMessage || null,
        error: String(error.message || error),
      };
      sunlight.fetchedAt = new Date().toISOString();
    }

    for (const category of categories) {
      let placesResponse = { places: [] };
      let routeMatrixResponse = [];
      let routeError = null;

      try {
        const nearbyResponse = await googleClient.searchNearbyPlaces({
          includedTypes: category.includedTypes,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          radiusMeters: category.radiusMeters,
          maxResultCount: category.maxResultCount,
        });

        placesResponse = {
          ...nearbyResponse,
          places: filterPlacesByAllowedBrandNames(
            Array.isArray(nearbyResponse?.places) ? nearbyResponse.places : [],
            category.allowedBrandNames,
          ),
        };
      } catch (error) {
        placesResponse = {
          api: error.operationName || "places_search_nearby",
          status: error.providerStatus || null,
          error_message: error.providerErrorMessage || null,
          error: String(error.message || error),
          places: [],
        };
      }
      const normalizedPlaces = Array.isArray(placesResponse?.places)
        ? placesResponse.places
        : [];

      if (normalizedPlaces.length) {
        try {
          routeMatrixResponse = await googleClient.computeWalkingMatrix({
            origin: {
              latitude: geocode.latitude,
              longitude: geocode.longitude,
            },
            destinations: normalizedPlaces.map((place) => ({
              latitude: getNumber(place?.location?.latitude),
              longitude: getNumber(place?.location?.longitude),
            })),
          });
        } catch (error) {
          routeError = error;
        }
      }

      proximityMatches.push(
        selectBestPlaceMatch({
          geocodeResult: geocode,
          category,
          placesResponse,
          routeMatrixResponse,
          routeError,
        }),
      );
    }
  }

  return {
    listing,
    geocode,
    weather,
    airQuality,
    sunlight,
    proximityMatches,
  };
}
