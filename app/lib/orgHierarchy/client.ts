"use client";

import type { OrgHierarchyUsageRow } from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class OrgHierarchyClientError extends Error {
  constructor(
    readonly code = "ORG_HIERARCHY_REQUEST_FAILED",
    message = "Org hierarchy usage request failed",
  ) {
    super(message);
    this.name = "OrgHierarchyClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new OrgHierarchyClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new OrgHierarchyClientError(error?.code, error?.message);
  }
  return body.data;
};

export const listOrgHierarchyUsage = async (fetcher: Fetcher = fetch) =>
  read<{ items: OrgHierarchyUsageRow[] }>(
    await fetcher("/api/master-data/org-hierarchy-usage", {
      credentials: "include",
      cache: "no-store",
    }),
  );
