import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  enrichListing,
  flattenEnrichmentForCsv,
  normalizeCrawlerRecord,
} from "./pipeline.mjs";
import { resolveRequestedCategories } from "./category-config.mjs";

interface LatLng {
  latitude: number;
  longitude: number;
}

interface RouteFixture {
  distanceMeters: number;
  durationSeconds: number;
}

interface GoogleGeocodeResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    location_type: string;
  };
  partial_match?: boolean;
  place_id: string;
  types: string[];
}

interface GoogleGeocodeResponse {
  status: "OK";
  results: GoogleGeocodeResult[];
}

interface GooglePlacesResponse {
  places: Array<{
    id: string;
    name: string;
    displayName: {
      text: string;
    };
    formattedAddress: string;
    primaryType: string;
    types: string[];
    location: LatLng;
  }>;
}

interface FixtureGoogleClient {
  geocodeAddress(args: { query: string; city: string }): Promise<GoogleGeocodeResponse>;
  getCurrentWeather(args: LatLng): Promise<Record<string, unknown>>;
  getHourlyForecast(args: LatLng & { hours: number }): Promise<Record<string, unknown>>;
  getCurrentAirQuality(args: LatLng): Promise<Record<string, unknown>>;
  getBuildingInsights(args: LatLng): Promise<Record<string, unknown>>;
  searchPlacesByText(args: {
    textQuery: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    maxResultCount: number;
  }): Promise<GooglePlacesResponse>;
  computeWalkingMatrix(args: {
    origin: LatLng;
    destinations: LatLng[];
  }): Promise<
    Array<{
      destinationIndex: number;
      distanceMeters: number;
      duration: string;
      condition: "ROUTE_EXISTS";
    }>
  >;
}

interface WeatherSnapshot {
  conditionType: string | null;
  temperatureC: number | null;
  next12hRainHourCount: number | null;
  next12hMaxPrecipProbabilityPercent: number | null;
}

interface AirQualitySnapshot {
  aqiValue: number | null;
  aqiCategory: string | null;
  dominantPollutant: string | null;
}

interface SunlightSummary {
  score: number | null;
  confidence: string | null;
  estimatedOrientationHint: string | null;
  reasons: string[];
}

interface ProximityMatchSummary {
  categoryKey: string;
  categorySource: string;
  searchConfidence: string;
  placeName: string | null;
  walkingDurationSeconds: number | null;
  routeCondition: string | null;
}

