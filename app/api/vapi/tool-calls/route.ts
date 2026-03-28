import { NextResponse } from "next/server";
import type { FollowupResult } from "@/lib/vapi/types";
import { followupStore } from "@/lib/vapi/store";

function log(label: string, data?: unknown) {
  const separator = "─".repeat(60);
  process.stdout.write(`\n${separator}\n`);
  process.stdout.write(`[VAPI tool-calls] ${label}\n`);
  if (data !== undefined) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }
  process.stdout.write(`${separator}\n`);
}

export async function POST(req: Request) {
  const payload = await req.json();

  log("Incoming payload", payload);

  const toolCalls = payload?.message?.toolCallList ?? [];
  const callId: string | undefined = payload?.message?.call?.id;

  if (toolCalls.length === 0) {
    log("No tool calls in payload — ignoring");
    return NextResponse.json({ results: [] });
  }

  const results = toolCalls.map((tc: {
    id: string;
    function: { name: string; arguments: Record<string, unknown> };
  }) => {
    const toolCallId = tc?.id;
    const name = tc?.function?.name;
    const args = tc?.function?.arguments ?? {};

    log(`Tool called: "${name}"`, { toolCallId, callId, args });

    if (name === "submit_flat_followup_result") {
      const result = args as FollowupResult;

      const record = {
        id: `rec-${Date.now()}`,
        createdAt: new Date().toISOString(),
        listingId: result.listingId,
        callId: callId ?? "unknown",
        answers: result.answers,
        unanswered: result.unanswered,
        extra: result.extra,
        outcome: result.outcome,
        transcript: null,
        transcriptBestEffort: result.transcriptBestEffort,
        recordingUrl: null,
      };

      if (callId) {
        followupStore.set(callId, record);
        log(`Stored result for callId: ${callId}`, {
          outcome: result.outcome,
          answeredFields: Object.keys(result.answers),
          unansweredFields: Object.keys(result.unanswered),
        });
      }

      return { toolCallId, result: { ok: true, callId } };
    }

    log(`Unknown tool: "${name}" — skipping`);
    return { toolCallId, result: { ok: false, error: `Unknown tool: ${name}` } };
  });

  return NextResponse.json({ results });
}
