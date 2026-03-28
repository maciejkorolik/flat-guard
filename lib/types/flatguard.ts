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
