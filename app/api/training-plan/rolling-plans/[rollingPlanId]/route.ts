import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../lib/api/response";
import { readJsonObject } from "../../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../lib/auth/guard";
import { rollingPlanService, type RollingPlanService } from "../../../../lib/trainingRolling/service";
import { parseUpdateRollingPlan } from "../../../../lib/trainingRolling/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: RollingPlanService };

const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createUpdateRollingPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ rollingPlanId: string }> }) => {
    const { rollingPlanId } = await params;
    const input = parseUpdateRollingPlan(await readJsonObject(request));
    const rollingPlan = await (dependencies.service ?? rollingPlanService).updateRollingPlan(
      rollingPlanId,
      input,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ rollingPlan });
  }, writeOptions(dependencies.auth));

export const createDeleteRollingPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal, { params }: { params: Promise<{ rollingPlanId: string }> }) => {
    const { rollingPlanId } = await params;
    const result = await (dependencies.service ?? rollingPlanService).deleteRollingPlan(rollingPlanId);
    return apiSuccess(result);
  }, writeOptions(dependencies.auth));

export const PUT = createUpdateRollingPlanHandler();
export const DELETE = createDeleteRollingPlanHandler();
