"use client";

import type { AssessmentListFilters, AssessmentRecord, AssessmentWriteInput } from "./types";

type Fetcher = typeof fetch;
type Envelope<T> = { ok: true; data: T } | { ok: false; error?: { code?: string; message?: string } };

export class AssessmentClientError extends Error {
  constructor(readonly code = "ASSESSMENT_REQUEST_FAILED", message = "Assessment request failed") {
    super(message);
    this.name = "AssessmentClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try { body = await response.json() as Envelope<T>; } catch { throw new AssessmentClientError(); }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new AssessmentClientError(error?.code, error?.message);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listAssessments = async (
  filters: Pick<AssessmentListFilters, "search" | "status" | "purpose"> = { search: null, status: null, purpose: null },
  fetcher: Fetcher = fetch,
) => {
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.purpose) params.set("purpose", filters.purpose);
  return read<{ items: AssessmentRecord[] }>(await fetcher(`/api/training-course/assessments?${params}`, { credentials: "include", cache: "no-store" }));
};

export const createAssessment = async (input: AssessmentWriteInput, fetcher: Fetcher = fetch) =>
  read<{ assessment: AssessmentRecord }>(await fetcher("/api/training-course/assessments", json("POST", input)));

export const updateAssessment = async (assessmentId: string, input: AssessmentWriteInput, fetcher: Fetcher = fetch) =>
  read<{ assessment: AssessmentRecord }>(await fetcher(`/api/training-course/assessments/${assessmentId}`, json("PATCH", input)));

export const createAssessmentVersion = async (assessmentId: string, input: AssessmentWriteInput, fetcher: Fetcher = fetch) =>
  read<{ assessment: AssessmentRecord }>(await fetcher(`/api/training-course/assessments/${assessmentId}/versions`, json("POST", input)));

export const deleteAssessment = async (assessmentId: string, fetcher: Fetcher = fetch) =>
  read<{ assessment: AssessmentRecord; outcome: "DELETED" }>(await fetcher(`/api/training-course/assessments/${assessmentId}`, { method: "DELETE", credentials: "include" }));
