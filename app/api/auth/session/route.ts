import type { NextRequest } from "next/server";
import { ApiError } from "../../../lib/api/errors";
import { apiFailure, apiSuccess } from "../../../lib/api/response";
import { revalidateAuthenticatedUser } from "../../../lib/auth/authentication";
import {
  clearSessionCookie,
  createSessionToken,
  SESSION_COOKIE_NAME,
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

      const principal = await (
        dependencies.revalidate ?? revalidateAuthenticatedUser
      )(payload.userId);
      const rolledToken = (
        dependencies.rollToken ??
        ((currentPayload: SessionPayload) =>
          createSessionToken(currentPayload.userId, {
            issuedAt: currentPayload.issuedAt,
          }))
      )(payload);
      const response = apiSuccess({ user: principal });

      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Vary", "Cookie");
      setSessionCookie(response, rolledToken, dependencies.production);

      return response;
    } catch (error: unknown) {
      const response = apiFailure(error);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Vary", "Cookie");

      if (error instanceof ApiError && error.status === 401) {
        clearSessionCookie(response, dependencies.production);
      }

      return response;
    }
  };

export const GET = createSessionHandler();

