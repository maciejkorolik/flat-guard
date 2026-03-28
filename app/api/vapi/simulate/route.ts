import { NextResponse } from "next/server";
import type { MissingInfoSpec } from "@/lib/vapi/types";

// Fires mock Vapi webhook payloads to our own endpoints so you can test
// the full flow without a real Vapi account or phone number.
export async function POST(req: Request) {
  const body: { spec?: MissingInfoSpec; callId?: string } = await req.json().catch(() => ({}));

  const callId = body.callId ?? `sim-${Date.now()}`;
  const listingId = body.spec?.listing?.id ?? "flat_sim";

  const baseUrl = req.headers.get("origin") ?? "http://localhost:3000";

  // 1. Fire mock tool call (submit_flat_followup_result)
  const toolCallPayload = {
    message: {
      type: "tool-calls",
      call: { id: callId },
      toolCallList: [
        {
          id: `tc-${Date.now()}`,
          function: {
            name: "submit_flat_followup_result",
            arguments: {
              listingId,
              answers: {
                rent_eur: 1350,
                deposit_eur: 2700,
                available_from: "2026-06-01",
                pets_allowed: null,
              },
              unanswered: {
                pets_allowed: { reason: "unknown", notes: "Contact said 'it depends on the landlord'" },
              },
              extra: {
                callbackPreference: null,
                contactMentioned: "Can also send docs by email",
              },
              outcome: "partial",
              transcriptBestEffort:
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
            },
          },
        },
      ],
    },
  };

  const toolCallResp = await fetch(`${baseUrl}/api/vapi/tool-calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toolCallPayload),
  });

  const toolCallResult = await toolCallResp.json();

  // 2. Fire mock end-of-call-report
  const eventPayload = {
    message: {
      type: "end-of-call-report",
      call: {
        id: callId,
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

  return NextResponse.json({
    callId,
    toolCall: toolCallResult,
    event: eventResult,
  });
}
