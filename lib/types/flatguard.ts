export type ProjectStatus = "shortlist" | "search" | "interview";

export interface Project {
  id: string;
  name: string;
  city: string;
  country: string;
  status: ProjectStatus;
  aiMatched: boolean;
  budgetMonthly: number;
  minRooms: number;
  savedListings: number;
  description: string;
  imageUrl: string;
  lastActiveAt: string; // ISO string
  // TODO: connect to DB - projects table, userId FK
}

export interface SearchProfile {
  id: string;
  projectId: string;
  version: number;
  city: string;
  budgetMonthly: number;
  minAreaM2: number;
  minRooms: number;
  preferredDistricts: string[];
  petsAllowed: boolean;
  mustHaves: string[];
  dealBreakers: string[];
  // TODO: connect to DB - search_profiles table
}

export interface Listing {
  id: string;
  title: string;
  city: string;
  district: string;
  address: string;
  rentMonthly: number;
  areaM2: number;
  rooms: number;
  floor: string;
  furnished: boolean;
  petsAllowed: boolean | null;
  verifiedAgent: boolean;
  imageUrl: string;
  matchScore: number;
  budgetDelta: number; // negative = below budget, positive = above
  // TODO: connect to DB - listings table
}

export interface ShortlistEntry {
  id: string;
  listing: Listing;
  status: "saved" | "contacted" | "rejected";
  notes: string;
  gaps: number;
  // TODO: connect to DB - shortlist_entries table
}

export interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  timestamp: string;
}

export interface SearchRun {
  id: string;
  runNumber: number;
  profileVersion: number;
  listings: Listing[];
  isLatest: boolean;
}

// ── DB-native types (match Supabase schema) ──────────────────────────────────

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  status: string;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface NormalizedListing {
  id: string;
  source: string;
  external_id: string;
  url: string | null;
  title: string | null;
  description: string | null;
  is_active: boolean;
  city: string | null;
  district: string | null;
  neighbourhood: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  area_m2: number | null;
  rooms: number | null;
  floor: number | null;
  total_floors: number | null;
  building_type: string | null;
  offer_type: string | null;
  rent_pln: number | null;
  deposit_pln: number | null;
  total_monthly_pln: number | null;
  available_from: string | null;
  has_balcony: boolean | null;
  has_terrace: boolean | null;
  has_elevator: boolean | null;
  has_storage_room: boolean | null;
  is_furnished: boolean | null;
  has_internet: boolean | null;
  heating_type: string | null;
  parking_type: string | null;
  kitchen_equipment: string[] | null;
  extra_features: string[] | null;
  nearby: Record<string, unknown> | null;
}

export interface ScoreBreakdown {
  criterion: string;
  score: number;
  note: string;
}

export interface ScoredListing {
  listing: Pick<NormalizedListing,
    "id" | "title" | "city" | "district" | "address" | "url" |
    "rent_pln" | "total_monthly_pln" | "rooms" | "area_m2" | "floor" |
    "has_balcony" | "has_elevator" | "is_furnished" | "parking_type" |
    "heating_type" | "offer_type" | "extra_features" | "available_from"
  >;
  overallScore: number;
  breakdown: ScoreBreakdown[];
  reasoning: string;
  recommendation: "strong" | "good" | "weak";
}

export interface DbShortlistEntry {
  id: string;
  project_id: string;
  listing_id: string;
  listing_snapshot: ScoredListing | { listing: NormalizedListing };
  status: "saved" | "contacted" | "rejected";
  notes: string | null;
  created_at: string;
}

export interface DbSearchProfile {
  id: string;
  project_id: string;
  version: number;
  preferred_cities: string[] | null;
  preferred_districts: string[] | null;
  preferred_neighbourhoods: string[] | null;
  important_locations: Record<string, unknown>[] | null;
  budget_target_pln: number | null;
  rooms_preferred: number | null;
  area_m2_preferred: number | null;
  availability_preferred: string | null;
  preferred_features: string[] | null;
  disliked_features: string[] | null;
  preferred_offer_type: string | null;
  preferred_heating_types: string[] | null;
  raw_requirements: Record<string, unknown> | null;
  is_current: boolean;
  created_at: string;
}
