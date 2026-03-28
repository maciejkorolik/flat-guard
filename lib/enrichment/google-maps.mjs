function buildLatLngQuery(latitude, longitude) {
  return `location.latitude=${encodeURIComponent(latitude)}&location.longitude=${encodeURIComponent(longitude)}`;
}

function getProviderErrorDetails(body) {
  if (!body || typeof body !== "object") {
    return {
      providerStatus: null,
      providerErrorMessage: null,
    };
  }

  return {
    providerStatus: body.error?.status || body.status || null,
    providerErrorMessage:
      body.error?.message || body.error_message || body.message || null,
  };
}

async function fetchJson(url, options = {}, operationName = "unknown_google_api") {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      `Google Maps request failed with ${response.status} ${response.statusText}`,
    );
    error.status = response.status;
    error.body = body;
    error.operationName = operationName;
    const providerError = getProviderErrorDetails(body);
    error.providerStatus = providerError.providerStatus;
    error.providerErrorMessage = providerError.providerErrorMessage;
    throw error;
  }

  return body;
}

function makeHeaders(apiKey, fieldMask) {
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
  };

  if (fieldMask) {
    headers["X-Goog-FieldMask"] = fieldMask;
  }

  return headers;
}

export function createGoogleMapsClient({ apiKey, languageCode = "pl" }) {
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required for enrichment.");
  }

  return {
    async geocodeAddress({ query, city }) {
      const params = new URLSearchParams({
        address: query,
        components: `country:PL|locality:${city}`,
        language: languageCode,
        key: apiKey,
      });

      const body = await fetchJson(
        `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
        {},
        "geocode",
      );

      return body;
    },

    async getCurrentWeather({ latitude, longitude }) {
      const query = new URLSearchParams({
        unitsSystem: "METRIC",
        languageCode,
        key: apiKey,
      });
      const body = await fetchJson(
        `https://weather.googleapis.com/v1/currentConditions:lookup?${buildLatLngQuery(
          latitude,
          longitude,
        )}&${query.toString()}`,
        {},
        "weather_current_conditions",
      );
      return body;
    },

    async getHourlyForecast({ latitude, longitude, hours = 12 }) {
      const query = new URLSearchParams({
        unitsSystem: "METRIC",
        languageCode,
        pageSize: String(Math.min(hours, 24)),
        key: apiKey,
      });
      const body = await fetchJson(
        `https://weather.googleapis.com/v1/forecast/hours:lookup?${buildLatLngQuery(
          latitude,
          longitude,
        )}&${query.toString()}`,
        {},
        "weather_hourly_forecast",
      );
      return body;
    },

    async getCurrentAirQuality({ latitude, longitude }) {
      return fetchJson(
        "https://airquality.googleapis.com/v1/currentConditions:lookup",
        {
          method: "POST",
          headers: makeHeaders(apiKey),
          body: JSON.stringify({
            location: {
              latitude,
              longitude,
            },
            languageCode,
            universalAqi: true,
            extraComputations: [
              "LOCAL_AQI",
              "DOMINANT_POLLUTANT_CONCENTRATION",
              "HEALTH_RECOMMENDATIONS",
            ],
          }),
        },
        "air_quality_current_conditions",
      );
    },

    async getBuildingInsights({ latitude, longitude }) {
      const query = new URLSearchParams({
        "location.latitude": String(latitude),
        "location.longitude": String(longitude),
        requiredQuality: "BASE",
        key: apiKey,
      });
      return fetchJson(
        `https://solar.googleapis.com/v1/buildingInsights:findClosest?${query.toString()}`,
        {},
        "solar_building_insights",
      );
    },

    async searchNearbyPlaces({
      includedTypes,
      latitude,
      longitude,
      radiusMeters = 5000,
      maxResultCount = 8,
    }) {
      return fetchJson(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: makeHeaders(
            apiKey,
            "places.id,places.name,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types",
          ),
          body: JSON.stringify({
            includedTypes,
            languageCode,
            maxResultCount,
            rankPreference: "DISTANCE",
            locationRestriction: {
              circle: {
                center: {
                  latitude,
                  longitude,
                },
                radius: radiusMeters,
              },
            },
          }),
        },
        "places_search_nearby",
      );
    },

    async computeWalkingMatrix({ origin, destinations }) {
      if (!destinations.length) {
        return [];
      }

      return fetchJson(
        "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
        {
          method: "POST",
          headers: makeHeaders(
            apiKey,
            "originIndex,destinationIndex,duration,distanceMeters,condition,status",
          ),
          body: JSON.stringify({
            origins: [
              {
                waypoint: {
                  location: {
                    latLng: {
                      latitude: origin.latitude,
                      longitude: origin.longitude,
                    },
                  },
                },
              },
            ],
            destinations: destinations.map((destination) => ({
              waypoint: {
                location: {
                  latLng: {
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                  },
                },
              },
            })),
            travelMode: "WALK",
            languageCode,
          }),
        },
        "routes_walking_matrix",
      );
    },
  };
}
