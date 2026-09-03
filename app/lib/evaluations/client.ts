"use client";

import type { EvaluationListFilters, EvaluationRecord, EvaluationWriteInput } from "./types";

type Fetcher = typeof fetch;
type Envelope<T> = { ok: true; data: T } | { ok: false; error?: { code?: string; message?: string } };

export class EvaluationClientError extends Error {
  constructor(readonly code = "EVALUATION_REQUEST_FAILED", message = "Evaluation request failed") {
    super(message);
    this.name = "EvaluationClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try { body = await response.json() as Envelope<T>; } catch { throw new EvaluationClientError(); }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new EvaluationClientError(error?.code, error?.message);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listEvaluations = async (
  filters: Pick<EvaluationListFilters, "search" | "status" | "timing" | "respondentType"> = {
    search: null, status: null, timing: null, respondentType: null,
  },
  fetcher: Fetcher = fetch,
) => {
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.timing) params.set("timing", filters.timing);
  if (filters.respondentType) params.set("respondentType", filters.respondentType);
  return read<{ items: EvaluationRecord[] }>(await fetcher(`/api/training-course/evaluations?${params}`, { credentials: "include", cache: "no-store" }));
};

export const createEvaluation = async (input: EvaluationWriteInput, fetcher: Fetcher = fetch) =>
  read<{ evaluation: EvaluationRecord }>(await fetcher("/api/training-course/evaluations", json("POST", input)));

export const updateEvaluation = async (evaluationFormId: string, input: EvaluationWriteInput, fetcher: Fetcher = fetch) =>
  read<{ evaluation: EvaluationRecord }>(await fetcher(`/api/training-course/evaluations/${evaluationFormId}`, json("PATCH", input)));

export const setEvaluationStatus = async (evaluationFormId: string, status: EvaluationRecord["status"], fetcher: Fetcher = fetch) =>
  read<{ evaluation: EvaluationRecord }>(await fetcher(`/api/training-course/evaluations/${evaluationFormId}`, json("POST", { status })));

export const deleteEvaluation = async (evaluationFormId: string, fetcher: Fetcher = fetch) =>
  read<{ evaluation: EvaluationRecord; outcome: "DELETED" }>(await fetcher(`/api/training-course/evaluations/${evaluationFormId}`, { method: "DELETE", credentials: "include" }));
