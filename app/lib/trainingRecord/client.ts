"use client";

import type { CostBreakdown, SaveExpensesInput, TrainingRecordSummary } from "./types";

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

export const listTrainingRecords = async () => {
  const response = await fetch("/api/training-plan/training-records", {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ trainingRecords: TrainingRecordSummary[] }>(response);
};

export const saveTrainingRecordExpenses = async (planId: string, input: SaveExpensesInput) => {
  const response = await fetch(`/api/training-plan/training-records/${planId}/expenses`, jsonInit("PUT", input));
  return parseApiResponse<{ trainingRecord: TrainingRecordSummary }>(response);
};

export const getCostBreakdown = async (planId: string) => {
  const response = await fetch(`/api/training-plan/training-records/${planId}/cost-breakdown`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ costBreakdown: CostBreakdown }>(response);
};
