import type { FollowupResultRecord } from "./types";

// Shared in-memory store for POC — one Map per process, persists across hot-reloads in dev.
// Replace with a real DB before going to production.

export type TranscriptRecord = {
  callId: string;
  transcript: string | null;
  recordingUrl: string | null;
  receivedAt: string;
};

export const followupStore = new Map<string, FollowupResultRecord>();
export const transcriptStore = new Map<string, TranscriptRecord>();

// ─── Seeded mock data ──────────────────────────────────────────────────────────

const MOCK_CALL_ID = "mock-call-001";

followupStore.set(MOCK_CALL_ID, {
  id: "rec-001",
  createdAt: "2026-03-28T10:00:00.000Z",
  listingId: "flat_123",
  callId: MOCK_CALL_ID,
  answers: {
    rent_eur: 1450,
    deposit_eur: 2900,
    available_from: "2026-05-01",
    pets_allowed: false,
  },
  unanswered: {},
  extra: {
    callbackPreference: null,
  },
  outcome: "completed",
  transcript: null,
  transcriptBestEffort:
    "Me: Hi — is this the person handling the rental listing on Musterstrasse 10?\n" +
    "Them: Yes, that's me, Alex.\n" +
    "Me: Great! I'm interested in the flat. What's the monthly rent, warm if possible?\n" +
    "Them: It's 1450 euros warm.\n" +
    "Me: And what's the deposit?\n" +
    "Them: Two months rent, so 2900.\n" +
    "Me: When is it available from?\n" +
    "Them: From the first of May.\n" +
    "Me: Are pets allowed?\n" +
    "Them: No, unfortunately not.\n" +
    "Me: Got it, thank you so much for your time!",
  recordingUrl: null,
});

transcriptStore.set(MOCK_CALL_ID, {
  callId: MOCK_CALL_ID,
  transcript:
    "Me: Hi — is this the person handling the rental listing on Musterstrasse 10?\n" +
    "Them: Yes, that's me, Alex.\n" +
    "Me: Great! I'm interested in the flat. What's the monthly rent, warm if possible?\n" +
    "Them: It's 1450 euros warm.\n" +
    "Me: And what's the deposit?\n" +
    "Them: Two months rent, so 2900.\n" +
    "Me: When is it available from?\n" +
    "Them: From the first of May.\n" +
    "Me: Are pets allowed?\n" +
    "Them: No, unfortunately not.\n" +
    "Me: Got it, thank you so much for your time!",
  recordingUrl: null,
  receivedAt: "2026-03-28T10:05:00.000Z",
});
