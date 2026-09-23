"use client";

export const CLIENT_ROLE_CODES = [
  "EMPLOYEE",
  "HRD_FACTORY",
  "HRD_CENTER",
  "ADMIN",
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
  displayNameEn?: string | null;
  companyCode: string | null;
  companyName: string | null;
  companyNameEn?: string | null;
  functionCode: string | null;
  functionName: string | null;
  functionNameEn?: string | null;
  divisionCode?: string | null;
  divisionName?: string | null;
  divisionNameEn?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  departmentNameEn?: string | null;
  sectionCode?: string | null;
  sectionName?: string | null;
  sectionNameEn?: string | null;
  positionCode: string | null;
  positionName: string | null;
  positionNameEn?: string | null;
  levelCode: string | null;
  levelName: string | null;
  levelNameEn?: string | null;
  pl: string | null;
  birthDate?: string | null;
  startDate?: string | null;
  hireDate?: string | null;
};

type Fetcher = typeof fetch;
const SESSION_CHECK_TIMEOUT_MS = 6_000;

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

  const result: ClientSessionUser = {
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

  if (candidate.displayNameEn !== undefined && candidate.displayNameEn !== null) {
    result.displayNameEn = nullableString(candidate.displayNameEn);
  }
  if (candidate.companyNameEn !== undefined && candidate.companyNameEn !== null) {
    result.companyNameEn = nullableString(candidate.companyNameEn);
  }
  if (candidate.functionNameEn !== undefined && candidate.functionNameEn !== null) {
    result.functionNameEn = nullableString(candidate.functionNameEn);
  }
  if (candidate.divisionCode !== undefined && candidate.divisionCode !== null) {
    result.divisionCode = nullableString(candidate.divisionCode);
  }
  if (candidate.divisionName !== undefined && candidate.divisionName !== null) {
    result.divisionName = nullableString(candidate.divisionName);
  }
  if (candidate.divisionNameEn !== undefined && candidate.divisionNameEn !== null) {
    result.divisionNameEn = nullableString(candidate.divisionNameEn);
  }
  if (candidate.departmentCode !== undefined && candidate.departmentCode !== null) {
    result.departmentCode = nullableString(candidate.departmentCode);
  }
  if (candidate.departmentName !== undefined && candidate.departmentName !== null) {
    result.departmentName = nullableString(candidate.departmentName);
  }
  if (candidate.departmentNameEn !== undefined && candidate.departmentNameEn !== null) {
    result.departmentNameEn = nullableString(candidate.departmentNameEn);
  }
  if (candidate.sectionCode !== undefined && candidate.sectionCode !== null) {
    result.sectionCode = nullableString(candidate.sectionCode);
  }
  if (candidate.sectionName !== undefined && candidate.sectionName !== null) {
    result.sectionName = nullableString(candidate.sectionName);
  }
  if (candidate.sectionNameEn !== undefined && candidate.sectionNameEn !== null) {
    result.sectionNameEn = nullableString(candidate.sectionNameEn);
  }
  if (candidate.positionNameEn !== undefined && candidate.positionNameEn !== null) {
    result.positionNameEn = nullableString(candidate.positionNameEn);
  }
  if (candidate.levelNameEn !== undefined && candidate.levelNameEn !== null) {
    result.levelNameEn = nullableString(candidate.levelNameEn);
  }
  if (candidate.birthDate !== undefined && candidate.birthDate !== null) {
    result.birthDate = nullableString(candidate.birthDate);
  }
  if (candidate.startDate !== undefined && candidate.startDate !== null) {
    result.startDate = nullableString(candidate.startDate);
  }
  if (candidate.hireDate !== undefined && candidate.hireDate !== null) {
    result.hireDate = nullableString(candidate.hireDate);
  }

  return result;
};

/** Password accepted but the emailed code is still owed (EMPLOYEE only). */
export type LoginOtpChallenge = { otpRequired: true; maskedEmail: string | null };

export const loginWithCredentials = async (
  username: string,
  password: string,
  fetcher: Fetcher = fetch,
): Promise<ClientSessionUser | LoginOtpChallenge> => {
  const response = await fetcher("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new AuthenticationClientError();
  }

  const data = (await response.clone().json().catch(() => null))?.data as
    | Partial<LoginOtpChallenge>
    | undefined;
  if (data?.otpRequired === true) {
    return { otpRequired: true, maskedEmail: typeof data.maskedEmail === "string" ? data.maskedEmail : null };
  }

  return readSessionUser(response);
};

/** A failed OTP call, carrying the server's error code so the screen can say what went wrong. */
export class LoginOtpClientError extends Error {
  constructor(
    readonly code: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "LoginOtpClientError";
  }
}

const postOtp = async (path: string, body: unknown, fetcher: Fetcher) => {
  const response = await fetcher(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.clone().json().catch(() => null))?.error;
    throw new LoginOtpClientError(
      typeof error?.code === "string" ? error.code : "UNKNOWN",
      error?.details && typeof error.details === "object" ? error.details : {},
    );
  }
  return response;
};

export const requestLoginOtp = async (email: string | null, fetcher: Fetcher = fetch) => {
  const response = await postOtp("/api/auth/otp/request", email ? { email } : {}, fetcher);
  const data = (await response.json()).data as {
    maskedEmail: string | null;
    expiresInSeconds: number;
    resendAfterSeconds: number;
  };
  return data;
};

export const verifyLoginOtp = async (code: string, fetcher: Fetcher = fetch) =>
  readSessionUser(await postOtp("/api/auth/otp/verify", { code }, fetcher));

export const getCurrentSession = async (
  fetcher: Fetcher = fetch,
  timeoutMs = SESSION_CHECK_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetcher("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new AuthenticationClientError();
  } finally {
    globalThis.clearTimeout(timeout);
  }

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
