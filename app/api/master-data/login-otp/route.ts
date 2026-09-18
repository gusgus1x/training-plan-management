import type { NextRequest } from "next/server";
import { ApiError } from "../../../lib/api/errors";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { auditRequestContext, recordAuditQuietly } from "../../../lib/audit";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import {
  canManageCompany,
  forbiddenCompany,
  prismaOtpSuspensionStore,
  type OtpSuspensionStore,
} from "../../../lib/auth/loginOtpSuspension";

type Dependencies = { auth?: ProtectedRouteOptions; store?: OtpSuspensionStore; now?: () => Date };

const options = (auth?: ProtectedRouteOptions) => ({
  ...auth,
  allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const,
});

/** GET: every company for HRD Center, only its own for HRD Factory. */
export const createListLoginOtpHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (_request: NextRequest, principal) => {
    const now = (dependencies.now ?? (() => new Date()))();
    const scope = principal.role === "HRD_CENTER" ? null : principal.companyId ? [principal.companyId] : [];
    const companies = await (dependencies.store ?? prismaOtpSuspensionStore).list(scope, now);
    return apiSuccess({ companies });
  }, options(dependencies.auth));

/** POST { companyId, enabled }: false switches the code off for 24 hours, true switches it back on. */
export const createSetLoginOtpHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const body = await readJsonObject(request);
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    if (!/^[1-9]\d*$/.test(companyId) || typeof body.enabled !== "boolean") {
      throw new ApiError({ code: "INVALID_REQUEST", message: "companyId and enabled are required", status: 400 });
    }
    if (!canManageCompany(principal, companyId)) throw forbiddenCompany();

    const store = dependencies.store ?? prismaOtpSuspensionStore;
    const now = (dependencies.now ?? (() => new Date()))();
    const suspendedUntil = body.enabled ? null : await store.suspend(companyId, principal.userId, now);
    if (body.enabled) await store.resume(companyId);

    await recordAuditQuietly({
      category: "UPDATE",
      action: body.enabled ? "LOGIN_OTP_RESUMED" : "LOGIN_OTP_SUSPENDED",
      actor: { userId: principal.userId, username: principal.username, role: principal.role },
      entityType: "company",
      entityId: companyId,
      detail: suspendedUntil ? { until: suspendedUntil.toISOString() } : undefined,
      ...auditRequestContext(request),
    });

    return apiSuccess({ companyId, suspendedUntil });
  }, options(dependencies.auth));

export const GET = createListLoginOtpHandler();
export const POST = createSetLoginOtpHandler();
