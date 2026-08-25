import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../lib/api/response";
import { readJsonObject, readPositiveId } from "../../../../../lib/api/validation";
import { auditRequestContext, recordAudit } from "../../../../../lib/audit";
import {
  createProtectedRoute,
  type ProtectedRouteOptions,
} from "../../../../../lib/auth/guard";
import {
  userAccountService,
  type UserAccountService,
} from "../../../../../lib/userAccounts/service";
import { readPassword } from "../../../../../lib/userAccounts/validation";

type Context = { params: Promise<{ userId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: UserAccountService };

/**
 * Password reset is its own endpoint rather than a field on the edit route: it keeps the new
 * secret out of ordinary account edits, and gives the audit trail a distinct action to show.
 */
export const createResetPasswordHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request: NextRequest, principal, context) => {
      const userId = readPositiveId((await context.params).userId, "userId");
      const password = readPassword(await readJsonObject(request));
      const account = await (dependencies.service ?? userAccountService).resetPassword(
        userId,
        password,
      );

      await recordAudit({
        category: "ACCOUNT",
        action: "USER_ACCOUNT_PASSWORD_RESET",
        actor: {
          userId: principal.userId,
          username: principal.username,
          role: principal.role,
        },
        entityType: "user_account",
        entityId: userId,
        entityLabel: account.username,
        // Never the password itself, not even its length.
        ...auditRequestContext(request),
      });

      return apiSuccess({ account });
    },
    { ...dependencies.auth, allowedRoles: ["ADMIN"] as const },
  );

export const POST = createResetPasswordHandler();
