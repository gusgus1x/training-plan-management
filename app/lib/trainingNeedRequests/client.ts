"use client";

import type { ReviewerCandidate } from "../trainingRecord/types";
import type {
  BulkNeedRequestInput,
  CreateNeedRequestInput,
  NeedRequestListFilters,
  NeedRequestRecord,
  NeedRequestView,
  UpdateNeedRequestInput,
} from "./types";

const parseApiResponse = async <T>(response: Response): Promise<T> => {
  let json: { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
  try {
    json = await response.json();
  } catch {
    throw new Error(
      response.status === 401
        ? "Authentication required"
        : `Request failed with status ${response.status}`,
    );
  }

  if (!response.ok || !json.ok) {
    throw new Error(json.error?.message ?? "An unexpected error occurred");
  }
  return json.data as T;
};

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listNeedRequests = async (
  filters: Partial<Pick<NeedRequestListFilters, "status" | "employeeUserId">> & { view?: NeedRequestView } = {},
) => {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.employeeUserId) params.set("employeeUserId", filters.employeeUserId);
  if (filters.view) params.set("view", filters.view);

  const response = await fetch(`/api/training-plan/need-requests?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ needRequests: NeedRequestRecord[] }>(response);
};

export const createNeedRequest = async (input: CreateNeedRequestInput) => {
  const response = await fetch("/api/training-plan/need-requests", jsonInit("POST", input));
  return parseApiResponse<{ needRequest: NeedRequestRecord }>(response);
};

export const updateNeedRequest = async (
  id: string,
  input: Pick<UpdateNeedRequestInput, "action"> & Partial<Omit<UpdateNeedRequestInput, "action">>,
) => {
  const response = await fetch(
    `/api/training-plan/need-requests/${id}`,
    jsonInit("PUT", { note: null, planId: null, ...input }),
  );
  return parseApiResponse<{ needRequest: NeedRequestRecord }>(response);
};

export const bulkDecideNeedRequests = async (input: BulkNeedRequestInput) => {
  const response = await fetch("/api/training-plan/need-requests", jsonInit("PUT", input));
  return parseApiResponse<{ needRequests: NeedRequestRecord[] }>(response);
};

/** Section heads the signed-in employee can name as their approver. */
export const searchNeedRequestApprovers = async (search: string) => {
  const response = await fetch(
    `/api/training-plan/need-requests/approvers?search=${encodeURIComponent(search)}`,
    { credentials: "include", cache: "no-store" },
  );
  return parseApiResponse<{ candidates: ReviewerCandidate[] }>(response);
};
