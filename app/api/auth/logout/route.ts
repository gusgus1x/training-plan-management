import { apiSuccess } from "../../../lib/api/response";
import { clearSessionCookie, isSecureRequest } from "../../../lib/auth/session";

type LogoutHandlerDependencies = {
  production?: boolean;
};

export const createLogoutHandler = (
  dependencies: LogoutHandlerDependencies = {},
) =>
  async function logoutHandler(request: Request) {
    const response = apiSuccess({ status: "logged_out" as const });

    response.headers.set("Cache-Control", "no-store");
    clearSessionCookie(response, dependencies.production ?? isSecureRequest(request));

    return response;
  };

export const POST = createLogoutHandler();

