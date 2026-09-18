import { ApiError } from "../../../lib/api/errors";
import { apiFailure, apiSuccess } from "../../../lib/api/response";
import { auditRequestContext, recordAuditQuietly } from "../../../lib/audit";
import { authenticateCredentials } from "../../../lib/auth/authentication";
import {
  createPendingToken,
  isLoginOtpEnabled,
  isOtpVerificationCurrent,
  maskEmail,
  prismaLoginOtpStore,
  setPendingCookie,
  type LoginOtpStore,
} from "../../../lib/auth/loginOtp";
import { prismaOtpSuspensionStore } from "../../../lib/auth/loginOtpSuspension";
import { isSecureRequest } from "../../../lib/auth/session";
import { startSession, type SessionTokenFactory } from "../../../lib/auth/startSession";
import type { AuthenticatedPrincipal } from "../../../lib/auth/types";

type LoginHandlerDependencies = {
  authenticate?: (
    username: string,
    password: string,
  ) => Promise<AuthenticatedPrincipal>;
  createToken?: SessionTokenFactory;
  production?: boolean;
  otpStore?: Pick<LoginOtpStore, "getAccountState">;
  isOtpSuspended?: (companyId: string) => Promise<boolean>;
};

const invalidRequest = () =>
  new ApiError({
    code: "INVALID_REQUEST",
    message: "Username and password are required",
    status: 400,
  });

const readCredentials = async (request: Request) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw invalidRequest();
  }

  if (!body || typeof body !== "object") {
    throw invalidRequest();
  }

  const { username, password } = body as Record<string, unknown>;
  const normalizedUsername =
    typeof username === "string" ? username.trim() : "";

  if (
    normalizedUsername.length === 0 ||
    normalizedUsername.length > 100 ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 1024
  ) {
    throw invalidRequest();
  }

  return { username: normalizedUsername, password };
};

export const createLoginHandler = (
  dependencies: LoginHandlerDependencies = {},
) =>
  async function loginHandler(request: Request) {
    const context = auditRequestContext(request);
    // Captured before authentication so a failed attempt still records the name that was tried.
    let attemptedUsername: string | null = null;

    try {
      const credentials = await readCredentials(request);
      attemptedUsername = credentials.username;
      const principal = await (
        dependencies.authenticate ?? authenticateCredentials
      )(credentials.username, credentials.password);
      const production = dependencies.production ?? isSecureRequest(request);

      // An EMPLOYEE whose email check is missing or older than 2 days gets no session yet: only a
      // short pending cookie that lets them request and confirm the emailed code.
      // HRD can switch the code off for one company for up to 24 hours (Master Data > System).
      const suspended =
        principal.role === "EMPLOYEE" && principal.companyId
          ? await (dependencies.isOtpSuspended ?? ((companyId: string) =>
              prismaOtpSuspensionStore.isSuspended(companyId, new Date())))(principal.companyId)
          : false;
      if (principal.role === "EMPLOYEE" && isLoginOtpEnabled() && !suspended) {
        const state = await (dependencies.otpStore ?? prismaLoginOtpStore).getAccountState(principal.userId);
        if (!isOtpVerificationCurrent(state?.otpVerifiedUntil ?? null)) {
          const response = apiSuccess({ otpRequired: true, maskedEmail: maskEmail(state?.email ?? null) });
          response.headers.set("Cache-Control", "no-store");
          setPendingCookie(response, createPendingToken(principal.userId), production);
          await recordAuditQuietly({
            category: "AUTH",
            action: "LOGIN_OTP_REQUIRED",
            actor: { userId: principal.userId, username: principal.username, role: principal.role },
            ...context,
          });
          return response;
        }
      }

      return await startSession(request, principal, {
        createToken: dependencies.createToken,
        production,
      });
    } catch (error: unknown) {
      console.error("[Login Handler Error]", error);

      await recordAuditQuietly({
        category: "AUTH",
        action: "LOGIN_FAILED",
        // No userId: a failed attempt has not proven who the caller is.
        actor: { username: attemptedUsername },
        detail: {
          reason: error instanceof ApiError ? error.code : "UNEXPECTED_ERROR",
        },
        ...context,
      });

      const response = apiFailure(error);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  };

export const POST = createLoginHandler();

