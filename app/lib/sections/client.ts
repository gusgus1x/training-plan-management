"use client";

import type {
  CreateSectionInput,
  SectionRecord,
  UpdateSectionInput,
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

export const listSections = async (fetcher: Fetcher = fetch) =>
  read<{ items: SectionRecord[] }>(
    await fetcher("/api/master-data/sections?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );

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
