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

export type UnansweredReason =
  | "refused"
  | "unknown"
  | "no_answer"
  | "wrong_person"
  | "interrupted";

export type FollowupResult = {
  listingId: string;
  answers: Record<string, string | number | boolean | null>;
  unanswered: Record<string, { reason: UnansweredReason; notes?: string }>;
  extra: Record<string, unknown>;
  outcome: "completed" | "partial" | "failed";
  transcriptBestEffort: string;
};

export type FollowupResultRecord = {
  id: string;
  createdAt: string;
  listingId: string;
  callId: string;
  answers: Record<string, string | number | boolean | null>;
  unanswered: Record<string, { reason: string; notes?: string }>;
  extra: Record<string, unknown>;
  outcome: "completed" | "partial" | "failed";
  transcript: string | null;
  transcriptBestEffort: string | null;
  recordingUrl?: string | null;
};

export type InitiateCallRequest = {
  phoneNumber: string;
  missingInfoSpec: MissingInfoSpec;
};

export type InitiateCallResponse = {
  callId: string;
  status: string;
};
