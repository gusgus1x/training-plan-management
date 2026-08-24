import { NextResponse } from "next/server";
import { ApiError } from "../../../lib/api/errors";
import { apiFailure, apiSuccess } from "../../../lib/api/response";
import { auditRequestContext, recordAuditQuietly } from "../../../lib/audit";
import { authenticateCredentials } from "../../../lib/auth/authentication";
import {
  createSessionToken,
  isSecureRequest,
  setSessionCookie,
} from "../../../lib/auth/session";
import type { AuthenticatedPrincipal } from "../../../lib/auth/types";

type LoginHandlerDependencies = {
  authenticate?: (
    username: string,
    password: string,
  ) => Promise<AuthenticatedPrincipal>;
  createToken?: (
    userId: string,
    principal: AuthenticatedPrincipal,
  ) => string;
  production?: boolean;
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
      const token = dependencies.createToken
        ? dependencies.createToken(principal.userId, principal)
        : createSessionToken(principal.userId, { principal });
      const response = apiSuccess({ user: principal });

      response.headers.set("Cache-Control", "no-store");
      setSessionCookie(response, token, dependencies.production ?? isSecureRequest(request));

      await recordAuditQuietly({
        category: "AUTH",
        action: "LOGIN_SUCCEEDED",
        actor: {
          userId: principal.userId,
          username: principal.username,
          role: principal.role,
        },
        ...context,
      });

      return response;
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

