import type { NextRequest, NextResponse } from "next/server";
import { ApiError } from "../api/errors";
import { apiFailure } from "../api/response";
import { revalidateAuthenticatedUser } from "./authentication";
import { requireRole } from "./authorization";
import {
  clearSessionCookie,
  createSessionToken,
  isSecureRequest,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifySessionToken,
  type SessionPayload,
} from "./session";
import type { AuthenticatedPrincipal, RoleCode } from "./types";

type ProtectedRouteHandler<RouteContext> = (
  request: NextRequest,
  principal: AuthenticatedPrincipal,
  routeContext: RouteContext,
) => Promise<NextResponse>;

export type ProtectedRouteOptions = {
  allowedRoles?: readonly RoleCode[];
  production?: boolean;
  revalidate?: (userId: string) => Promise<AuthenticatedPrincipal>;
  rollToken?: (payload: SessionPayload) => string;
  verifyToken?: (token: string) => SessionPayload | null;
};

const unauthenticated = () =>
  new ApiError({
    code: "UNAUTHENTICATED",
    message: "Authentication required",
    status: 401,
  });

const applyPrivateResponseHeaders = (response: NextResponse) => {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Cookie");
};

export const authenticateApiRequest = async (
  request: NextRequest,
  options: ProtectedRouteOptions = {},
) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token
    ? (options.verifyToken ?? verifySessionToken)(token)
    : null;

  if (!payload) {
    throw unauthenticated();
  }

  const principal = await (
    options.revalidate ?? revalidateAuthenticatedUser
  )(payload.userId);
  const rolledToken = (
    options.rollToken ??
    ((currentPayload: SessionPayload) =>
      createSessionToken(currentPayload.userId, {
        issuedAt: currentPayload.issuedAt,
      }))
  )(payload);

  return { principal, rolledToken };
};

export const createProtectedRoute = <RouteContext = unknown>(
  handler: ProtectedRouteHandler<RouteContext>,
  options: ProtectedRouteOptions = {},
) =>
  async function protectedRoute(
    request: NextRequest,
    routeContext?: RouteContext,
  ) {
    try {
      const { principal, rolledToken } = await authenticateApiRequest(
        request,
        options,
      );

      if (options.allowedRoles) {
        requireRole(principal, options.allowedRoles);
      }

      const response = await handler(
        request,
        principal,
        routeContext as RouteContext,
      );

      applyPrivateResponseHeaders(response);
      setSessionCookie(response, rolledToken, options.production ?? isSecureRequest(request));
      return response;
    } catch (error: unknown) {
      const response = apiFailure(error);

      applyPrivateResponseHeaders(response);

      if (error instanceof ApiError && error.status === 401) {
        clearSessionCookie(response, options.production ?? isSecureRequest(request));
      }

      return response;
    }
  };
