import type { NextRequest } from "next/server";
import { ApiError } from "../api/errors";
import { apiFailure, apiSuccess } from "../api/response";
import { auditRequestContext, recordAuditQuietly } from "../audit";
import { revalidateAuthenticatedUser } from "./authentication";
import {
  OTP_CODE_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  OTP_PENDING_COOKIE_NAME,
  OTP_RESEND_SECONDS,
  clearPendingCookie,
  generateOtpCode,
  hashOtpCode,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  otpCodeMatches,
  otpVerifiedUntilFrom,
  prismaLoginOtpStore,
  verifyPendingToken,
  type LoginOtpStore,
} from "./loginOtp";
import { sendOtpEmail, type OtpMailer } from "./mailer";
import { isSecureRequest } from "./session";
import { startSession, type SessionTokenFactory } from "./startSession";
import type { AuthenticatedPrincipal } from "./types";

type OtpHandlerDependencies = {
  store?: LoginOtpStore;
  send?: OtpMailer;
  revalidate?: (userId: string) => Promise<AuthenticatedPrincipal>;
  createToken?: SessionTokenFactory;
  now?: () => Date;
  production?: boolean;
};

const fail = (code: string, message: string, status: number, details?: ApiError["details"]) =>
  new ApiError({ code, message, status, details });

const pendingUserId = (request: NextRequest) => {
  const userId = verifyPendingToken(request.cookies.get(OTP_PENDING_COOKIE_NAME)?.value);
  if (!userId) throw fail("OTP_SESSION_EXPIRED", "Please sign in again", 401);
  return userId;
};

const readBody = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const noStore = <T extends Response>(response: T) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

/**
 * POST /api/auth/otp/request { email? }
 * With an email already bound, the code always goes there and any email in the body is ignored,
 * so knowing the birth date is never enough to redirect the code. Without one, the body email is
 * used and is bound only once the code is confirmed.
 */
export const createOtpRequestHandler = (dependencies: OtpHandlerDependencies = {}) =>
  async function otpRequestHandler(request: NextRequest) {
    const store = dependencies.store ?? prismaLoginOtpStore;
    const now = (dependencies.now ?? (() => new Date()))();
    const context = auditRequestContext(request);

    try {
      const userId = pendingUserId(request);
      const state = await store.getAccountState(userId);
      if (!state) throw fail("OTP_SESSION_EXPIRED", "Please sign in again", 401);

      let email = state.email;
      if (!email) {
        const body = await readBody(request);
        const typed = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        if (!typed) throw fail("EMAIL_REQUIRED", "Email is required", 400);
        if (!isValidEmail(typed)) throw fail("INVALID_EMAIL", "Email address is not valid", 400);
        if (await store.isEmailTakenByOther(typed, userId)) {
          throw fail("EMAIL_TAKEN", "This email is already used by another account", 409);
        }
        email = typed;
      }

      const sentLastHour = await store.listSentSince(userId, new Date(now.getTime() - 60 * 60 * 1000));
      const lastSent = sentLastHour[0];
      if (lastSent && now.getTime() - lastSent.getTime() < OTP_RESEND_SECONDS * 1000) {
        const wait = Math.ceil((OTP_RESEND_SECONDS * 1000 - (now.getTime() - lastSent.getTime())) / 1000);
        throw fail("OTP_RESEND_TOO_SOON", "Please wait before requesting another code", 429, {
          retryAfterSeconds: wait,
        });
      }
      if (sentLastHour.length >= OTP_MAX_SENDS_PER_HOUR) {
        throw fail("OTP_RATE_LIMITED", "Too many codes requested, try again later", 429);
      }

      const code = generateOtpCode();
      await store.createOtp({
        userId,
        email,
        codeHash: hashOtpCode(userId, code),
        expiresAt: new Date(now.getTime() + OTP_CODE_TTL_SECONDS * 1000),
      });
      await (dependencies.send ?? sendOtpEmail)(email, code);

      await recordAuditQuietly({
        category: "AUTH",
        action: "LOGIN_OTP_SENT",
        actor: { userId },
        detail: { to: maskEmail(email), firstBinding: state.email === null },
        ...context,
      });

      return noStore(
        apiSuccess({
          maskedEmail: maskEmail(email),
          expiresInSeconds: OTP_CODE_TTL_SECONDS,
          resendAfterSeconds: OTP_RESEND_SECONDS,
        }),
      );
    } catch (error) {
      return noStore(apiFailure(error));
    }
  };

/** POST /api/auth/otp/verify { code } — on success binds the email, starts the 2 days, signs in. */
export const createOtpVerifyHandler = (dependencies: OtpHandlerDependencies = {}) =>
  async function otpVerifyHandler(request: NextRequest) {
    const store = dependencies.store ?? prismaLoginOtpStore;
    const now = (dependencies.now ?? (() => new Date()))();
    const production = dependencies.production ?? isSecureRequest(request);
    const context = auditRequestContext(request);

    try {
      const userId = pendingUserId(request);
      const body = await readBody(request);
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!/^\d{6}$/.test(code)) throw fail("OTP_INVALID", "Enter the 6-digit code", 400);

      const otp = await store.latestUnconsumed(userId);
      if (!otp || otp.expiresAt.getTime() <= now.getTime() || otp.attemptCount >= OTP_MAX_ATTEMPTS) {
        throw fail("OTP_EXPIRED", "This code has expired, request a new one", 400);
      }

      if (!otpCodeMatches(userId, code, otp.codeHash)) {
        await store.recordFailedAttempt(otp.otpId);
        const attemptsLeft = Math.max(OTP_MAX_ATTEMPTS - otp.attemptCount - 1, 0);
        await recordAuditQuietly({
          category: "AUTH",
          action: "LOGIN_OTP_FAILED",
          actor: { userId },
          detail: { attemptsLeft },
          ...context,
        });
        throw fail("OTP_INVALID", "The code is not correct", 400, { attemptsLeft });
      }

      // Checked again here: the address may have been bound to someone else since it was sent.
      if (await store.isEmailTakenByOther(otp.email, userId)) {
        throw fail("EMAIL_TAKEN", "This email is already used by another account", 409);
      }
      const confirmed = await store.confirm({
        userId,
        otpId: otp.otpId,
        email: otp.email,
        now,
        verifiedUntil: otpVerifiedUntilFrom(now),
      });
      if (!confirmed) throw fail("OTP_EXPIRED", "This code has expired, request a new one", 400);

      const principal = await (dependencies.revalidate ?? revalidateAuthenticatedUser)(userId);
      await recordAuditQuietly({
        category: "AUTH",
        action: "LOGIN_OTP_VERIFIED",
        actor: { userId, username: principal.username, role: principal.role },
        detail: { email: maskEmail(otp.email) },
        ...context,
      });

      const response = await startSession(request, principal, {
        createToken: dependencies.createToken,
        production,
      });
      clearPendingCookie(response, production);
      return response;
    } catch (error) {
      return noStore(apiFailure(error));
    }
  };
