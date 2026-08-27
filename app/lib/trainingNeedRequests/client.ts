"use client";

import type {
  CreateNeedRequestInput,
  NeedRequestListFilters,
  NeedRequestRecord,
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

export const listNeedRequests = async (filters: Partial<NeedRequestListFilters> = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.employeeUserId) params.set("employeeUserId", filters.employeeUserId);

  const response = await fetch(`/api/training-plan/need-requests?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ needRequests: NeedRequestRecord[] }>(response);
};

export const createNeedRequest = async (input: CreateNeedRequestInput) => {
  const response = await fetch("/api/training-plan/need-requests", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseApiResponse<{ needRequest: NeedRequestRecord }>(response);
};

export const updateNeedRequest = async (id: string, input: UpdateNeedRequestInput) => {
  const response = await fetch(`/api/training-plan/need-requests/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseApiResponse<{ needRequest: NeedRequestRecord }>(response);
};
