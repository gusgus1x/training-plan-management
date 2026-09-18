import type {
  CreateRecordRequestInput,
  RecordRequestApproverCandidate,
  RecordRequestDecisionInput,
  TrainingRecordRequestRecord,
} from "./types";

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

const parseEnvelope = async <T>(response: Response): Promise<T> => {
  const json = (await response.json()) as Envelope<T>;
  if (!response.ok || !json || !("ok" in json) || !json.ok) {
    const message = (!json.ok && json.error?.message) || "Request failed";
    throw new Error(message);
  }
  return json.data;
};

export const searchRecordRequestApprovers = async (): Promise<{
  candidates: RecordRequestApproverCandidate[];
}> => {
  const res = await fetch("/api/training-record/record-requests/approvers", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseEnvelope<{ candidates: RecordRequestApproverCandidate[] }>(res);
};

export const listRecordRequests = async (): Promise<{
  myRequests: TrainingRecordRequestRecord[];
  pendingApprovals: TrainingRecordRequestRecord[];
}> => {
  const res = await fetch("/api/training-record/record-requests", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  return parseEnvelope<{
    myRequests: TrainingRecordRequestRecord[];
    pendingApprovals: TrainingRecordRequestRecord[];
  }>(res);
};

export const createRecordRequest = async (
  input: CreateRecordRequestInput,
): Promise<{ request: TrainingRecordRequestRecord }> => {
  const res = await fetch("/api/training-record/record-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  return parseEnvelope<{ request: TrainingRecordRequestRecord }>(res);
};

export const decideRecordRequest = async (
  requestId: string,
  input: RecordRequestDecisionInput,
): Promise<{ request: TrainingRecordRequestRecord }> => {
  const res = await fetch(`/api/training-record/record-requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  return parseEnvelope<{ request: TrainingRecordRequestRecord }>(res);
};
