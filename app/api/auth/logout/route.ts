import { apiSuccess } from "../../../lib/api/response";
import { auditRequestContext, recordAuditQuietly } from "../../../lib/audit";
import {
  clearSessionCookie,
  isSecureRequest,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../../../lib/auth/session";

type LogoutHandlerDependencies = {
  production?: boolean;
};

// Sign-out never rejects, so the cookie is read only to name the actor in the log.
const readSessionActor = (request: Request) => {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (!token) return null;

  const payload = verifySessionToken(decodeURIComponent(token));
  if (!payload) return null;

  // Only version 2 sessions carry the principal inline; version 1 holds just the user id.
  const principal = payload.version === 2 ? payload.principal : null;

  return {
    userId: payload.userId,
    username: principal?.username ?? null,
    role: principal?.role ?? null,
  };
};

export const createLogoutHandler = (
  dependencies: LogoutHandlerDependencies = {},
) =>
  async function logoutHandler(request: Request) {
    const actor = readSessionActor(request);
    const response = apiSuccess({ status: "logged_out" as const });

    response.headers.set("Cache-Control", "no-store");
    clearSessionCookie(response, dependencies.production ?? isSecureRequest(request));

    await recordAuditQuietly({
      category: "AUTH",
      action: "LOGOUT",
      actor: actor ?? undefined,
      ...auditRequestContext(request),
    });

    return response;
  };

export const POST = createLogoutHandler();

