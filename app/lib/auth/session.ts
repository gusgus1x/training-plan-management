import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  ROLE_CODES,
  type AuthenticatedPrincipal,
  type RoleCode,
} from "./types";

export const SESSION_COOKIE_NAME = "tpm_session";
export const SESSION_IDLE_SECONDS = 2 * 60 * 60;
export const SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;
export const SESSION_REVALIDATE_SECONDS = 5 * 60;

type SessionEnvironment = Record<string, string | undefined>;

type SessionPayloadBase = {
  userId: string;
  issuedAt: number;
  lastSeenAt: number;
};

export type SessionPayload = SessionPayloadBase & ({
  version: 1;
} | {
  version: 2;
  validatedAt: number;
  principal: AuthenticatedPrincipal;
});

type CreateSessionOptions = {
  secret?: string;
  now?: number;
  issuedAt?: number;
  validatedAt?: number;
  principal?: AuthenticatedPrincipal;
};

type VerifySessionOptions = {
  secret?: string;
  now?: number;
};

export class SessionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionConfigurationError";
  }
}

export const getSessionSecret = (
  environment: SessionEnvironment = process.env,
) => {
  const secret = environment.AUTH_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new SessionConfigurationError(
      "AUTH_SESSION_SECRET must contain at least 32 characters",
    );
  }

  return secret;
};

const sign = (encodedPayload: string, secret: string) =>
  createHmac("sha256", secret).update(encodedPayload).digest("base64url");

const nullablePrincipalFields = [
  "employeeId",
  "companyId",
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

const isAuthenticatedPrincipal = (
  value: unknown,
): value is AuthenticatedPrincipal => {
  if (!value || typeof value !== "object") return false;
  const principal = value as Partial<AuthenticatedPrincipal>;
  return (
    typeof principal.userId === "string" &&
    typeof principal.username === "string" &&
    typeof principal.role === "string" &&
    ROLE_CODES.includes(principal.role as RoleCode) &&
    nullablePrincipalFields.every(
      (field) =>
        principal[field] === null || typeof principal[field] === "string",
    )
  );
};

const isValidPayload = (value: unknown): value is SessionPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<SessionPayload> & Record<string, unknown>;

  const validBase =
    (payload.version === 1 || payload.version === 2) &&
    typeof payload.userId === "string" &&
    /^[1-9]\d*$/.test(payload.userId) &&
    Number.isInteger(payload.issuedAt) &&
    Number.isInteger(payload.lastSeenAt);

  if (!validBase) return false;
  if (payload.version === 1) return true;

  return (
    Number.isInteger(payload.validatedAt) &&
    Number(payload.validatedAt) >= Number(payload.issuedAt) &&
    Number(payload.validatedAt) <= Number(payload.lastSeenAt) &&
    isAuthenticatedPrincipal(payload.principal) &&
    payload.principal.userId === payload.userId
  );
};

const currentEpochSeconds = () => Math.floor(Date.now() / 1000);

export const createSessionToken = (
  userId: string,
  options: CreateSessionOptions = {},
) => {
  const secret = options.secret ?? getSessionSecret();
  const now = options.now ?? currentEpochSeconds();
  const basePayload: SessionPayloadBase = {
    userId,
    issuedAt: options.issuedAt ?? now,
    lastSeenAt: now,
  };
  const payload: SessionPayload = options.principal
    ? {
        ...basePayload,
        version: 2,
        validatedAt: options.validatedAt ?? now,
        principal: options.principal,
      }
    : { ...basePayload, version: 1 };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
};

export const verifySessionToken = (
  token: string,
  options: VerifySessionOptions = {},
): SessionPayload | null => {
  const secret = options.secret ?? getSessionSecret();

  try {
    const now = options.now ?? currentEpochSeconds();
    const [encodedPayload, encodedSignature, extraPart] = token.split(".");

    if (!encodedPayload || !encodedSignature || extraPart !== undefined) {
      return null;
    }

    const expectedSignature = sign(encodedPayload, secret);
    const actualBuffer = Buffer.from(encodedSignature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }

    const parsedPayload: unknown = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );

    if (!isValidPayload(parsedPayload)) {
      return null;
    }

    if (
      parsedPayload.issuedAt > now ||
      parsedPayload.lastSeenAt < parsedPayload.issuedAt ||
      parsedPayload.lastSeenAt > now ||
      now - parsedPayload.lastSeenAt >= SESSION_IDLE_SECONDS ||
      now - parsedPayload.issuedAt >= SESSION_ABSOLUTE_SECONDS
    ) {
      return null;
    }

    return parsedPayload;
  } catch {
    return null;
  }
};

// Secure must reflect the connection the request actually arrived on, not
// just NODE_ENV — a `production` build served over plain http (e.g. local
// `next start` on localhost, or a trial deploy without TLS yet) would
// otherwise get a Secure-flagged cookie that the browser silently refuses to
// store/send, breaking login in a way that looks like a random 401.
export const isSecureRequest = (request: Pick<NextRequest | Request, "headers" | "url">) =>
  request.headers.get("x-forwarded-proto") === "https" ||
  new URL(request.url).protocol === "https:";

export const setSessionCookie = (
  response: NextResponse,
  token: string,
  production = process.env.NODE_ENV === "production",
) => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
    maxAge: SESSION_IDLE_SECONDS,
  });
};

export const clearSessionCookie = (
  response: NextResponse,
  production = process.env.NODE_ENV === "production",
) => {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
    maxAge: 0,
  });
};
