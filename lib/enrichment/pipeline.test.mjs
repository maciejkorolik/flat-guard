import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequestedCategories } from "./category-config.mjs";
import {
  buildGeocodeInput,
  describeGeocodeQueryRequirements,
  ENRICHMENT_QUERY_COMPONENTS,
  flattenEnrichmentForCsv,
  normalizeNormalizedRecord,
  parseGeocodeResponse,
  selectBestPlaceMatch,
  summarizeAirQualitySnapshot,
  summarizeWeatherSnapshot,
} from "./pipeline.mjs";
import { summarizeSunlightEstimate } from "./sunlight.mjs";

test("buildGeocodeInput requires street, district, and city", () => {
  const ready = buildGeocodeInput({
    streetHintRaw: "ul. Żwirki i Wigury",
    districtBreadcrumbRaw: "Fabryczna",
    searchCity: "Wrocław",
  });

  assert.equal(ready.status, "ready");
  assert.match(ready.query, /Fabryczna/);

  const missingStreet = buildGeocodeInput({
    streetHintRaw: null,
    districtBreadcrumbRaw: "Fabryczna",
    searchCity: "Wrocław",
  });

  assert.equal(missingStreet.status, "insufficient_input");
});

test("describeGeocodeQueryRequirements reports missing query components", () => {
  const missing = describeGeocodeQueryRequirements({
    streetHintRaw: "ul. Zwirki i Wigury",
    districtBreadcrumbRaw: null,
    districtHintRaw: null,
    district: null,
    searchCity: "Wrocław",
  });

  assert.deepEqual(ENRICHMENT_QUERY_COMPONENTS, ["street", "district", "city"]);
  assert.equal(missing.isReady, false);
  assert.deepEqual(missing.components, {
    street: "ul. Zwirki i Wigury",
    district: null,
    city: "Wrocław",
  });
  assert.deepEqual(missing.missingComponents, ["district"]);
});

test("normalizeNormalizedRecord adapts canonical listing rows for enrichment", () => {
  const listing = normalizeNormalizedRecord({
    id: "listing-1",
    raw_listing_id: "raw-1",
    source: "olx.pl",
    external_id: "19IveV",
    url: "https://www.olx.pl/d/oferta/wynajem-mieszkania-CID3-ID19IveV.html",
    title: "Wynajem mieszkania",
    description: "Jasne mieszkanie.",
    city: "Wrocław",
    district: "Fabryczna",
    neighbourhood: null,
    address: "ul. Żwirki i Wigury",
    exact_location_available: true,
    source_detail_payload: {
      product_jsonld: {
        description: "Jasne mieszkanie.",
      },
    },
  });

  assert.equal(listing.normalizedListingId, "listing-1");
  assert.equal(listing.rawListingId, "raw-1");
  assert.equal(listing.source, "olx");
  assert.equal(listing.sourceListingId, "19IveV");
  assert.equal(listing.streetHintRaw, "ul. Żwirki i Wigury");
  assert.equal(listing.exactLocationAvailableRaw, true);
  assert.deepEqual(listing.rawDetailPayload, {
    product_jsonld: {
      description: "Jasne mieszkanie.",
    },
  });
});

test("parseGeocodeResponse preserves provider failures", () => {
  const geocode = parseGeocodeResponse(
    {
      status: "ready",
      query: "ul. Zwirki i Wigury, Fabryczna, Wroclaw, Poland",
      components: {
        street: "ul. Zwirki i Wigury",
        district: "Fabryczna",
        city: "Wroclaw",
      },
    },
    {
      status: "REQUEST_DENIED",
      error_message: "This API is not activated on your API project.",
      results: [],
    },
  );

  assert.equal(geocode.status, "failed");
  assert.match(geocode.payload.error_message, /not activated/i);
});

test("resolveRequestedCategories keeps baselines and mixes curated plus free text", () => {
  const categories = resolveRequestedCategories(["gym", "climbing gym"]);
  const keys = categories.map((category) => category.key);

  assert.deepEqual(keys.slice(0, 3), ["park", "grocery", "library"]);
  assert.ok(keys.includes("gym"));
  assert.ok(keys.includes("climbing-gym"));
});

