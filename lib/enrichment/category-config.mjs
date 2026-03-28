const BASELINE_CATEGORY_CONFIG = [
  {
    key: "park",
    label: "Park",
    source: "baseline",
    confidence: "high",
    textQuery: "park",
    radiusMeters: 2500,
    maxResultCount: 8,
  },
  {
    key: "grocery",
    label: "Grocery store",
    source: "baseline",
    confidence: "high",
    textQuery: "sklep spożywczy",
    radiusMeters: 2500,
    maxResultCount: 8,
  },
  {
    key: "library",
    label: "Library",
    source: "baseline",
    confidence: "high",
    textQuery: "biblioteka",
    radiusMeters: 5000,
    maxResultCount: 8,
  },
];

const CURATED_CATEGORY_CONFIG = {
  gym: {
    key: "gym",
    label: "Gym",
    source: "curated_custom",
    confidence: "high",
    textQuery: "siłownia",
    radiusMeters: 5000,
    maxResultCount: 8,
  },
  climbing: {
    key: "climbing",
    label: "Climbing gym",
    source: "curated_custom",
    confidence: "high",
    textQuery: "ścianka wspinaczkowa",
    radiusMeters: 8000,
    maxResultCount: 8,
  },
};

export function slugifyCategoryKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function getBaselineCategories() {
  return BASELINE_CATEGORY_CONFIG.map((category) => ({ ...category }));
}

export function getCuratedCategoryKeys() {
  return Object.keys(CURATED_CATEGORY_CONFIG);
}

export function resolveRequestedCategories(requestedCategories = []) {
  const merged = new Map();

  for (const category of getBaselineCategories()) {
    merged.set(category.key, category);
  }

  for (const rawCategory of requestedCategories) {
    const value = String(rawCategory || "").trim();
    if (!value) continue;
    const curatedMatch = CURATED_CATEGORY_CONFIG[value.toLowerCase()];
    if (curatedMatch) {
      merged.set(curatedMatch.key, { ...curatedMatch });
      continue;
    }

    const key = slugifyCategoryKey(value);
    if (!key) continue;
    merged.set(key, {
      key,
      label: value,
      source: "free_text_custom",
      confidence: "low",
      textQuery: value,
      radiusMeters: 8000,
      maxResultCount: 8,
    });
  }

  return [...merged.values()];
}
