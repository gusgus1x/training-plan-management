"use client";

import type {
  CreateUserAccountInput,
  UpdateUserAccountInput,
  UserAccountListFilters,
  UserAccountRecord,
} from "./types";

type Fetcher = typeof fetch;
type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } };

export class UserAccountClientError extends Error {
  constructor(
    readonly code = "USER_ACCOUNT_REQUEST_FAILED",
    message = "Account request failed",
  ) {
    super(message);
    this.name = "UserAccountClientError";
  }
}

const read = async <T>(response: Response): Promise<T> => {
  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new UserAccountClientError();
  }
  if (!response.ok || body.ok !== true) {
    const error = body.ok === false ? body.error : undefined;
    throw new UserAccountClientError(error?.code, error?.message);
  }
  return body.data;
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listUserAccounts = async (
  filters: Partial<UserAccountListFilters> = {},
  fetcher: Fetcher = fetch,
) => {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.roleCode) params.set("roleCode", filters.roleCode);

  return read<{ accounts: UserAccountRecord[] }>(
    await fetcher(`/api/admin/users?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
};

export const createUserAccount = async (
  input: CreateUserAccountInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ account: UserAccountRecord }>(
    await fetcher("/api/admin/users", json("POST", input)),
  );

export const updateUserAccount = async (
  userId: string,
  input: UpdateUserAccountInput,
  fetcher: Fetcher = fetch,
) =>
  read<{ account: UserAccountRecord }>(
    await fetcher(`/api/admin/users/${userId}`, json("PATCH", input)),
  );

export const resetUserAccountPassword = async (
  userId: string,
  password: string,
  fetcher: Fetcher = fetch,
) =>
  read<{ account: UserAccountRecord }>(
    await fetcher(`/api/admin/users/${userId}/password`, json("POST", { password })),
  );
