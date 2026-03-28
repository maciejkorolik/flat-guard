import test from "node:test";
import assert from "node:assert/strict";
import {
  NORMALIZED_ENRICHMENT_INPUT_COLUMNS,
  buildNormalizedEnrichmentSelect,
  buildNormalizedEnrichmentUpdate,
  filterRecordToAllowedColumns,
  getSupabaseAdminKeyFromEnv,
  projectRawListingRowToNormalizedRecord,
} from "./io.mjs";

test("getSupabaseAdminKeyFromEnv accepts the service key alias", () => {
  assert.equal(
    getSupabaseAdminKeyFromEnv({
      SUPABASE_SERVICE_KEY: "service-key",
    }),
    "service-key",
  );

  assert.equal(
    getSupabaseAdminKeyFromEnv({
      SUPABASE_SERVICE_ROLE_KEY: "role-key",
      SUPABASE_SERVICE_KEY: "service-key",
    }),
    "role-key",
  );
});

test("projectRawListingRowToNormalizedRecord preserves richer normalized inputs", () => {
  const projected = projectRawListingRowToNormalizedRecord({
    id: "raw-1",
    normalized_id: null,
    source: "olx.pl",
    external_id: "19IveV",
    raw_data: {
      source: "olx.pl",
      listing_id: "19IveV",
      listing_url:
        "https://www.olx.pl/d/oferta/wynajem-mieszkania-CID3-ID19IveV.html?search_reason=search%7Cpromoted",
      title_raw: "Wynajem mieszkania",
      description_raw: "Jasne mieszkanie.",
      city_query: "wroclaw",
      area_served_raw: "Wrocław, Fabryczna - Odświeżono dnia 15 marca 2026",
      district_breadcrumb_raw: "Fabryczna",
      street_hint_raw: "ul. Żwirki i Wigury",
      exact_location_available_raw: true,
      image_urls_raw: ["https://example.com/image.jpg"],
      source_business_type_raw: "Prywatne",
      raw_offer_json: {
        promoted: true,
      },
      raw_detail_json: {
        product_jsonld: {
          description: "Jasne mieszkanie.",
        },
      },
      price_numeric_raw: 2650,
    },
  });

  assert.equal(projected.raw_listing_id, "raw-1");
  assert.equal(projected.source, "olx.pl");
  assert.equal(projected.external_id, "19IveV");
  assert.equal(projected.url, "https://www.olx.pl/d/oferta/wynajem-mieszkania-CID3-ID19IveV.html");
  assert.equal(projected.address, "ul. Żwirki i Wigury");
  assert.equal(projected.exact_location_available, true);
  assert.deepEqual(projected.image_urls, ["https://example.com/image.jpg"]);
  assert.equal(projected.source_business_type, "Prywatne");
  assert.deepEqual(projected.source_offer_payload, {
    promoted: true,
  });
  assert.deepEqual(projected.source_detail_payload, {
    product_jsonld: {
      description: "Jasne mieszkanie.",
    },
  });
});

test("buildNormalizedEnrichmentSelect keeps only columns present in the live schema", () => {
  const select = buildNormalizedEnrichmentSelect(
    new Set(["id", "source", "external_id", "title", "address"]),
  );

  assert.deepEqual(select.split(","), [
    "id",
    "source",
    "external_id",
    "title",
    "address",
  ]);
  assert.ok(NORMALIZED_ENRICHMENT_INPUT_COLUMNS.includes("city"));
});

test("buildNormalizedEnrichmentUpdate maps pipeline output into listings_normalized columns", () => {
  const payload = buildNormalizedEnrichmentUpdate({
    enrichmentRunId: "run-1",
    now: "2026-03-28T18:00:00.000Z",
    enrichment: {
      geocode: {
        status: "succeeded",
        query: "ul. Zwirki, Fabryczna, Wroclaw, Poland",
        formattedAddress: "ul. Zwirki, Fabryczna, Wroclaw, Poland",
        placeId: "place-1",
        locationType: "ROOFTOP",
        resultTypes: ["street_address"],
        partialMatch: false,
        latitude: 51.1,
        longitude: 17.03,
      },
      weather: {
        status: "succeeded",
        snapshot: {
          summaryTime: "2026-03-28T17:55:00Z",
          conditionType: "PARTLY_CLOUDY",
          conditionText: "Partly cloudy",
          temperatureC: 12,
          precipitationProbabilityPercent: 35,
          next12hRainHourCount: 2,
          next12hMaxPrecipProbabilityPercent: 58,
        },
        fetchedAt: "2026-03-28T17:56:00Z",
      },
      airQuality: {
        status: "succeeded",
        snapshot: {
          summaryTime: "2026-03-28T17:57:00Z",
          aqiIndexCode: "uaqi",
          aqiDisplayName: "UAQI",
          aqiValue: 42,
          aqiCategory: "Good",
          dominantPollutant: "pm25",
        },
        fetchedAt: "2026-03-28T17:58:00Z",
      },
      sunlight: {
        status: "succeeded",
        score: 81.5,
        confidence: "high",
        estimatedOrientationHint: "south",
        reasons: ["bright or sunny exposure"],
        fetchedAt: "2026-03-28T17:59:00Z",
      },
      proximityMatches: [
        {
          categoryKey: "park",
          routeCondition: "ROUTE_EXISTS",
          placeId: "park-1",
          placeName: "Park",
        },
      ],
    },
  });

  assert.equal(payload.last_enrichment_run_id, "run-1");
  assert.equal(payload.geocode_status, "succeeded");
  assert.equal(payload.geocode_lat, 51.1);
  assert.equal(payload.geocode_lng, 17.03);
  assert.equal(payload.geocoded_at, "2026-03-28T18:00:00.000Z");
  assert.equal(payload.weather_condition_text, "Partly cloudy");
  assert.equal(payload.air_quality_aqi_value, 42);
  assert.equal(payload.sunlight_confidence, "high");
  assert.equal(payload.proximity_fetched_at, "2026-03-28T18:00:00.000Z");
  assert.deepEqual(payload.proximity_matches, [
    {
      categoryKey: "park",
      routeCondition: "ROUTE_EXISTS",
      placeId: "park-1",
      placeName: "Park",
    },
  ]);
});

test("filterRecordToAllowedColumns drops columns missing from the live schema", () => {
  const filtered = filterRecordToAllowedColumns(
    {
      geocode_status: "succeeded",
      weather_status: "succeeded",
      sunlight_score: 80,
    },
    new Set(["geocode_status", "sunlight_score"]),
  );

  assert.deepEqual(filtered, {
    geocode_status: "succeeded",
    sunlight_score: 80,
  });
});
