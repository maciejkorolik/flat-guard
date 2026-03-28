import { NextResponse } from "next/server";
import { followupStore, transcriptStore } from "@/lib/vapi/store";

function log(label: string, data?: unknown) {
  const separator = "─".repeat(60);
  process.stdout.write(`\n${separator}\n`);
  process.stdout.write(`[VAPI events] ${label}\n`);
  if (data !== undefined) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }
  process.stdout.write(`${separator}\n`);
}

export async function POST(req: Request) {
  const payload = await req.json();
  const msg = payload?.message;

  log(`Received event type: "${msg?.type ?? "unknown"}"`, payload);

  if (msg?.type === "end-of-call-report") {
    const call = msg.call;
    const callId: string | undefined = call?.id;
    const transcript: string | null = call?.artifact?.transcript ?? null;
    const recordingUrl: string | null = call?.artifact?.recordingUrl ?? null;

    if (callId) {
      transcriptStore.set(callId, {
        callId,
        transcript,
        recordingUrl,
        receivedAt: new Date().toISOString(),
      });

      // Attach transcript to followup record if it already exists
      const existing = followupStore.get(callId);
      if (existing) {
        followupStore.set(callId, { ...existing, transcript, recordingUrl: recordingUrl ?? null });
        log(`Attached transcript to existing followup record for callId: ${callId}`);
      }

      log(`end-of-call-report stored for callId: ${callId}`, {
        hasTranscript: transcript !== null,
        hasRecording: recordingUrl !== null,
        duration: call?.endedAt && call?.startedAt
          ? `${Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)}s`
          : "unknown",
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
