import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { auditRequestContext, recordAudit } from "../../../lib/audit";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { userAccountService, type UserAccountService } from "../../../lib/userAccounts/service";
import {
  parseCreateUserAccount,
  parseUserAccountListFilters,
} from "../../../lib/userAccounts/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: UserAccountService };

const adminOnly = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["ADMIN"] as const,
});

export const createListUserAccountsHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest) => {
    const accounts = await (dependencies.service ?? userAccountService).list(
      parseUserAccountListFilters(request.nextUrl.searchParams),
    );
    return apiSuccess({ accounts });
  }, adminOnly(dependencies.auth));

export const createCreateUserAccountHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const input = parseCreateUserAccount(await readJsonObject(request));
    const account = await (dependencies.service ?? userAccountService).create(input);

    // Fail-closed: an account that exists with no record of who created it is worse than a
    // failed request the administrator can retry.
    await recordAudit({
      category: "ACCOUNT",
      action: "USER_ACCOUNT_CREATED",
      actor: {
        userId: principal.userId,
        username: principal.username,
        role: principal.role,
      },
      entityType: "user_account",
      entityId: account.userId,
      entityLabel: account.username,
      detail: { roleCode: account.roleCode, status: account.status },
      ...auditRequestContext(request),
    });

    return apiSuccess({ account }, 201);
  }, adminOnly(dependencies.auth));

export const GET = createListUserAccountsHandler();
export const POST = createCreateUserAccountHandler();
