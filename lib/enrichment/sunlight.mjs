const POSITIVE_SUNLIGHT_TERMS = [
  /słoneczn/i,
  /sloneczn/i,
  /jasn/i,
  /doświetlon/i,
  /doswietlon/i,
  /nasłoneczn/i,
  /nasloneczn/i,
  /dużo światła/i,
  /duzo swiatla/i,
];

const NEGATIVE_SUNLIGHT_TERMS = [
  /ciemn/i,
  /zacienion/i,
  /niedoświetlon/i,
  /niedoswietlon/i,
  /północn/i,
  /polnocn/i,
];

const ORIENTATION_PATTERNS = [
  { regex: /(południowo[- ]?zachodn|poludniowo[- ]?zachodn|south[- ]?west)/i, label: "southwest" },
  { regex: /(południowo[- ]?wschodn|poludniowo[- ]?wschodn|south[- ]?east)/i, label: "southeast" },
  { regex: /(północno[- ]?zachodn|polnocno[- ]?zachodn|north[- ]?west)/i, label: "northwest" },
  { regex: /(północno[- ]?wschodn|polnocno[- ]?wschodn|north[- ]?east)/i, label: "northeast" },
  { regex: /(południow|poludniow|south)/i, label: "south" },
  { regex: /(zachodn|west)/i, label: "west" },
  { regex: /(wschodn|east)/i, label: "east" },
  { regex: /(północn|polnocn|north)/i, label: "north" },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantileMedian(values = []) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric[Math.floor(numeric.length / 2)];
}

function scoreFromSunshineHours(hours) {
  if (!Number.isFinite(hours)) return null;
  return clamp(Math.round(hours / 20), 0, 100);
}

function normalizeCompassLabel(angle) {
  if (!Number.isFinite(angle)) return null;
  const normalized = ((angle % 360) + 360) % 360;
  const labels = [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ];
  return labels[Math.round(normalized / 45) % labels.length];
}

function extractTextEvidence(text) {
  const input = String(text || "");
  const positiveMatches = POSITIVE_SUNLIGHT_TERMS.filter((pattern) =>
    pattern.test(input),
  ).length;
  const negativeMatches = NEGATIVE_SUNLIGHT_TERMS.filter((pattern) =>
    pattern.test(input),
  ).length;
  const explicitOrientation = ORIENTATION_PATTERNS.find((pattern) =>
    pattern.regex.test(input),
  )?.label;

  return {
    positiveMatches,
    negativeMatches,
    explicitOrientation: explicitOrientation || null,
  };
}

function getSolarPotential(buildingInsights) {
  if (!buildingInsights || typeof buildingInsights !== "object") return null;
  return buildingInsights.solarPotential || null;
}

function getWholeRoofStats(solarPotential) {
  if (!solarPotential || typeof solarPotential !== "object") return null;
  return solarPotential.wholeRoofStats || solarPotential.whole_roof_stats || null;
}

function getRoofSegmentStats(solarPotential) {
  if (!solarPotential || typeof solarPotential !== "object") return [];
  const segmentStats =
    solarPotential.roofSegmentStats || solarPotential.roof_segment_stats || [];
  return Array.isArray(segmentStats) ? segmentStats : [];
}

function getSegmentSunshineQuantiles(segment) {
  const direct = segment?.sunshineQuantiles;
  if (Array.isArray(direct)) return direct;
  const nested = segment?.stats?.sunshineQuantiles;
  if (Array.isArray(nested)) return nested;
  const rpcNested = segment?.stats?.sunshine_quantiles;
  return Array.isArray(rpcNested) ? rpcNested : [];
}

function getSegmentAzimuth(segment) {
  return (
    segment?.azimuthDegrees ??
    segment?.azimuth_degrees ??
    segment?.center?.azimuthDegrees ??
    null
  );
}

function pickBestRoofOrientation(solarPotential) {
  const segments = getRoofSegmentStats(solarPotential);
  let bestSegment = null;
  let bestScore = -1;

  for (const segment of segments) {
    const median = quantileMedian(getSegmentSunshineQuantiles(segment));
    if (!Number.isFinite(median)) continue;
    if (median > bestScore) {
      bestScore = median;
      bestSegment = segment;
    }
  }

  if (!bestSegment) return null;
  return normalizeCompassLabel(getSegmentAzimuth(bestSegment));
}

