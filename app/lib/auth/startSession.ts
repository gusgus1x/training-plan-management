import { apiSuccess } from "../api/response";
import { auditRequestContext, recordAuditQuietly } from "../audit";
import { trackUserSession } from "./activeSessions";
import { createSessionToken, setSessionCookie } from "./session";
import type { AuthenticatedPrincipal } from "./types";

export type SessionTokenFactory = (userId: string, principal: AuthenticatedPrincipal) => string;

/** Issues the real session. Shared by a plain login and by a confirmed email code. */
export const startSession = async (
  request: Request,
  principal: AuthenticatedPrincipal,
  options: { createToken?: SessionTokenFactory; production: boolean },
) => {
  const context = auditRequestContext(request);
  const token = options.createToken
    ? options.createToken(principal.userId, principal)
    : createSessionToken(principal.userId, { principal });
  const response = apiSuccess({ user: principal });

  response.headers.set("Cache-Control", "no-store");
  setSessionCookie(response, token, options.production);

  trackUserSession({
    userId: principal.userId,
    username: principal.username,
    role: principal.role,
    companyCode: principal.companyCode ?? null,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    currentPage: "เข้าสู่ระบบ (Login)",
  });

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
};
