"use client";

import type {
  CreateLevelInput,
  LevelRecord,
  UpdateLevelInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class LevelClientError extends Error {
  constructor(
    readonly code = "LEVEL_REQUEST_FAILED",
    message = "Level request failed",
  ) {
    super(message);
    this.name = "LevelClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new LevelClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new LevelClientError(error?.code, error?.message);
  }
  return body.data;
};
const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listLevels = async (fetcher: Fetcher = fetch) =>
  read<{ items: LevelRecord[] }>(
    await fetcher("/api/master-data/levels?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );
export const createLevel = async (
  input: CreateLevelInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ level: LevelRecord }>(
    await fetcher("/api/master-data/levels", json("POST", input)),
  );
export const updateLevel = async (
  id: string,
  input: UpdateLevelInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ level: LevelRecord }>(
    await fetcher(`/api/master-data/levels/${id}`, json("PATCH", input)),
  );
export const deleteLevel = async (id: string, fetcher: Fetcher = fetch) =>
  read<{ level: LevelRecord }>(
    await fetcher(`/api/master-data/levels/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
