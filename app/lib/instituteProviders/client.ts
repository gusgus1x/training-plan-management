"use client";

import type {
  CreateInstituteProviderInput,
  DeleteInstituteProviderResult,
  InstituteProviderRecord,
  InstituteProviderStatus,
  UpdateInstituteProviderInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class InstituteProviderClientError extends Error {
  constructor(
    readonly code = "INSTITUTE_PROVIDER_REQUEST_FAILED",
    message = "Institute/Provider request failed",
  ) {
    super(message);
    this.name = "InstituteProviderClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new InstituteProviderClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new InstituteProviderClientError(error?.code, error?.message);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listInstituteProviders = async (
  filters: { status?: InstituteProviderStatus } = {},
  fetcher: Fetcher = fetch,
) => {
  const params = new URLSearchParams({ page: "1", pageSize: "100" });
  if (filters.status) params.set("status", filters.status);
  return read<{ items: InstituteProviderRecord[] }>(
    await fetcher(`/api/master-data/institute-providers?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
};

export const createInstituteProvider = async (
  input: CreateInstituteProviderInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ instituteProvider: InstituteProviderRecord }>(
    await fetcher("/api/master-data/institute-providers", json("POST", input)),
  );

export const updateInstituteProvider = async (
  id: string,
  input: UpdateInstituteProviderInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ instituteProvider: InstituteProviderRecord }>(
    await fetcher(`/api/master-data/institute-providers/${id}`, json("PATCH", input)),
  );

export const deleteInstituteProvider = async (id: string, fetcher: Fetcher = fetch) =>
  read<DeleteInstituteProviderResult>(
    await fetcher(`/api/master-data/institute-providers/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
