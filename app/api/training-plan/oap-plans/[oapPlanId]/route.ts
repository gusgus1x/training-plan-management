import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { oapPlanService, type OapPlanService } from "../../../../lib/trainingOap/service";
import { parseUpdateOapPlan } from "../../../../lib/trainingOap/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: OapPlanService };

const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createUpdateOapPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ oapPlanId: string }> }) => {
    const { oapPlanId } = await params;
    const input = parseUpdateOapPlan(await readJsonObject(request));
    const oapPlan = await (dependencies.service ?? oapPlanService).updateOapPlan(oapPlanId, input, principal.userId);
    return apiSuccess({ oapPlan });
  }, writeOptions(dependencies.auth));

export const createDeleteOapPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ oapPlanId: string }> }) => {
    const { oapPlanId } = await params;
    const result = await (dependencies.service ?? oapPlanService).deleteOapPlan(oapPlanId, {
      userId: principal.userId,
      username: principal.username,
      role: principal.role,
    });
    return apiSuccess(result);
  }, writeOptions(dependencies.auth));

export const PUT = createUpdateOapPlanHandler();
export const DELETE = createDeleteOapPlanHandler();
