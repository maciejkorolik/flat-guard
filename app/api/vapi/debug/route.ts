import { NextResponse } from "next/server";
import { followupStore, transcriptStore } from "@/lib/vapi/store";

export async function GET() {
  const followups = Object.fromEntries(followupStore.entries());
  const transcripts = Object.fromEntries(transcriptStore.entries());

  process.stdout.write("\n" + "═".repeat(60) + "\n");
  process.stdout.write("[VAPI debug] Current in-memory state\n");
  process.stdout.write(`  followupStore: ${followupStore.size} record(s)\n`);
  process.stdout.write(`  transcriptStore: ${transcriptStore.size} record(s)\n`);
  process.stdout.write(JSON.stringify({ followups, transcripts }, null, 2) + "\n");
  process.stdout.write("═".repeat(60) + "\n");

  return NextResponse.json({ followups, transcripts });
}
