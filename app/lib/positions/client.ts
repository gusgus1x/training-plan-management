"use client";

import type {
  CreatePositionInput,
  PositionRecord,
  UpdatePositionInput,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class PositionClientError extends Error {
  constructor(
    readonly code = "POSITION_REQUEST_FAILED",
    message = "Position request failed",
  ) {
    super(message);
    this.name = "PositionClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new PositionClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new PositionClientError(error?.code, error?.message);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listPositions = async (fetcher: Fetcher = fetch) =>
  read<{ items: PositionRecord[] }>(
    await fetcher("/api/master-data/positions?page=1&pageSize=100", {
      credentials: "include",
      cache: "no-store",
    }),
  );

export const createPosition = async (
  input: CreatePositionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ position: PositionRecord }>(
    await fetcher("/api/master-data/positions", json("POST", input)),
  );

export const updatePosition = async (
  id: string,
  input: UpdatePositionInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ position: PositionRecord }>(
    await fetcher(`/api/master-data/positions/${id}`, json("PATCH", input)),
  );

export const deletePosition = async (id: string, fetcher: Fetcher = fetch) =>
  read<{ position: PositionRecord }>(
    await fetcher(`/api/master-data/positions/${id}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
