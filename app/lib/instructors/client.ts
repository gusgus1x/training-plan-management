"use client";

import type {
  CreateInstructorInput,
  DeleteInstructorResult,
  InstructorRecord,
  InstructorStatus,
  UpdateInstructorInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class InstructorClientError extends Error {
  constructor(
    readonly code = "INSTRUCTOR_REQUEST_FAILED",
    message = "Instructor request failed",
  ) {
    super(message);
    this.name = "InstructorClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new InstructorClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new InstructorClientError(error?.code, error?.message);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listInstructors = async (
  filters: { status?: InstructorStatus } = {},
  fetcher: Fetcher = fetch,
) => {
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (filters.status) params.set("status", filters.status);
  return read<{ items: InstructorRecord[] }>(
    await fetcher(`/api/master-data/instructors?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
};

export const createInstructor = async (
  input: CreateInstructorInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ instructor: InstructorRecord }>(
    await fetcher("/api/master-data/instructors", json("POST", input)),
  );

export const updateInstructor = async (
  id: string,
  input: UpdateInstructorInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ instructor: InstructorRecord }>(
    await fetcher(`/api/master-data/instructors/${id}`, json("PATCH", input)),
  );

export const deleteInstructor = async (id: string, fetcher: Fetcher = fetch) =>
  read<DeleteInstructorResult>(
    await fetcher(`/api/master-data/instructors/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );

export type InstructorImportSummary = {
  total: number;
  valid: number;
  invalid: number;
  newCount: number;
  updateCount: number;
};

export type ParseInstructorResult = {
  success: boolean;
  fileName: string;
  rowCount: number;
  rows: Array<{
    rowNum: number;
    instructorCode: string;
    firstName: string;
    lastName: string;
    telephone: string | null;
    email: string | null;
    education: string | null;
    university: string | null;
    organizationName: string | null;
    status: "ACTIVE" | "INACTIVE";
    isValid: boolean;
    errors: string[];
    dbStatus?: "NEW" | "UPDATE" | "ERROR";
    existingInstructorId?: string | null;
  }>;
  summary: InstructorImportSummary;
};

export const parseInstructorFile = async (
  file: File,
  fetcher: Fetcher = fetch,
): Promise<ParseInstructorResult> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetcher("/api/master-data/instructors/import", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return read<ParseInstructorResult>(res);
};

export type CommitInstructorImportResult = {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
  results: Array<{ instructorCode: string; status: string }>;
};

export const commitInstructorImport = async (
  rows: ParseInstructorResult["rows"],
  overwriteExisting: boolean = true,
  fetcher: Fetcher = fetch,
): Promise<CommitInstructorImportResult> => {
  const res = await fetcher(
    "/api/master-data/instructors/import",
    json("POST", { rows, overwriteExisting }),
  );
  return read<CommitInstructorImportResult>(res);
};
