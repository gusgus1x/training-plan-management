"use client";

import type {
  CreateDepartmentInput,
  DepartmentRecord,
  UpdateDepartmentInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class DepartmentClientError extends Error {
  constructor(
    readonly code = "DEPARTMENT_REQUEST_FAILED",
    message = "Department request failed",
  ) {
    super(message);
    this.name = "DepartmentClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new DepartmentClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new DepartmentClientError(error?.code, error?.message);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listDepartments = async (fetcher: Fetcher = fetch) =>
  read<{ items: DepartmentRecord[] }>(
    await fetcher("/api/master-data/departments?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const createDepartment = async (
  input: CreateDepartmentInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ department: DepartmentRecord }>(
    await fetcher("/api/master-data/departments", json("POST", input)),
  );

export const updateDepartment = async (
  id: string,
  input: UpdateDepartmentInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ department: DepartmentRecord }>(
    await fetcher(`/api/master-data/departments/${id}`, json("PATCH", input)),
  );

export const deleteDepartment = async (id: string, fetcher: Fetcher = fetch) =>
  read<{ department: DepartmentRecord }>(
    await fetcher(`/api/master-data/departments/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
