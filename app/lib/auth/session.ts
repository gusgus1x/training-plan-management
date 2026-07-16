import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "tpm_session";
export const SESSION_IDLE_SECONDS = 30 * 60;
export const SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;

type SessionEnvironment = Record<string, string | undefined>;

export type SessionPayload = {
  version: 1;
  userId: string;
  issuedAt: number;
  lastSeenAt: number;
};

type CreateSessionOptions = {
  secret?: string;
  now?: number;
  issuedAt?: number;
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

const isValidPayload = (value: unknown): value is SessionPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<SessionPayload>;

  return (
    payload.version === 1 &&
    typeof payload.userId === "string" &&
    /^[1-9]\d*$/.test(payload.userId) &&
    Number.isInteger(payload.issuedAt) &&
    Number.isInteger(payload.lastSeenAt)
  );
};

const currentEpochSeconds = () => Math.floor(Date.now() / 1000);

export const createSessionToken = (
  userId: string,
  options: CreateSessionOptions = {},
) => {
  const secret = options.secret ?? getSessionSecret();
  const now = options.now ?? currentEpochSeconds();
  const payload: SessionPayload = {
    version: 1,
    userId,
    issuedAt: options.issuedAt ?? now,
    lastSeenAt: now,
  };
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
