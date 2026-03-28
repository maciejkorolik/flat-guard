import type { CallRecord } from "./types";

// In-memory store for POC — replace with a real DB before production.
// callsRepo interface is designed to be DB-ready (upsert by callId).

export const callsStore = new Map<string, CallRecord>();

export const callsRepo = {
  create(record: CallRecord): void {
    // Idempotent: don't overwrite an existing record
    if (!callsStore.has(record.callId)) {
      callsStore.set(record.callId, record);
    }
  },

  update(callId: string, patch: Partial<Omit<CallRecord, "callId" | "createdAt">>): void {
    const existing = callsStore.get(callId);
    if (!existing) {
      console.warn(`[callsRepo] update: no record found for callId=${callId}`);
      return;
    }
    callsStore.set(callId, {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },

  findById(callId: string): CallRecord | undefined {
    return callsStore.get(callId);
  },

  findAll(): CallRecord[] {
    return Array.from(callsStore.values());
  },
};

// ─── Seeded mock data ──────────────────────────────────────────────────────────

const MOCK_CALL_ID = "mock-call-001";

callsStore.set(MOCK_CALL_ID, {
  callId: MOCK_CALL_ID,
  listingId: "flat_123",
  missingInfoSpec: {
    listing: {
      id: "flat_123",
      address: "Musterstrasse 10, Berlin",
      url: "https://example.com/ad/123",
      city: "Berlin",
    },
    contact: { name: "Alex", source: "agent" },
    missing: [
      {
        key: "rent_eur",
        question: "What's the monthly rent in euros, warm if possible?",
        type: "number",
        required: true,
      },
      { key: "deposit_eur", question: "What's the deposit?", type: "number" },
      {
        key: "available_from",
        question: "When is it available from?",
        type: "string",
        required: true,
      },
      { key: "pets_allowed", question: "Are pets allowed?", type: "boolean" },
    ],
    style: { language: "en", politeness: "neutral" },
  },
  status: "completed",
  endedReason: "customer-ended-call",
  transcript:
    "Me: Hi — is this the person handling the rental listing on Musterstrasse 10?\n" +
    "Them: Yes, that's me, Alex.\n" +
    "Me: Great! What's the monthly rent, warm if possible?\n" +
    "Them: It's 1450 euros warm.\n" +
    "Me: And the deposit?\n" +
    "Them: Two months rent, so 2900.\n" +
    "Me: When is it available from?\n" +
    "Them: From the first of May.\n" +
    "Me: Are pets allowed?\n" +
    "Them: No, unfortunately not.\n" +
    "Me: Got it, thank you so much for your time!",
  recordingUrl: null,
  rawCall: null,
  createdAt: "2026-03-28T10:00:00.000Z",
  updatedAt: "2026-03-28T10:05:00.000Z",
});
