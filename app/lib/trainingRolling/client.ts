"use client";

import type { CreateRollingPlanInput, RollingPlanListFilters, RollingPlanRecord, UpdateRollingPlanInput } from "./types";

const parseApiResponse = async <T>(response: Response): Promise<T> => {
  const json = await response.json();
  if (!response.ok || !json.ok) {
    const msg = json.error?.message || "An unexpected error occurred";
    const code = json.error?.code || "UNKNOWN";
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

export const listRollingPlans = async (filters: RollingPlanListFilters) => {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.oapPlanId) params.set("oapPlanId", filters.oapPlanId);
  const response = await fetch(`/api/training-plan/rolling-plans?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ rollingPlans: RollingPlanRecord[] }>(response);
};

export const createRollingPlan = async (input: CreateRollingPlanInput) => {
  const response = await fetch("/api/training-plan/rolling-plans", jsonInit("POST", input));
  return parseApiResponse<{ rollingPlan: RollingPlanRecord }>(response);
};

export const updateRollingPlan = async (id: string, input: UpdateRollingPlanInput) => {
  const response = await fetch(`/api/training-plan/rolling-plans/${id}`, jsonInit("PUT", input));
  return parseApiResponse<{ rollingPlan: RollingPlanRecord }>(response);
};

export const deleteRollingPlan = async (id: string) => {
  const response = await fetch(`/api/training-plan/rolling-plans/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  return parseApiResponse<{ rollingPlanId: string; outcome: "DELETED" }>(response);
};
