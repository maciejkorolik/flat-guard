// TODO: replace with Supabase queries for chat history and search profile

import { ChatMessage, SearchProfile } from "@/lib/types/flatguard";

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
