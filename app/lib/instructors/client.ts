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