interface ValidEnrichmentSummary {
  geocode: {
    status: string;
    formattedAddress: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  weather: {
    status: string;
    snapshot: WeatherSnapshot;
  };
  airQuality: {
    status: string;
    snapshot: AirQualitySnapshot;
  };
  sunlight: {
    status: string;
  } & SunlightSummary;
  proximityMatches: ProximityMatchSummary[];
}

const DATASET_PATH = fileURLToPath(
  new URL(
    "../../../../../.local-data/olx/olx_wroclaw_rentals_raw_20260328T113702845Z.jsonl",
    import.meta.url,
  ),
);

const FIXTURE_LATITUDE = 51.120123;
const FIXTURE_LONGITUDE = 16.973456;

function destinationKey({ latitude, longitude }: LatLng): string {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function loadRawCrawlerRecord(listingId: string): Record<string, unknown> {
  const rows = readFileSync(DATASET_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  const record = rows.find((row) => row.listing_id === listingId);
  assert.ok(record, `expected dataset fixture listing ${listingId} to exist`);
  return record;
}

function buildValidGoogleClientFixture() {
  const geocodeResponse: GoogleGeocodeResponse = {
    status: "OK",
    results: [
      {
        formatted_address: "Żwirki i Wigury 12, 54-612 Wrocław, Poland",
        geometry: {
          location: {
            lat: FIXTURE_LATITUDE,
            lng: FIXTURE_LONGITUDE,
          },
          location_type: "RANGE_INTERPOLATED",
        },
        place_id: "fixture-geocode-place-id",
        types: ["street_address"],
      },
    ],
  };

  const currentWeather = {
    currentTime: "2026-03-28T13:00:00Z",
    weatherCondition: {
      type: "PARTLY_CLOUDY",
      description: {
        text: "Partly cloudy",
      },
    },
    temperature: {
      degrees: 12,
    },
    precipitation: {
      probability: {
        percent: 35,
      },
    },
  };

  const hourlyForecast = {
    forecastHours: [
      {
        weatherCondition: {
          type: "CLOUDY",
        },
        precipitation: {
          probability: {
            percent: 10,
          },
        },
      },
      {
        weatherCondition: {
          type: "LIGHT_RAIN",
        },
        precipitation: {
          probability: {
            percent: 58,
          },
        },
      },
      {
        weatherCondition: {
          type: "SHOWERS",
        },
        precipitation: {
          probability: {
            percent: 72,
          },
        },
      },
      {
        weatherCondition: {
          type: "CLOUDY",
        },
        precipitation: {
          probability: {
            percent: 25,
          },
        },
      },
    ],
  };

  const currentAirQuality = {
    dateTime: "2026-03-28T13:00:00Z",
    dominantPollutant: {
      code: "pm25",
      displayName: {
        text: "PM2.5",
      },
    },
    indexes: [
      {
        code: "uaqi",
        aqi: 36,
        category: {
          displayName: "Good",
        },
        displayName: {
          text: "Universal AQI",
        },
      },
      {
        code: "european_aqi",
        aqi: 42,
        category: {
          displayName: "Fair",
        },
        displayName: {
          text: "European AQI",
        },
      },
    ],
  };

  const buildingInsights = {
    solarPotential: {
      maxSunshineHoursPerYear: 1710,
      wholeRoofStats: {
        sunshineQuantiles: [1260, 1390, 1510, 1620, 1690],
      },
      roofSegmentStats: [
        {
          azimuthDegrees: 225,
          sunshineQuantiles: [1320, 1460, 1600, 1710, 1780],
        },
        {
          azimuthDegrees: 90,
          sunshineQuantiles: [980, 1110, 1210, 1300, 1375],
        },
      ],
    },
  };

  const placesByQuery = new Map<string, GooglePlacesResponse>([
    [
      "park",
      {
        places: [
          {
            id: "park-1",
            name: "places/park-1",
            displayName: {
              text: "Park Zachodni",
            },
            formattedAddress: "Park Zachodni, Wrocław",
            primaryType: "park",
            types: ["park", "point_of_interest"],
            location: {
              latitude: 51.118001,
              longitude: 16.969001,
            },
          },
          {
            id: "park-2",
            name: "places/park-2",
            displayName: {
              text: "Park Tysiąclecia",
            },
            formattedAddress: "Park Tysiąclecia, Wrocław",
            primaryType: "park",
            types: ["park", "point_of_interest"],
            location: {
              latitude: 51.1215,
              longitude: 16.9795,
            },
          },
        ],
      },
    ],
    [
      "sklep spożywczy",
      {
        places: [
          {
            id: "grocery-1",
            name: "places/grocery-1",
            displayName: {
              text: "Biedronka Żwirki i Wigury",
            },
            formattedAddress: "ul. Żwirki i Wigury 2, Wrocław",
            primaryType: "grocery_store",
            types: ["grocery_store", "food", "point_of_interest"],
            location: {
              latitude: 51.1195,
              longitude: 16.9715,
            },
          },
        ],
      },
    ],
    [
      "biblioteka",
      {
        places: [
          {
            id: "library-1",
            name: "places/library-1",
            displayName: {
              text: "Biblioteka Nowy Dwór",
            },
            formattedAddress: "ul. Rogowska 52A, Wrocław",
            primaryType: "library",
            types: ["library", "point_of_interest"],
            location: {
              latitude: 51.1178,
              longitude: 16.9677,
            },
          },
        ],
      },
    ],
    [
      "siłownia",
      {
        places: [
          {
            id: "gym-1",
            name: "places/gym-1",
            displayName: {
              text: "Fitness Academy Nowy Dwór",
            },
            formattedAddress: "ul. Strzegomska 206, Wrocław",
            primaryType: "gym",
            types: ["gym", "health", "point_of_interest"],
            location: {
              latitude: 51.1168,
              longitude: 16.9758,
            },
          },
          {
            id: "gym-2",
            name: "places/gym-2",
            displayName: {
              text: "Factory Fitness",
            },
            formattedAddress: "ul. Graniczna 2, Wrocław",
            primaryType: "gym",
            types: ["gym", "health", "point_of_interest"],
            location: {
              latitude: 51.1232,
              longitude: 16.9812,
            },
          },
        ],
      },
    ],
    [
      "coworking",
      {
        places: [
          {
            id: "coworking-1",
            name: "places/coworking-1",
            displayName: {
              text: "Hub Coworking",
            },
            formattedAddress: "ul. Legnicka 48, Wrocław",
            primaryType: "coworking_space",
            types: ["coworking_space", "point_of_interest"],
            location: {
              latitude: 51.1121,
              longitude: 16.9911,
            },
          },
        ],
      },
    ],
  ]);

  const routesByDestination = new Map<string, RouteFixture>([
    [
      destinationKey({
        latitude: 51.118001,
        longitude: 16.969001,
      }),
      {
        distanceMeters: 760,
        durationSeconds: 650,
      },
    ],
    [
      destinationKey({
        latitude: 51.1215,
        longitude: 16.9795,
      }),
      {
        distanceMeters: 540,
        durationSeconds: 420,
      },
    ],
    [
      destinationKey({
        latitude: 51.1195,
        longitude: 16.9715,
      }),
      {
        distanceMeters: 320,
        durationSeconds: 250,
      },
    ],
    [
      destinationKey({
        latitude: 51.1178,
        longitude: 16.9677,
      }),
      {
        distanceMeters: 980,
        durationSeconds: 760,
      },
    ],
    [
      destinationKey({
        latitude: 51.1168,
        longitude: 16.9758,
      }),
      {
        distanceMeters: 880,
        durationSeconds: 690,
      },
    ],
    [
      destinationKey({
        latitude: 51.1232,
        longitude: 16.9812,
      }),
      {
        distanceMeters: 1040,
        durationSeconds: 540,
      },
    ],
    [
      destinationKey({
        latitude: 51.1121,
        longitude: 16.9911,
      }),
      {
        distanceMeters: 2210,
        durationSeconds: 1640,
      },
    ],
  ]);

  const searchQueries: string[] = [];

  const client: FixtureGoogleClient = {
    async geocodeAddress({ query, city }) {
      assert.equal(query, "ul. Żwirki i Wigury, Fabryczna, wroclaw, Poland");
      assert.equal(city, "wroclaw");
      return geocodeResponse;
    },

    async getCurrentWeather({ latitude, longitude }) {
      assert.equal(latitude, FIXTURE_LATITUDE);
      assert.equal(longitude, FIXTURE_LONGITUDE);
      return currentWeather;
    },

    async getHourlyForecast({ latitude, longitude, hours }) {
      assert.equal(latitude, FIXTURE_LATITUDE);
      assert.equal(longitude, FIXTURE_LONGITUDE);
      assert.equal(hours, 12);
      return hourlyForecast;
    },

    async getCurrentAirQuality({ latitude, longitude }) {
      assert.equal(latitude, FIXTURE_LATITUDE);
      assert.equal(longitude, FIXTURE_LONGITUDE);
      return currentAirQuality;
    },

    async getBuildingInsights({ latitude, longitude }) {
      assert.equal(latitude, FIXTURE_LATITUDE);
      assert.equal(longitude, FIXTURE_LONGITUDE);
      return buildingInsights;
    },

    async searchPlacesByText({
      textQuery,
      latitude,
      longitude,
      radiusMeters,
      maxResultCount,
    }) {
      assert.equal(latitude, FIXTURE_LATITUDE);
      assert.equal(longitude, FIXTURE_LONGITUDE);
      assert.ok(radiusMeters > 0);
      assert.equal(maxResultCount, 8);

      const response = placesByQuery.get(textQuery);
      assert.ok(response, `missing places fixture for query ${textQuery}`);
      searchQueries.push(textQuery);
      return response;
    },

    async computeWalkingMatrix({ origin, destinations }) {
      assert.deepEqual(origin, {
        latitude: FIXTURE_LATITUDE,
        longitude: FIXTURE_LONGITUDE,
      });

      return destinations.map((destination, destinationIndex) => {
        const route = routesByDestination.get(destinationKey(destination));
        assert.ok(
          route,
          `missing route fixture for destination ${destinationKey(destination)}`,
        );

        return {
          destinationIndex,
          distanceMeters: route.distanceMeters,
          duration: `${route.durationSeconds}s`,
          condition: "ROUTE_EXISTS" as const,
        };
      });
    },
  };

  return {
    client,
    searchQueries,
  };
}

async function buildValidEnrichmentFixture() {
  const listing = normalizeCrawlerRecord(loadRawCrawlerRecord("19IveV"));
  const categories = resolveRequestedCategories(["gym", "coworking"]);
  const googleFixture = buildValidGoogleClientFixture();

  const enrichment = await enrichListing({
    googleClient: googleFixture.client,
    listing,
    categories,
  });

  return {
    listing,
    categories,
    searchQueries: googleFixture.searchQueries,
    enrichment,
  };
}

test("enrichListing builds a fully populated valid enrichment for a real dataset row", async () => {
  const { listing, categories, searchQueries, enrichment } =
    await buildValidEnrichmentFixture();
  const typedEnrichment = enrichment as unknown as ValidEnrichmentSummary;

  assert.equal(listing.sourceListingId, "19IveV");
  assert.equal(listing.streetHintRaw, "ul. Żwirki i Wigury");
  assert.equal(typedEnrichment.geocode.status, "succeeded");
  assert.equal(
    typedEnrichment.geocode.formattedAddress,
    "Żwirki i Wigury 12, 54-612 Wrocław, Poland",
  );
  assert.equal(typedEnrichment.geocode.latitude, FIXTURE_LATITUDE);
  assert.equal(typedEnrichment.geocode.longitude, FIXTURE_LONGITUDE);

  assert.equal(typedEnrichment.weather.status, "succeeded");
  assert.equal(typedEnrichment.weather.snapshot.conditionType, "PARTLY_CLOUDY");
  assert.equal(typedEnrichment.weather.snapshot.temperatureC, 12);
  assert.equal(typedEnrichment.weather.snapshot.next12hRainHourCount, 2);
  assert.equal(
    typedEnrichment.weather.snapshot.next12hMaxPrecipProbabilityPercent,
    72,
  );

  assert.equal(typedEnrichment.airQuality.status, "succeeded");
  assert.equal(typedEnrichment.airQuality.snapshot.aqiValue, 36);
  assert.equal(typedEnrichment.airQuality.snapshot.aqiCategory, "Good");
  assert.equal(typedEnrichment.airQuality.snapshot.dominantPollutant, "PM2.5");

  assert.equal(typedEnrichment.sunlight.status, "succeeded");
  assert.equal(typedEnrichment.sunlight.confidence, "medium");
  assert.equal(typedEnrichment.sunlight.estimatedOrientationHint, "southwest");
  assert.ok((typedEnrichment.sunlight.score ?? 0) >= 70);
  assert.match(
    typedEnrichment.sunlight.reasons.join(" "),
    /building-level proxy/i,
  );
  assert.match(
    typedEnrichment.sunlight.reasons.join(" "),
    /bright or sunny exposure/i,
  );

  assert.equal(typedEnrichment.proximityMatches.length, categories.length);
  assert.deepEqual(
    searchQueries,
    categories.map((category) => category.textQuery),
  );

  const park = typedEnrichment.proximityMatches.find(
    (match) => match.categoryKey === "park",
  );
  assert.ok(park);
  assert.equal(park.placeName, "Park Tysiąclecia");
  assert.equal(park.walkingDurationSeconds, 420);
  assert.equal(park.routeCondition, "ROUTE_EXISTS");

  const gym = typedEnrichment.proximityMatches.find(
    (match) => match.categoryKey === "gym",
  );
  assert.ok(gym);
  assert.equal(gym.placeName, "Factory Fitness");
  assert.equal(gym.walkingDurationSeconds, 540);

  const coworking = typedEnrichment.proximityMatches.find(
    (match) => match.categoryKey === "coworking",
  );
  assert.ok(coworking);
  assert.equal(coworking.categorySource, "free_text_custom");
  assert.equal(coworking.searchConfidence, "low");
  assert.equal(coworking.placeName, "Hub Coworking");
  assert.equal(coworking.walkingDurationSeconds, 1640);
});

test("flattenEnrichmentForCsv keeps meaningful columns for a valid enrichment", async () => {
  const { enrichment } = await buildValidEnrichmentFixture();
  const [row] = flattenEnrichmentForCsv([enrichment]);

  assert.equal(row.geocode_status, "succeeded");
  assert.equal(row.formatted_address, "Żwirki i Wigury 12, 54-612 Wrocław, Poland");
  assert.equal(row.weather_condition, "Partly cloudy");
  assert.equal(row.weather_temperature_c, 12);
  assert.equal(row.weather_next12h_rain_hours, 2);
  assert.equal(row.air_quality_aqi, 36);
  assert.equal(row.air_quality_dominant_pollutant, "PM2.5");
  assert.equal(row.sunlight_confidence, "medium");
  assert.equal(row.sunlight_orientation_hint, "southwest");
  assert.equal(row.park_place_name, "Park Tysiąclecia");
  assert.equal(row.park_walk_minutes, 7);
  assert.equal(row.gym_place_name, "Factory Fitness");
  assert.equal(row.coworking_place_name, "Hub Coworking");
});
