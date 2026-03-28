import { NextResponse } from "next/server";
import type { MissingInfoSpec, CallRecord } from "@/lib/vapi/types";
import { callsRepo } from "@/lib/vapi/store";

// Fires a mock end-of-call-report webhook so you can test the full flow
// without a real Vapi account or phone number.
export async function POST(req: Request) {
  const body: { spec?: MissingInfoSpec; callId?: string; listingId?: string } = await req
    .json()
    .catch(() => ({}));

  const callId = body.callId ?? `sim-${Date.now()}`;
  const listingId = body.listingId ?? body.spec?.listing?.id ?? "flat_sim";
  const now = new Date().toISOString();

  const baseUrl = req.headers.get("origin") ?? "http://localhost:3000";

  // Seed a queued record — mimics what POST /api/vapi/call would create
  const record: CallRecord = {
    callId,
    listingId,
    missingInfoSpec: body.spec ?? { listing: { id: listingId }, missing: [] },
    status: "queued",
    endedReason: null,
    transcript: null,
    recordingUrl: null,
    rawCall: null,
    createdAt: now,
    updatedAt: now,
  };
  callsRepo.create(record);

  // Fire mock end-of-call-report
  const eventPayload = {
    message: {
      type: "end-of-call-report",
      call: {
        id: callId,
        status: "completed",
        endedReason: "customer-ended-call",
        startedAt: new Date(Date.now() - 90_000).toISOString(),
        endedAt: new Date().toISOString(),
        artifact: {
          transcript:
            "Me: Hi — is this the person handling the rental listing?\n" +
            "Them: Yes, hello.\n" +
            "Me: Great, I'm calling about the flat. What's the monthly rent?\n" +
            "Them: 1350 warm.\n" +
            "Me: And the deposit?\n" +
            "Them: Two months, 2700.\n" +
            "Me: When is it available from?\n" +
            "Them: June first.\n" +
            "Me: Are pets allowed?\n" +
            "Them: I'm not sure, depends on the landlord.\n" +
            "Me: Thank you!",
          recordingUrl: null,
        },
      },
    },
  };

  const eventResp = await fetch(`${baseUrl}/api/vapi/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventPayload),
  });

  const eventResult = await eventResp.json();

  return NextResponse.json({ callId, event: eventResult });
}
