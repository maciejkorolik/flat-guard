import test from "node:test";
import assert from "node:assert/strict";
import {
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
