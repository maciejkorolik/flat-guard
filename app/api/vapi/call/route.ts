import { NextResponse } from "next/server";
import type { InitiateCallRequest, InitiateCallResponse } from "@/lib/vapi/types";

const VAPI_API_URL = "https://api.vapi.ai/call";

export async function POST(req: Request) {
  const body: InitiateCallRequest = await req.json();

  const vapiPrivateKey = process.env.VAPI_PRIVATE_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

  if (!vapiPrivateKey || !assistantId || !phoneNumberId) {
    return NextResponse.json(
      { error: "Missing Vapi configuration. Set VAPI_PRIVATE_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID in .env.local" },
      { status: 500 }
    );
  }

  const { phoneNumber, missingInfoSpec } = body;

  if (!phoneNumber || !missingInfoSpec) {
    return NextResponse.json(
      { error: "phoneNumber and missingInfoSpec are required" },
      { status: 400 }
    );
  }

  const vapiResp = await fetch(VAPI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vapiPrivateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: phoneNumber },
      assistantOverrides: {
        variableValues: {
          missingInfoSpec: JSON.stringify(missingInfoSpec),
        },
      },
    }),
  });

  if (!vapiResp.ok) {
    const err = await vapiResp.text();
    console.error("[vapi/call] Vapi API error:", err);
    return NextResponse.json(
      { error: "Vapi API error", details: err },
      { status: vapiResp.status }
    );
  }

  const call = await vapiResp.json();

  const response: InitiateCallResponse = {
    callId: call.id,
    status: call.status ?? "queued",
  };

  return NextResponse.json(response);
}
