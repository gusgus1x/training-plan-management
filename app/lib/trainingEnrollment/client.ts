"use client";

import type { CreateEnrollmentInput, EnrollmentDeleted, EnrollmentListFilters, EnrollmentRecord, SetAttendanceInput, UpdateEnrollmentInput } from "./types";

// A plain Error threw away the API's error code and details, so a caller could not tell a
// prerequisite rejection (409 PREREQUISITE_NOT_MET, with the missing courses in `details`) apart
// from any other failure. Still an Error, so existing `catch { }.message` call sites are unaffected.
export class EnrollmentApiError extends Error {
  constructor(message: string, readonly code: string, readonly details: unknown) {
    super(message);
    this.name = "EnrollmentApiError";
  }
}

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
    throw new EnrollmentApiError(msg, code, json.error?.details);
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
  if (filters.employeeUserId) params.set("employeeUserId", filters.employeeUserId);
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

// A cancel deletes the row, so it answers with EnrollmentDeleted rather than a record.
export const updateEnrollmentStatus = async (id: string, input: UpdateEnrollmentInput) => {
  const response = await fetch(`/api/training-plan/enrollments/${id}`, jsonInit("PUT", input));
  return parseApiResponse<{ enrollment: EnrollmentRecord | EnrollmentDeleted }>(response);
};

export const setEnrollmentAttendance = async (id: string, input: SetAttendanceInput) => {
  const response = await fetch(`/api/training-plan/enrollments/${id}/attendance`, jsonInit("PUT", input));
  return parseApiResponse<{ enrollment: EnrollmentRecord }>(response);
};
