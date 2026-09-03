import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject, readPositiveId } from "../../../../lib/api/validation";
import { auditRequestContext, recordAudit } from "../../../../lib/audit";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import {
  userAccountService,
  type UserAccountService,
} from "../../../../lib/userAccounts/service";
import { parseUpdateUserAccount } from "../../../../lib/userAccounts/validation";

type Context = { params: Promise<{ userId: string }> };
type Dependencies = { auth?: ProtectedRouteOptions; service?: UserAccountService };

const adminOnly = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["ADMIN"] as const,
});

const id = async (context: Context) =>
  readPositiveId((await context.params).userId, "userId");

export const createGetUserAccountHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (_request, _principal, context) =>
      apiSuccess({
        account: await (dependencies.service ?? userAccountService).get(await id(context)),
      }),
    adminOnly(dependencies.auth),
  );

export const createUpdateUserAccountHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request: NextRequest, principal, context) => {
      const userId = await id(context);
      const input = parseUpdateUserAccount(await readJsonObject(request));
      const account = await (dependencies.service ?? userAccountService).update(
        principal,
        userId,
        input,
      );

      await recordAudit({
        category: "ACCOUNT",
        action: "USER_ACCOUNT_UPDATED",
        actor: {
          userId: principal.userId,
          username: principal.username,
          role: principal.role,
        },
        entityType: "user_account",
        entityId: userId,
        entityLabel: account.username,
        // Records what was asked for, so a role change or a disable is visible without diffing.
        detail: { changed: input },
        ...auditRequestContext(request),
      });

      return apiSuccess({ account });
    },
    adminOnly(dependencies.auth),
  );

export const createDeleteUserAccountHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<Context>(
    async (request: NextRequest, principal, context) => {
      const userId = await id(context);
      const service = dependencies.service ?? userAccountService;
      const targetUser = await service.get(userId);

      await service.delete(principal, userId);

      await recordAudit({
        category: "DELETE",
        action: "USER_ACCOUNT_DELETED",
        actor: {
          userId: principal.userId,
          username: principal.username,
          role: principal.role,
        },
        entityType: "user_account",
        entityId: userId,
        entityLabel: targetUser.username,
        detail: { roleCode: targetUser.roleCode },
        ...auditRequestContext(request),
      });

      return apiSuccess({ success: true });
    },
    adminOnly(dependencies.auth),
  );

export const GET = createGetUserAccountHandler();
export const PATCH = createUpdateUserAccountHandler();
export const DELETE = createDeleteUserAccountHandler();
