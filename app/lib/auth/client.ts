"use client";

export const CLIENT_ROLE_CODES = [
  "EMPLOYEE",
  "HRD_FACTORY",
  "HRD_CENTER",
] as const;

export type ClientRoleCode = (typeof CLIENT_ROLE_CODES)[number];

export type ClientSessionUser = {
  userId: string;
  username: string;
  roleCode: ClientRoleCode;
  employeeId: string | null;
  companyId: string | null;
  email: string | null;
  employeeCode: string | null;
  displayName: string | null;
  companyCode: string | null;
  companyName: string | null;
  functionCode: string | null;
  functionName: string | null;
  positionCode: string | null;
  positionName: string | null;
  levelCode: string | null;
  levelName: string | null;
  pl: string | null;
};

type Fetcher = typeof fetch;

export class AuthenticationClientError extends Error {
  constructor() {
    super("Authentication request failed");
    this.name = "AuthenticationClientError";
  }
}

const isRoleCode = (value: unknown): value is ClientRoleCode =>
  typeof value === "string" &&
  CLIENT_ROLE_CODES.some((roleCode) => roleCode === value);

const nullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const readSessionUser = async (response: Response): Promise<ClientSessionUser> => {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new AuthenticationClientError();
  }

  if (!body || typeof body !== "object") {
    throw new AuthenticationClientError();
  }

  const data = (body as { data?: unknown }).data;
  const user =
    data && typeof data === "object"
      ? (data as { user?: unknown }).user
      : undefined;

  if (!user || typeof user !== "object") {
    throw new AuthenticationClientError();
  }

  const candidate = user as Record<string, unknown>;
  const nullableProfileFields = [
    "email",
    "employeeCode",
    "displayName",
    "companyCode",
    "companyName",
    "functionCode",
    "functionName",
    "positionCode",
    "positionName",
    "levelCode",
    "levelName",
    "pl",
  ] as const;

  if (
    typeof candidate.userId !== "string" ||
    typeof candidate.username !== "string" ||
    !isRoleCode(candidate.role) ||
    !(
      candidate.employeeId === null ||
      typeof candidate.employeeId === "string"
    ) ||
    !(candidate.companyId === null || typeof candidate.companyId === "string") ||
    nullableProfileFields.some(
      (field) =>
        candidate[field] !== null && typeof candidate[field] !== "string",
    )
  ) {
    throw new AuthenticationClientError();
  }

  return {
    userId: candidate.userId,
    username: candidate.username,
    roleCode: candidate.role,
    employeeId: candidate.employeeId,
    companyId: candidate.companyId,
    email: nullableString(candidate.email),
    employeeCode: nullableString(candidate.employeeCode),
    displayName: nullableString(candidate.displayName),
    companyCode: nullableString(candidate.companyCode),
    companyName: nullableString(candidate.companyName),
    functionCode: nullableString(candidate.functionCode),
    functionName: nullableString(candidate.functionName),
    positionCode: nullableString(candidate.positionCode),
    positionName: nullableString(candidate.positionName),
    levelCode: nullableString(candidate.levelCode),
    levelName: nullableString(candidate.levelName),
    pl: nullableString(candidate.pl),
  };
};

export const loginWithCredentials = async (
  username: string,
  password: string,
  fetcher: Fetcher = fetch,
) => {
  const response = await fetcher("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new AuthenticationClientError();
  }

  return readSessionUser(response);
};

export const getCurrentSession = async (fetcher: Fetcher = fetch) => {
  const response = await fetcher("/api/auth/session", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new AuthenticationClientError();
  }

  return readSessionUser(response);
};

export const logoutCurrentSession = async (fetcher: Fetcher = fetch) => {
  const response = await fetcher("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new AuthenticationClientError();
  }
};
