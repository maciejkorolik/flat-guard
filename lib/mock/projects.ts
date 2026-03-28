// TODO: replace with Supabase query: supabase.from('projects').select('*').eq('user_id', userId)

import { Project } from "@/lib/types/flatguard";

export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Warsaw flat hunt - spring 2025",
    city: "Warsaw",
    country: "Poland",
    status: "shortlist",
    aiMatched: true,
    budgetMonthly: 1800,
    minRooms: 3,
    savedListings: 14,
    description: "Target districts: Śródmieście, Mokotów, Wola. Focused on modern developments with high energy efficiency.",
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "proj-2",
    name: "European Quarter - Q3 Relocation",
    city: "Brussels",
    country: "Belgium",
    status: "search",
    aiMatched: false,
    budgetMonthly: 2400,
    minRooms: 2,
    savedListings: 8,
    description: "Focusing on Etterbeek and Ixelles. Proximity to EU institutions and Parc du Cinquantenaire is a priority.",
    imageUrl: "https://images.unsplash.com/photo-1491557345352-5929e343eb89?w=800&q=80",
    lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function getProject(id: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === id);
}
