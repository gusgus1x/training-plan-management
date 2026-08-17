"use client";

import type { CreateOapPlanInput, OapPlanListFilters, OapPlanRecord, UpdateOapPlanInput } from "./types";

const parseApiResponse = async <T>(response: Response): Promise<T> => {
  let json: any;
  try {
    json = await response.json();
  } catch {
    const errorMsg = response.status === 401 ? "Authentication required" : `Request failed with status ${response.status}`;
    console.error(`[API Error] ${response.status}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!response.ok || !json.ok) {
    const msg = json.error?.message || (response.status === 401 ? "Authentication required" : "An unexpected error occurred");
    const code = json.error?.code || (response.status === 401 ? "UNAUTHENTICATED" : "UNKNOWN");
    const details = json.error?.details ? JSON.stringify(json.error.details) : "";
    console.error(`[API Error] ${response.status} ${code}: ${msg}`, details, json);
    throw new Error(msg);
  }
  return json.data as T;
};

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listOapPlans = async (filters: OapPlanListFilters) => {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  const response = await fetch(`/api/training-plan/oap-plans?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ oapPlans: OapPlanRecord[] }>(response);
};

export const createOapPlan = async (input: CreateOapPlanInput) => {
  const response = await fetch("/api/training-plan/oap-plans", jsonInit("POST", input));
  return parseApiResponse<{ oapPlan: OapPlanRecord }>(response);
};

export const updateOapPlan = async (id: string, input: UpdateOapPlanInput) => {
  const response = await fetch(`/api/training-plan/oap-plans/${id}`, jsonInit("PUT", input));
  return parseApiResponse<{ oapPlan: OapPlanRecord }>(response);
};

export const deleteOapPlan = async (id: string) => {
  const response = await fetch(`/api/training-plan/oap-plans/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return parseApiResponse<{ oapPlanId: string; outcome: "DELETED" }>(response);
};
