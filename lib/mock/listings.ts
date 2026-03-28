// TODO: replace with Supabase query: supabase.from('listings').select('*').eq('search_run_id', runId)

import { Listing, SearchRun } from "@/lib/types/flatguard";

const MOCK_LISTINGS: Listing[] = [
  {
    id: "lst-1",
    title: "Ixelles Panoramic Residence",
    city: "Brussels",
    district: "Ixelles",
    address: "Place du Châtelain, Ixelles",
    rentMonthly: 1450,
    areaM2: 78,
    rooms: 2,
    floor: "4th Floor",
    furnished: true,
    petsAllowed: null,
    verifiedAgent: true,
    imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&q=80",
    matchScore: 94,
    budgetDelta: -150,
  },
  {
    id: "lst-2",
    title: "Saint-Gilles Loft Space",
    city: "Brussels",
    district: "Saint-Gilles",
    address: "Rue de l'Hôtel des Monnaies, Saint-Gilles",
    rentMonthly: 1700,
    areaM2: 92,
    rooms: 1,
    floor: "Ground Floor",
    furnished: false,
    petsAllowed: true,
    verifiedAgent: false,
    imageUrl: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=400&q=80",
    matchScore: 82,
    budgetDelta: 0,
  },
  {
    id: "lst-3",
    title: "Etterbeek Garden Flat",
    city: "Brussels",
    district: "Etterbeek",
    address: "Avenue de la Chasse, Etterbeek",
    rentMonthly: 1550,
    areaM2: 65,
    rooms: 2,
    floor: "2nd Floor",
    furnished: true,
    petsAllowed: true,
    verifiedAgent: true,
    imageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400&q=80",
    matchScore: 76,
    budgetDelta: -250,
  },
];

export const MOCK_SEARCH_RUNS: SearchRun[] = [
  {
    id: "run-3",
    runNumber: 3,
    profileVersion: 3,
    listings: MOCK_LISTINGS,
    isLatest: true,
  },
];

export function getSearchRuns(_projectId: string): SearchRun[] {
  // TODO: filter by projectId from DB
  return MOCK_SEARCH_RUNS;
}
