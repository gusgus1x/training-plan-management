import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { getPrismaClient } from "../database/prisma";
import { getSessionSecret } from "./session";

/**
 * Email one-time code for EMPLOYEE logins (migration 45).
 *
 * The birth-date password is easy to know, so an employee must also confirm a code sent to their
 * own email on the first login and whenever the last confirmation is more than 2 days old. The
 * confirmation belongs to the user, not the device. The address is bound to the account the first
 * time a code sent to it is confirmed; after that codes only ever go to that address, and only
 * Admin can change it. HRD and Admin accounts never see this step.
 */

export const OTP_CODE_TTL_SECONDS = 3 * 60;
export const OTP_VERIFIED_DAYS = 2;
export const OTP_RESEND_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 5;
export const OTP_PENDING_SECONDS = 10 * 60;
export const OTP_PENDING_COOKIE_NAME = "tpm_otp_pending";

type Environment = Record<string, string | undefined>;

/** Off switch for local work on a shared DB: LOGIN_OTP_DISABLED=true in .env. */
export const isLoginOtpEnabled = (environment: Environment = process.env) =>
  environment.LOGIN_OTP_DISABLED?.trim().toLowerCase() !== "true";

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) =>
  value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** "somchai@gmail.com" -> "so*****@gmail.com": enough to recognise, not enough to harvest. */
export const maskEmail = (email: string | null) => {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const visible = local.slice(0, Math.min(2, local.length - 1) || 1);
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 3))}${email.slice(at)}`;
};

export const generateOtpCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

/** Keyed on the user as well, so one stored hash is useless against any other account. */
export const hashOtpCode = (userId: string, code: string, secret = getSessionSecret()) =>
  createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");

export const otpCodeMatches = (userId: string, code: string, storedHash: string, secret?: string) => {
  const actual = Buffer.from(hashOtpCode(userId, code, secret), "utf8");
  const expected = Buffer.from(storedHash, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const isOtpVerificationCurrent = (otpVerifiedUntil: Date | null, now = new Date()) =>
  otpVerifiedUntil !== null && otpVerifiedUntil.getTime() > now.getTime();

export const otpVerifiedUntilFrom = (now: Date) =>
  new Date(now.getTime() + OTP_VERIFIED_DAYS * 24 * 60 * 60 * 1000);

// ---- pending-login cookie ------------------------------------------------------------------
// Password is right but the code is still owed: the caller holds this instead of a session. It
// only opens the two /api/auth/otp routes, and only for 10 minutes.

type PendingPayload = { userId: string; exp: number };

const signPending = (encoded: string, secret: string) =>
  createHmac("sha256", secret).update(`otp-pending.${encoded}`).digest("base64url");

export const createPendingToken = (
  userId: string,
  { secret = getSessionSecret(), now = Date.now() }: { secret?: string; now?: number } = {},
) => {
  const payload: PendingPayload = { userId, exp: Math.floor(now / 1000) + OTP_PENDING_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPending(encoded, secret)}`;
};

export const verifyPendingToken = (
  token: string | undefined,
  { secret = getSessionSecret(), now = Date.now() }: { secret?: string; now?: number } = {},
): string | null => {
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  const actual = Buffer.from(signature, "utf8");
  const expected = Buffer.from(signPending(encoded, secret), "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PendingPayload>;
    if (typeof payload.userId !== "string" || !/^[1-9]\d*$/.test(payload.userId)) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(now / 1000)) return null;
    return payload.userId;
  } catch {
    return null;
  }
};

const pendingCookieBase = (production: boolean) => ({
  name: OTP_PENDING_COOKIE_NAME,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: production,
  path: "/api/auth/otp",
});

export const setPendingCookie = (response: NextResponse, token: string, production: boolean) => {
  response.cookies.set({ ...pendingCookieBase(production), value: token, maxAge: OTP_PENDING_SECONDS });
};

export const clearPendingCookie = (response: NextResponse, production: boolean) => {
  response.cookies.set({ ...pendingCookieBase(production), value: "", maxAge: 0 });
};

// ---- storage -------------------------------------------------------------------------------

export type OtpAccountState = { email: string | null; otpVerifiedUntil: Date | null };

export type OtpRow = {
  otpId: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  attemptCount: number;
  createdAt: Date;
};

export type LoginOtpStore = {
  getAccountState(userId: string): Promise<OtpAccountState | null>;
  isEmailTakenByOther(email: string, userId: string): Promise<boolean>;
  listSentSince(userId: string, since: Date): Promise<Date[]>;
  /** createdAt comes from the app clock: the column default (sysdatetime) is server-local time, which
   *  Prisma reads as UTC - seven hours ahead here, so the resend wait came out at ~25,000 seconds. */
  createOtp(input: { userId: string; email: string; codeHash: string; expiresAt: Date; createdAt: Date }): Promise<void>;
  latestUnconsumed(userId: string): Promise<OtpRow | null>;
  recordFailedAttempt(otpId: string): Promise<void>;
  /** Marks the code used and binds the email; false when someone else consumed it first. */
  confirm(input: { userId: string; otpId: string; email: string; now: Date; verifiedUntil: Date }): Promise<boolean>;
};

export const prismaLoginOtpStore: LoginOtpStore = {
  async getAccountState(userId) {
    const row = await getPrismaClient().user_account.findUnique({
      where: { user_id: BigInt(userId) },
      select: { email: true, otp_verified_until: true },
    });
    return row ? { email: row.email, otpVerifiedUntil: row.otp_verified_until } : null;
  },

  async isEmailTakenByOther(email, userId) {
    const row = await getPrismaClient().user_account.findFirst({
      where: { email, NOT: { user_id: BigInt(userId) } },
      select: { user_id: true },
    });
    return row !== null;
  },

  async listSentSince(userId, since) {
    const rows = await getPrismaClient().auth_login_otp.findMany({
      where: { user_id: BigInt(userId), created_at: { gte: since } },
      select: { created_at: true },
      orderBy: { created_at: "desc" },
    });
    return rows.map((row) => row.created_at);
  },

  async createOtp({ userId, email, codeHash, expiresAt, createdAt }) {
    await getPrismaClient().auth_login_otp.create({
      data: { user_id: BigInt(userId), email, code_hash: codeHash, expires_at: expiresAt, created_at: createdAt },
    });
  },

  async latestUnconsumed(userId) {
    const row = await getPrismaClient().auth_login_otp.findFirst({
      where: { user_id: BigInt(userId), consumed_at: null },
      orderBy: { created_at: "desc" },
    });
    return row
      ? {
          otpId: row.otp_id.toString(),
          email: row.email,
          codeHash: row.code_hash,
          expiresAt: row.expires_at,
          attemptCount: row.attempt_count,
          createdAt: row.created_at,
        }
      : null;
  },

  async recordFailedAttempt(otpId) {
    await getPrismaClient().auth_login_otp.update({
      where: { otp_id: BigInt(otpId) },
      data: { attempt_count: { increment: 1 } },
    });
  },

  async confirm({ userId, otpId, email, now, verifiedUntil }) {
    return getPrismaClient().$transaction(async (tx) => {
      const consumed = await tx.auth_login_otp.updateMany({
        where: { otp_id: BigInt(otpId), consumed_at: null },
        data: { consumed_at: now },
      });
      if (consumed.count !== 1) return false;
      await tx.user_account.update({
        where: { user_id: BigInt(userId) },
        data: { email, otp_verified_until: verifiedUntil },
      });
      return true;
    });
  },
};
