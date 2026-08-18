"use client";

import type {
  CreateFunctionMappingInput,
  CreateOrganizationFunctionInput,
  FunctionMappingRecord,
  OrganizationFunctionRecord,
  UpdateFunctionMappingInput,
  UpdateOrganizationFunctionInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> = { ok: true; data: T } | { ok: false; error?: { code?: string; message?: string } };

export class FunctionClientError extends Error {
  constructor(
    readonly code = "FUNCTION_REQUEST_FAILED",
    message = "Function request failed",
  ) {
    super(message);
    this.name = "FunctionClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new FunctionClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new FunctionClientError(error?.code, error?.message);
  }
  return body.data;
};

const jsonRequest = (method: string, body: unknown): RequestInit => ({
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
export const listFunctions = async (fetcher: Fetcher = fetch) => {
  const first = await read<PagedResponse<OrganizationFunctionRecord>>(
    await fetcher(`/api/master-data/functions?page=1&pageSize=${LIST_PAGE_SIZE}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const next = await read<PagedResponse<OrganizationFunctionRecord>>(
      await fetcher(`/api/master-data/functions?page=${page}&pageSize=${LIST_PAGE_SIZE}`, {
        credentials: "include",
        cache: "no-store",
      }),
    );
    items.push(...next.items);
  }
  return { items };
};

export const createFunction = async (
  input: CreateOrganizationFunctionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ function: OrganizationFunctionRecord }>(
    await fetcher(
      "/api/master-data/functions",
      jsonRequest("POST", input),
    ),
  );

export const updateFunction = async (
  id: string,
  input: UpdateOrganizationFunctionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ function: OrganizationFunctionRecord }>(
    await fetcher(
      `/api/master-data/functions/${id}`,
      jsonRequest("PATCH", input),
    ),
  );

export const deleteFunction = async (id: string, fetcher: Fetcher = fetch) =>
  read<{ function: OrganizationFunctionRecord }>(
    await fetcher(`/api/master-data/functions/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );

export const listFunctionMappings = async (fetcher: Fetcher = fetch) =>
  read<{ items: FunctionMappingRecord[] }>(
    await fetcher("/api/master-data/function-mappings?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const createFunctionMapping = async (
  input: CreateFunctionMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: FunctionMappingRecord }>(
    await fetcher(
      "/api/master-data/function-mappings",
      jsonRequest("POST", input),
    ),
  );

export const updateFunctionMapping = async (
  id: string,
  input: UpdateFunctionMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: FunctionMappingRecord }>(
    await fetcher(
      `/api/master-data/function-mappings/${id}`,
      jsonRequest("PATCH", input),
    ),
  );

export const deleteFunctionMapping = async (
  id: string,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: FunctionMappingRecord }>(
    await fetcher(`/api/master-data/function-mappings/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
