import { NextResponse } from "next/server";

// Tool-calls webhook is not used in this implementation.
// Vapi is configured without tools; results arrive via end-of-call-report.
export async function POST() {
  return NextResponse.json({ ok: true });
}
