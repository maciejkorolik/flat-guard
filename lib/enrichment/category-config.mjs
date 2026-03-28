const STATIC_PROXIMITY_CATEGORY_CONFIG = [
  {
    key: "park",
    label: "Park",
    source: "static",
    confidence: "high",
    searchMethod: "nearby_search",
    includedTypes: ["park"],
    radiusMeters: 2500,
    maxResultCount: 8,
  },
  {
    key: "gym",
    label: "Gym",
    source: "static",
    confidence: "high",
    searchMethod: "nearby_search",
    includedTypes: ["gym", "fitness_center"],
    radiusMeters: 5000,
    maxResultCount: 8,
  },
  {
    key: "grocery",
    label: "Grocery store",
    source: "static",
    confidence: "high",
    searchMethod: "nearby_search",
    includedTypes: [
      "grocery_store",
      "supermarket",
      "convenience_store",
      "discount_store",
      "discount_supermarket",
    ],
    allowedBrandNames: ["Biedronka", "Lidl", "Żabka", "Zabka"],
    radiusMeters: 5000,
    maxResultCount: 8,
  },
];

export function getBaselineCategories() {
  return STATIC_PROXIMITY_CATEGORY_CONFIG.map((category) => {
    const cloned = {
      ...category,
      includedTypes: [...category.includedTypes],
    };
    if (category.allowedBrandNames) {
      cloned.allowedBrandNames = [...category.allowedBrandNames];
    }
    return cloned;
  });
}

export function resolveRequestedCategories() {
  return getBaselineCategories();
}
