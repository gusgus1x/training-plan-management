import { ApiError } from "../../../lib/api/errors";
import { apiFailure, apiSuccess } from "../../../lib/api/response";
import { authenticateCredentials } from "../../../lib/auth/authentication";
import {
  createSessionToken,
  setSessionCookie,
} from "../../../lib/auth/session";
import type { AuthenticatedPrincipal } from "../../../lib/auth/types";

type LoginHandlerDependencies = {
  authenticate?: (
    username: string,
    password: string,
  ) => Promise<AuthenticatedPrincipal>;
  createToken?: (userId: string) => string;
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
    try {
      const credentials = await readCredentials(request);
      const principal = await (
        dependencies.authenticate ?? authenticateCredentials
      )(credentials.username, credentials.password);
      const token = (dependencies.createToken ?? createSessionToken)(
        principal.userId,
      );
      const response = apiSuccess({ user: principal });

      response.headers.set("Cache-Control", "no-store");
      setSessionCookie(response, token, dependencies.production);

      return response;
    } catch (error: unknown) {
      const response = apiFailure(error);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  };

export const POST = createLoginHandler();