test("summarizeSunlightEstimate uses solar data and text evidence", () => {
  const summary = summarizeSunlightEstimate({
    geocodeResult: {
      status: "succeeded",
      partialMatch: false,
    },
    listing: {
      listingTitle: "Jasne mieszkanie",
      descriptionRaw: "Bardzo słoneczne mieszkanie z ekspozycją południową.",
    },
    buildingInsights: {
      solarPotential: {
        maxSunshineHoursPerYear: 1800,
        wholeRoofStats: {
          sunshineQuantiles: [1200, 1400, 1600, 1700, 1750],
        },
        roofSegmentStats: [
          {
            azimuthDegrees: 230,
            sunshineQuantiles: [1300, 1500, 1650, 1750, 1800],
          },
        ],
      },
    },
  });

  assert.equal(summary.status, "succeeded");
  assert.equal(summary.confidence, "high");
  assert.equal(summary.estimatedOrientationHint, "south");
  assert.ok(summary.score >= 70);
});

test("summarizeWeatherSnapshot reduces current plus hourly forecast", () => {
  const summary = summarizeWeatherSnapshot({
    currentWeather: {
      currentTime: "2026-03-28T12:00:00Z",
      weatherCondition: {
        type: "LIGHT_RAIN",
        description: { text: "Light rain" },
      },
      temperature: {
        degrees: 11,
      },
      precipitation: {
        probability: {
          percent: 65,
        },
      },
    },
    hourlyForecast: {
      forecastHours: [
        {
          weatherCondition: { type: "LIGHT_RAIN" },
          precipitation: { probability: { percent: 65 } },
        },
        {
          weatherCondition: { type: "CLOUDY" },
          precipitation: { probability: { percent: 10 } },
        },
      ],
    },
  });

  assert.equal(summary.conditionType, "LIGHT_RAIN");
  assert.equal(summary.next12hRainHourCount, 1);
  assert.equal(summary.temperatureC, 11);
});

test("summarizeAirQualitySnapshot prefers the AQI-like index", () => {
  const summary = summarizeAirQualitySnapshot({
    dateTime: "2026-03-28T12:00:00Z",
    dominantPollutant: { code: "pm25" },
    indexes: [
      { code: "uaqi", aqi: 42, category: { displayName: "Good" } },
      { code: "european_aqi", aqi: 55, category: { displayName: "Fair" } },
    ],
  });

  assert.equal(summary.aqiValue, 42);
  assert.equal(summary.dominantPollutant, "pm25");
});

test("selectBestPlaceMatch ranks by walking duration", () => {
  const match = selectBestPlaceMatch({
    geocodeResult: {
      latitude: 51.1,
      longitude: 17.03,
    },
    category: {
      key: "park",
      label: "Park",
      source: "baseline",
      confidence: "high",
      textQuery: "park",
      radiusMeters: 2500,
      maxResultCount: 8,
    },
    placesResponse: {
      places: [
        {
          id: "a",
          name: "places/a",
          displayName: { text: "Slow Park" },
          formattedAddress: "A",
          location: { latitude: 51.101, longitude: 17.031 },
        },
        {
          id: "b",
          name: "places/b",
          displayName: { text: "Fast Park" },
          formattedAddress: "B",
          location: { latitude: 51.102, longitude: 17.032 },
        },
      ],
    },
    routeMatrixResponse: [
      {
        destinationIndex: 0,
        duration: "900s",
        distanceMeters: 1200,
        condition: "ROUTE_EXISTS",
      },
      {
        destinationIndex: 1,
        duration: "420s",
        distanceMeters: 800,
        condition: "ROUTE_EXISTS",
      },
    ],
  });

  assert.equal(match.placeName, "Fast Park");
  assert.equal(match.walkingDurationSeconds, 420);
});

test("flattenEnrichmentForCsv expands proximity columns", () => {
  const rows = flattenEnrichmentForCsv([
    {
      listing: {
        source: "olx",
        sourceListingId: "123",
        sourceUrl: "https://example.com",
        searchCity: "Wrocław",
      },
      geocode: {
        status: "succeeded",
        query: "ul. A, Fabryczna, Wrocław, Poland",
        formattedAddress: "A",
        latitude: 51.1,
        longitude: 17.03,
      },
      weather: {
        snapshot: {
          conditionText: "Cloudy",
          temperatureC: 10,
          next12hRainHourCount: 2,
          next12hMaxPrecipProbabilityPercent: 55,
        },
      },
      airQuality: {
        snapshot: {
          aqiValue: 45,
          aqiCategory: "Good",
          dominantPollutant: "pm25",
        },
      },
      sunlight: {
        score: 82,
        confidence: "medium",
        estimatedOrientationHint: "southwest",
        reasons: ["Estimated from roof stats."],
      },
      proximityMatches: [
        {
          categoryKey: "park",
          placeName: "Park",
          walkingDurationSeconds: 300,
          walkingDistanceMeters: 400,
          routeCondition: "ROUTE_EXISTS",
        },
      ],
    },
  ]);

  assert.equal(rows[0].park_place_name, "Park");
  assert.equal(rows[0].park_walk_minutes, 5);
});
