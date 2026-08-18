"use client";

import type {
  CreateDepartmentInput,
  CreateDepartmentMappingInput,
  DepartmentMappingRecord,
  DepartmentRecord,
  UpdateDepartmentInput,
  UpdateDepartmentMappingInput,
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

type PagedResponse<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

const LIST_PAGE_SIZE = 100;

// Master data lists have no server-side cap other than pageSize, and the UI always expects the
// full set (not a paginated view) — loop pages instead of relying on everything fitting on page 1.
export const listDepartments = async (fetcher: Fetcher = fetch) => {
  const first = await read<PagedResponse<DepartmentRecord>>(
    await fetcher(`/api/master-data/departments?page=1&pageSize=${LIST_PAGE_SIZE}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const next = await read<PagedResponse<DepartmentRecord>>(
      await fetcher(`/api/master-data/departments?page=${page}&pageSize=${LIST_PAGE_SIZE}`, {
        credentials: "include",
        cache: "no-store",
      }),
    );
    items.push(...next.items);
  }
  return { items };
};

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

export const listDepartmentMappings = async (fetcher: Fetcher = fetch) =>
  read<{ items: DepartmentMappingRecord[] }>(
    await fetcher("/api/master-data/department-mappings?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const createDepartmentMapping = async (
  input: CreateDepartmentMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: DepartmentMappingRecord }>(
    await fetcher(
      "/api/master-data/department-mappings",
      json("POST", input),
    ),
  );

export const updateDepartmentMapping = async (
  id: string,
  input: UpdateDepartmentMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: DepartmentMappingRecord }>(
    await fetcher(
      `/api/master-data/department-mappings/${id}`,
      json("PATCH", input),
    ),
  );

export const deleteDepartmentMapping = async (
  id: string,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: DepartmentMappingRecord }>(
    await fetcher(`/api/master-data/department-mappings/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
