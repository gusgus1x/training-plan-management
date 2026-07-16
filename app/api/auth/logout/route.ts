import { apiSuccess } from "../../../lib/api/response";
import { clearSessionCookie } from "../../../lib/auth/session";

type LogoutHandlerDependencies = {
  production?: boolean;
};

export const createLogoutHandler = (
  dependencies: LogoutHandlerDependencies = {},
) =>
  async function logoutHandler() {
    const response = apiSuccess({ status: "logged_out" as const });

    response.headers.set("Cache-Control", "no-store");
    clearSessionCookie(response, dependencies.production);

    return response;
  };

export const POST = createLogoutHandler();

