"use client";

import { useState, useCallback } from "react";
import type { MissingInfoSpec, InitiateCallResponse, CallRecord } from "@/lib/vapi/types";

const EXAMPLE_SPEC: MissingInfoSpec = {
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
};

type CallState = "idle" | "calling" | "done" | "error";
type SimState = "idle" | "running" | "done" | "error";

export default function VapiPocPage() {
  const [phoneNumber, setPhoneNumber] = useState("+49");
  const [listingId, setListingId] = useState(EXAMPLE_SPEC.listing.id);
  const [specJson, setSpecJson] = useState(JSON.stringify(EXAMPLE_SPEC, null, 2));
  const [callState, setCallState] = useState<CallState>("idle");
  const [callResult, setCallResult] = useState<InitiateCallResponse | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const [simState, setSimState] = useState<SimState>("idle");
  const [simCallId, setSimCallId] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  async function handleCall() {
    setCallState("calling");
    setCallError(null);
    setCallResult(null);

    let spec: MissingInfoSpec;
    try {
      spec = JSON.parse(specJson);
    } catch {
      setCallError("Invalid JSON in spec");
      setCallState("error");
      return;
    }

    try {
      const resp = await fetch("/api/vapi/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, listingId, missingInfoSpec: spec }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setCallError(data.error ?? "Unknown error");
        setCallState("error");
        return;
      }
      setCallResult(data);
      setCallState("done");
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Network error");
      setCallState("error");
    }
  }

  async function handleSimulate() {
    setSimState("running");
    setSimError(null);
    setSimCallId(null);

    let spec: MissingInfoSpec | undefined;
    try {
      spec = JSON.parse(specJson);
    } catch {
      spec = undefined;
    }

    try {
      const resp = await fetch("/api/vapi/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, listingId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSimError(data.error ?? "Simulation failed");
        setSimState("error");
        return;
      }
      setSimCallId(data.callId);
      setSimState("done");
    } catch (e) {
      setSimError(e instanceof Error ? e.message : "Network error");
      setSimState("error");
    }
  }

  const handleDebug = useCallback(async () => {
    setDebugLoading(true);
    try {
      const resp = await fetch("/api/vapi/debug");
      const data = await resp.json();
      setCalls(data.calls ?? []);
    } finally {
      setDebugLoading(false);
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Vapi Outbound Caller — POC</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test outbound calling to landlords/agents. Results arrive via{" "}
          <code className="font-mono">end-of-call-report</code> webhook only — no tool calls.
        </p>
      </div>

      {/* Simulate section */}
      <section className="rounded-lg border p-5 space-y-3">
        <div>
          <h2 className="font-medium">Simulate end-of-call-report (no real call needed)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seeds a call record then fires a mock{" "}
            <code className="font-mono">end-of-call-report</code> to{" "}
            <code className="font-mono">/api/vapi/events</code>. Check the terminal for logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulate}
            disabled={simState === "running"}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {simState === "running" ? "Simulating..." : "Simulate call result"}
          </button>
          {simState === "done" && simCallId && (
            <span className="text-xs text-green-700 dark:text-green-400 font-mono">
              callId: {simCallId}
            </span>
          )}
          {simState === "error" && simError && (
            <span className="text-xs text-red-600 dark:text-red-400">{simError}</span>
          )}
        </div>
      </section>

      {/* Debug panel */}
      <section className="rounded-lg border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">In-memory call store</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              All call records (created on initiation, updated on end-of-call-report).
            </p>
          </div>
          <button
            onClick={handleDebug}
            disabled={debugLoading}
            className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {debugLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {calls !== null && (
          <div className="space-y-4">
            {calls.length === 0 ? (
              <p className="text-xs text-muted-foreground">No records yet.</p>
            ) : (
              calls.map((record) => (
                <div
                  key={record.callId}
                  className="rounded-md border text-xs font-mono overflow-x-auto"
                >
                  <div className="bg-muted/50 px-3 py-1.5 flex items-center justify-between">
                    <span className="font-medium">
                      callId: {record.callId} · listingId: {record.listingId}
                    </span>
                    <span
                      className={
                        record.status === "completed"
                          ? "text-green-700 dark:text-green-400"
                          : record.status === "failed" || record.status === "no-answer"
                          ? "text-red-600 dark:text-red-400"
                          : "text-yellow-700 dark:text-yellow-400"
                      }
                    >
                      {record.status}
                    </span>
                  </div>
                  <pre className="px-3 py-2 text-[11px] leading-relaxed overflow-x-auto">
                    {JSON.stringify(record, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Real call section */}
      <section className="rounded-lg border p-5 space-y-4">
        <div>
          <h2 className="font-medium">Initiate real outbound call</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Requires <code className="font-mono">VAPI_PRIVATE_KEY</code>,{" "}
            <code className="font-mono">VAPI_ASSISTANT_ID</code>, and{" "}
            <code className="font-mono">VAPI_PHONE_NUMBER_ID</code> in{" "}
            <code className="font-mono">.env.local</code>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="phone">
              Phone number (E.164)
            </label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+49123456789"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="listingId">
              Listing ID
            </label>
            <input
              id="listingId"
              type="text"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              placeholder="flat_123"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="spec">
            missingInfoSpec (JSON)
          </label>
          <textarea
            id="spec"
            value={specJson}
            onChange={(e) => setSpecJson(e.target.value)}
            rows={18}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
          />
        </div>

        <button
          onClick={handleCall}
          disabled={callState === "calling"}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {callState === "calling" ? "Calling..." : "Initiate Call"}
        </button>

        {callState === "done" && callResult && (
          <div className="rounded-md border border-green-500 bg-green-50 dark:bg-green-950 p-3 text-sm space-y-1">
            <p className="font-medium text-green-800 dark:text-green-200">Call queued</p>
            <p className="font-mono text-xs">callId: {callResult.callId}</p>
            <p className="text-xs text-muted-foreground">Status: {callResult.status}</p>
          </div>
        )}

        {callState === "error" && callError && (
          <div className="rounded-md border border-red-500 bg-red-50 dark:bg-red-950 p-3 text-sm">
            <p className="font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="font-mono text-xs mt-1">{callError}</p>
          </div>
        )}
      </section>

      <section className="text-xs text-muted-foreground space-y-1 border-t pt-4">
        <p className="font-medium">Webhook endpoint (configure in Vapi dashboard):</p>
        <ul className="list-disc list-inside space-y-0.5 font-mono">
          <li>{"{YOUR_BASE_URL}"}/api/vapi/events</li>
        </ul>
        <p className="mt-2">
          Event type handled: <span className="font-mono">end-of-call-report</span>
        </p>
      </section>
    </div>
  );
}
