"use client";

import type {
  CreateDivisionInput,
  CreateDivisionMappingInput,
  DivisionMappingRecord,
  DivisionRecord,
  UpdateDivisionInput,
  UpdateDivisionMappingInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class DivisionClientError extends Error {
  constructor(
    readonly code = "DIVISION_REQUEST_FAILED",
    message = "Division request failed",
  ) {
    super(message);
    this.name = "DivisionClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new DivisionClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new DivisionClientError(error?.code, error?.message);
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
export const listDivisions = async (fetcher: Fetcher = fetch) => {
  const first = await read<PagedResponse<DivisionRecord>>(
    await fetcher(`/api/master-data/divisions?page=1&pageSize=${LIST_PAGE_SIZE}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const next = await read<PagedResponse<DivisionRecord>>(
      await fetcher(`/api/master-data/divisions?page=${page}&pageSize=${LIST_PAGE_SIZE}`, {
        credentials: "include",
        cache: "no-store",
      }),
    );
    items.push(...next.items);
  }
  return { items };
};

export const createDivision = async (
  input: CreateDivisionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ division: DivisionRecord }>(
    await fetcher("/api/master-data/divisions", json("POST", input)),
  );

export const updateDivision = async (
  id: string,
  input: UpdateDivisionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ division: DivisionRecord }>(
    await fetcher(`/api/master-data/divisions/${id}`, json("PATCH", input)),
  );

export const deleteDivision = async (id: string, fetcher: Fetcher = fetch) =>
  read<{ division: DivisionRecord }>(
    await fetcher(`/api/master-data/divisions/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );

export const listDivisionMappings = async (fetcher: Fetcher = fetch) =>
  read<{ items: DivisionMappingRecord[] }>(
    await fetcher("/api/master-data/division-mappings?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const createDivisionMapping = async (
  input: CreateDivisionMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: DivisionMappingRecord }>(
    await fetcher(
      "/api/master-data/division-mappings",
      json("POST", input),
    ),
  );

export const updateDivisionMapping = async (
  id: string,
  input: UpdateDivisionMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: DivisionMappingRecord }>(
    await fetcher(
      `/api/master-data/division-mappings/${id}`,
      json("PATCH", input),
    ),
  );

export const deleteDivisionMapping = async (
  id: string,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: DivisionMappingRecord }>(
    await fetcher(`/api/master-data/division-mappings/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
