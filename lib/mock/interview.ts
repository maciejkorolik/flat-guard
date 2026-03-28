// TODO: replace with Supabase queries for chat history and search profile

import { ChatMessage, SearchProfile, ShortlistEntry } from "@/lib/types/flatguard";

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "ai",
    content: "Hi! I'm FlatGuard Curator. Let's find your perfect home. Which city are we looking in today?",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-2",
    role: "user",
    content: "Brussels, around €1,500 per month. I need at least 2 bedrooms and pet-friendly.",
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-3",
    role: "ai",
    content: "Great choice! Brussels has excellent rental stock. I've noted €1,500 budget, 2+ bedrooms, and pets. Any preferred districts? Ixelles and Saint-Gilles are popular with expats.",
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
];

export const MOCK_SEARCH_PROFILE: SearchProfile = {
  id: "profile-1",
  projectId: "proj-2",
  version: 3,
  city: "Brussels, Belgium",
  budgetMonthly: 1500,
  minAreaM2: 65,
  minRooms: 2,
  preferredDistricts: ["Saint-Gilles", "Ixelles"],
  petsAllowed: true,
  mustHaves: ["furnished", "natural light"],
  dealBreakers: ["ground floor", "no elevator"],
};

export const MOCK_SHORTLIST: ShortlistEntry[] = [
  {
    id: "sl-1",
    listing: {
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
    status: "contacted",
    notes: "Very promising. Follow up on pet policy.",
    gaps: 1,
  },
  {
    id: "sl-2",
    listing: {
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
    status: "saved",
    notes: "",
    gaps: 2,
  },
];