export function summarizeSunlightEstimate({
  buildingInsights,
  listing,
  geocodeResult,
}) {
  const description = [
    listing?.descriptionRaw,
    listing?.listingTitle,
    listing?.rawDetailPayload?.product_jsonld?.description,
  ]
    .filter(Boolean)
    .join(" ");

  const textEvidence = extractTextEvidence(description);
  const solarPotential = getSolarPotential(buildingInsights);
  const wholeRoofStats = getWholeRoofStats(solarPotential);
  const sunshineQuantiles =
    wholeRoofStats?.sunshineQuantiles ||
    wholeRoofStats?.sunshine_quantiles ||
    [];
  const medianSunshineHours = quantileMedian(sunshineQuantiles);
  const maxSunshineHours =
    solarPotential?.maxSunshineHoursPerYear ??
    solarPotential?.max_sunshine_hours_per_year ??
    null;

  if (!Number.isFinite(medianSunshineHours) && !Number.isFinite(maxSunshineHours)) {
    return {
      status: "skipped",
      score: null,
      confidence: null,
      estimatedOrientationHint: textEvidence.explicitOrientation,
      reasons: [
        "No solar roof summary was available for the geocoded point.",
      ],
      payload: {
        evidenceSource: textEvidence.explicitOrientation ? "listing_text" : null,
      },
    };
  }

  const baseScore = scoreFromSunshineHours(
    medianSunshineHours ?? maxSunshineHours,
  );
  let score = baseScore ?? 50;

  if (textEvidence.positiveMatches > 0) {
    score += Math.min(12, textEvidence.positiveMatches * 6);
  }

  if (textEvidence.negativeMatches > 0) {
    score -= Math.min(14, textEvidence.negativeMatches * 7);
  }

  score = clamp(score, 0, 100);

  const roofOrientationHint = pickBestRoofOrientation(solarPotential);
  const estimatedOrientationHint =
    textEvidence.explicitOrientation || roofOrientationHint || null;

  let confidence = "low";
  if (
    estimatedOrientationHint &&
    textEvidence.explicitOrientation &&
    geocodeResult?.status === "succeeded" &&
    !geocodeResult?.partialMatch
  ) {
    confidence = "high";
  } else if (
    geocodeResult?.status === "succeeded" &&
    !geocodeResult?.partialMatch &&
    Number.isFinite(medianSunshineHours ?? maxSunshineHours)
  ) {
    confidence = "medium";
  }

  const reasons = [];
  if (Number.isFinite(medianSunshineHours)) {
    reasons.push(
      `Median roof sunshine estimate near this address is about ${Math.round(
        medianSunshineHours,
      )} annual sun-hours equivalent.`,
    );
  } else if (Number.isFinite(maxSunshineHours)) {
    reasons.push(
      `Peak roof sunshine estimate near this address is about ${Math.round(
        maxSunshineHours,
      )} annual sun-hours equivalent.`,
    );
  }

  if (textEvidence.positiveMatches > 0) {
    reasons.push(
      "The listing text explicitly suggests bright or sunny exposure.",
    );
  }

  if (textEvidence.negativeMatches > 0) {
    reasons.push(
      "The listing text also includes wording associated with lower daylight exposure.",
    );
  }

  if (textEvidence.explicitOrientation) {
    reasons.push(
      `Orientation hint comes from the listing text: ${textEvidence.explicitOrientation}.`,
    );
  } else if (roofOrientationHint) {
    reasons.push(
      `Best roof-level solar orientation near the geocoded point points roughly ${roofOrientationHint}.`,
    );
    reasons.push(
      "This is a building-level proxy and not a verified flat orientation.",
    );
  }

  return {
    status: "succeeded",
    score,
    confidence,
    estimatedOrientationHint,
    reasons,
    payload: {
      medianSunshineHours,
      maxSunshineHours,
      explicitOrientation: textEvidence.explicitOrientation,
      roofOrientationHint,
      positiveTextMatches: textEvidence.positiveMatches,
      negativeTextMatches: textEvidence.negativeMatches,
    },
  };
}
