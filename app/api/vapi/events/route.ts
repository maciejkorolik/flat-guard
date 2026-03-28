import { NextResponse } from "next/server";
import { callsRepo } from "@/lib/vapi/store";

function log(label: string, data?: unknown) {
  const sep = "─".repeat(60);
  process.stdout.write(`\n${sep}\n[VAPI events] ${label}\n`);
  if (data !== undefined) process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  process.stdout.write(`${sep}\n`);
}

export async function POST(req: Request) {
  const payload = await req.json();
  const msg = payload?.message;
  const type: string = msg?.type ?? "unknown";

  if (type !== "end-of-call-report") {
    log(`Ignored event type: "${type}"`);
    return NextResponse.json({ ok: true });
  }

  const call = msg.call;
  const callId: string | undefined = call?.id;

  if (!callId) {
    log("end-of-call-report missing call.id — ignoring");
    return NextResponse.json({ ok: true });
  }

  const transcript: string | null = call?.artifact?.transcript ?? null;
  const recordingUrl: string | null = call?.artifact?.recordingUrl ?? null;
  const endedReason: string | null = call?.endedReason ?? null;
  const status = call?.status ?? "completed";

  // Idempotent: callsRepo.update merges into the existing record by callId
  callsRepo.update(callId, {
    status,
    endedReason,
    transcript,
    recordingUrl,
    rawCall: call as Record<string, unknown>,
  });

  log(`end-of-call-report processed for callId: ${callId}`, {
    status,
    endedReason,
    hasTranscript: transcript !== null,
    hasRecording: recordingUrl !== null,
  });

  return NextResponse.json({ ok: true });
}
