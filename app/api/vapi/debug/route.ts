import { NextResponse } from "next/server";
import { callsRepo } from "@/lib/vapi/store";

export async function GET() {
  const calls = callsRepo.findAll();

  process.stdout.write("\n" + "═".repeat(60) + "\n");
  process.stdout.write("[VAPI debug] Current in-memory state\n");
  process.stdout.write(`  callsStore: ${calls.length} record(s)\n`);
  process.stdout.write(JSON.stringify(calls, null, 2) + "\n");
  process.stdout.write("═".repeat(60) + "\n");

  return NextResponse.json({ calls });
}
