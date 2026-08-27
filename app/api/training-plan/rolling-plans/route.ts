import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { rollingPlanService, type RollingPlanService } from "../../../lib/trainingRolling/service";
import { parseCreateRollingPlan, parseRollingPlanListFilters } from "../../../lib/trainingRolling/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: RollingPlanService };

const readOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY", "EMPLOYEE"] as const });
const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListRollingPlansHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const result = await (dependencies.service ?? rollingPlanService).listRollingPlans(
      parseRollingPlanListFilters(request.nextUrl.searchParams),
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ rollingPlans: result });
  }, readOptions(dependencies.auth));

export const createCreateRollingPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request, principal) => {
    const input = parseCreateRollingPlan(await readJsonObject(request));
    const rollingPlan = await (dependencies.service ?? rollingPlanService).createRollingPlan(
      input,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ rollingPlan }, 201);
  }, writeOptions(dependencies.auth));

export const GET = createListRollingPlansHandler();
export const POST = createCreateRollingPlanHandler();
