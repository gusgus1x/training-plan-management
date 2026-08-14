import { cookies } from "next/headers";
import type { ClientSessionUser } from "./client";
import { revalidateAuthenticatedUser } from "./authentication";
import {
  SESSION_COOKIE_NAME,
  SESSION_REVALIDATE_SECONDS,
  verifySessionToken,
} from "./session";
import type { AuthenticatedPrincipal } from "./types";

// Read-only mirror of app/api/auth/session/route.ts for use in Server Components
// (Server Components can't set cookies, so this never rolls the session token —
// the API route remains the roller for any future client-side session refresh).
export const getServerSession =
  async (): Promise<AuthenticatedPrincipal | null> => {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    const payload = token ? verifySessionToken(token) : null;

    if (!payload || payload.version === 1) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - payload.validatedAt < SESSION_REVALIDATE_SECONDS) {
      return payload.principal;
    }

    try {
      return await revalidateAuthenticatedUser(payload.userId);
    } catch {
      return null;
    }
  };

const toClientSessionUser = ({
  role,
  ...rest
}: AuthenticatedPrincipal): ClientSessionUser => ({ ...rest, roleCode: role });

export const getServerSessionUser =
  async (): Promise<ClientSessionUser | null> => {
    const principal = await getServerSession();
    return principal ? toClientSessionUser(principal) : null;
  };
