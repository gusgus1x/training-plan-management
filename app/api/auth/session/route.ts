import type { NextRequest } from "next/server";
import { ApiError } from "../../../lib/api/errors";
import { apiFailure, apiSuccess } from "../../../lib/api/response";
import { revalidateAuthenticatedUser } from "../../../lib/auth/authentication";
import {
  clearSessionCookie,
  createSessionToken,
  isSecureRequest,
  SESSION_COOKIE_NAME,
  SESSION_REVALIDATE_SECONDS,
  setSessionCookie,
  verifySessionToken,
  type SessionPayload,
} from "../../../lib/auth/session";
import type { AuthenticatedPrincipal } from "../../../lib/auth/types";

export const dynamic = "force-dynamic";

type SessionHandlerDependencies = {
  verifyToken?: (token: string) => SessionPayload | null;
  revalidate?: (userId: string) => Promise<AuthenticatedPrincipal>;
  rollToken?: (payload: SessionPayload) => string;
  production?: boolean;
  now?: () => number;
  revalidateAfterSeconds?: number;
};

const unauthenticated = () =>
  new ApiError({
    code: "UNAUTHENTICATED",
    message: "Authentication required",
    status: 401,
  });

export const createSessionHandler = (
  dependencies: SessionHandlerDependencies = {},
) =>
  async function sessionHandler(request: NextRequest) {
    try {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      const payload = token
        ? (dependencies.verifyToken ?? verifySessionToken)(token)
        : null;

      if (!payload) {
        throw unauthenticated();
      }

      // Version 1 sessions contain only a user id and require a blocking SQL
      // lookup. Expire them immediately so LAN clients can sign in once and
      // receive the self-contained, signed version 2 session.
      if (payload.version === 1) {
        throw unauthenticated();
      }

      const now = dependencies.now?.() ?? Math.floor(Date.now() / 1000);
      const revalidateAfterSeconds =
        dependencies.revalidateAfterSeconds ?? SESSION_REVALIDATE_SECONDS;
      const canUseCachedPrincipal =
        now - payload.validatedAt < revalidateAfterSeconds;
      const principal = canUseCachedPrincipal
        ? payload.principal
        : await (dependencies.revalidate ?? revalidateAuthenticatedUser)(
            payload.userId,
          );
      const validatedAt = canUseCachedPrincipal ? payload.validatedAt : now;
      const rolledToken = dependencies.rollToken
        ? dependencies.rollToken(payload)
        : createSessionToken(payload.userId, {
            issuedAt: payload.issuedAt,
            principal,
            validatedAt,
          });
      const response = apiSuccess({ user: principal });

      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Vary", "Cookie");
      setSessionCookie(response, rolledToken, dependencies.production ?? isSecureRequest(request));

      return response;
    } catch (error: unknown) {
      const response = apiFailure(error);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Vary", "Cookie");

      if (error instanceof ApiError && error.status === 401) {
        clearSessionCookie(response, dependencies.production ?? isSecureRequest(request));
      }

      return response;
    }
  };

export const GET = createSessionHandler();

