"use client";

import type {
  CreateSectionInput,
  CreateSectionMappingInput,
  SectionMappingRecord,
  SectionRecord,
  UpdateSectionInput,
  UpdateSectionMappingInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class SectionClientError extends Error {
  constructor(
    readonly code = "SECTION_REQUEST_FAILED",
    message = "Section request failed",
  ) {
    super(message);
    this.name = "SectionClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new SectionClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new SectionClientError(error?.code, error?.message);
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
export const listSections = async (fetcher: Fetcher = fetch) => {
  const first = await read<PagedResponse<SectionRecord>>(
    await fetcher(`/api/master-data/sections?page=1&pageSize=${LIST_PAGE_SIZE}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const next = await read<PagedResponse<SectionRecord>>(
      await fetcher(`/api/master-data/sections?page=${page}&pageSize=${LIST_PAGE_SIZE}`, {
        credentials: "include",
        cache: "no-store",
      }),
    );
    items.push(...next.items);
  }
  return { items };
};

export const createSection = async (
  input: CreateSectionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ section: SectionRecord }>(
    await fetcher("/api/master-data/sections", json("POST", input)),
  );

export const updateSection = async (
  id: string,
  input: UpdateSectionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ section: SectionRecord }>(
    await fetcher(`/api/master-data/sections/${id}`, json("PATCH", input)),
  );

export const deleteSection = async (id: string, fetcher: Fetcher = fetch) =>
  read<{ section: SectionRecord }>(
    await fetcher(`/api/master-data/sections/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );

export const listSectionMappings = async (fetcher: Fetcher = fetch) =>
  read<{ items: SectionMappingRecord[] }>(
    await fetcher("/api/master-data/section-mappings?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const createSectionMapping = async (
  input: CreateSectionMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: SectionMappingRecord }>(
    await fetcher("/api/master-data/section-mappings", json("POST", input)),
  );

export const updateSectionMapping = async (
  id: string,
  input: UpdateSectionMappingInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: SectionMappingRecord }>(
    await fetcher(
      `/api/master-data/section-mappings/${id}`,
      json("PATCH", input),
    ),
  );

export const deleteSectionMapping = async (
  id: string,
  fetcher: Fetcher = fetch,
) =>
  read<{ mapping: SectionMappingRecord }>(
    await fetcher(`/api/master-data/section-mappings/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
