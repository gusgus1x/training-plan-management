"use client";

import type { CreateEnrollmentInput, EnrollmentListFilters, EnrollmentRecord, SetAttendanceInput, UpdateEnrollmentInput } from "./types";

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

export const listEnrollments = async (filters: EnrollmentListFilters) => {
  const params = new URLSearchParams();
  if (filters.planId) params.set("planId", filters.planId);
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  const response = await fetch(`/api/training-plan/enrollments?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseApiResponse<{ enrollments: EnrollmentRecord[] }>(response);
};

export const createEnrollment = async (input: CreateEnrollmentInput) => {
  const response = await fetch("/api/training-plan/enrollments", jsonInit("POST", input));
  return parseApiResponse<{ enrollment: EnrollmentRecord }>(response);
};

export const updateEnrollmentStatus = async (id: string, input: UpdateEnrollmentInput) => {
  const response = await fetch(`/api/training-plan/enrollments/${id}`, jsonInit("PUT", input));
  return parseApiResponse<{ enrollment: EnrollmentRecord }>(response);
};

export const setEnrollmentAttendance = async (id: string, input: SetAttendanceInput) => {
  const response = await fetch(`/api/training-plan/enrollments/${id}/attendance`, jsonInit("PUT", input));
  return parseApiResponse<{ enrollment: EnrollmentRecord }>(response);
};
