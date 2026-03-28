export type MissingFieldType = "string" | "number" | "boolean";

export type MissingField = {
  key: string;
  question: string;
  type?: MissingFieldType;
  required?: boolean;
  notes?: string;
};

export type MissingInfoSpec = {
  listing: {
    id: string;
    address?: string;
    url?: string;
    city?: string;
  };
  contact?: {
    name?: string;
    source?: "landlord" | "agent" | "unknown";
  };
  missing: MissingField[];
  style?: {
    language?: string;
    politeness?: "casual" | "neutral" | "formal";
  };
};

export type CallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed"
  | "no-answer";

export type CallRecord = {
  callId: string;
  listingId: string;
  missingInfoSpec: MissingInfoSpec;
  status: CallStatus;
  endedReason: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  rawCall: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type InitiateCallRequest = {
  phoneNumber: string;
  listingId: string;
  missingInfoSpec: MissingInfoSpec;
};

export type InitiateCallResponse = {
  callId: string;
  status: string;
};
