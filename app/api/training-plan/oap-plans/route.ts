import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../lib/api/response";
import { readJsonObject } from "../../../lib/api/validation";
import { recordCreateAudit } from "../../../lib/audit";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../lib/auth/guard";
import { oapPlanService, type OapPlanService } from "../../../lib/trainingOap/service";
import { parseCreateOapPlan, parseOapPlanListFilters } from "../../../lib/trainingOap/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: OapPlanService };

const readOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });
const writeOptions = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

export const createListOapPlansHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request: NextRequest, principal) => {
    const result = await (dependencies.service ?? oapPlanService).listOapPlans(
      parseOapPlanListFilters(request.nextUrl.searchParams),
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );
    return apiSuccess({ oapPlans: result });
  }, readOptions(dependencies.auth));

export const createCreateOapPlanHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute(async (request, principal) => {
    const input = parseCreateOapPlan(await readJsonObject(request));
    const oapPlan = await (dependencies.service ?? oapPlanService).createOapPlan(
      input,
      principal.userId,
      principal.role === "HRD_FACTORY" ? principal.companyId : null
    );

    await recordCreateAudit(
      request,
      principal,
      "oap_plan",
      oapPlan.id,
      oapPlan.course?.courseNameTh || oapPlan.course?.courseNameEn || undefined,
      { planYear: input.planYear }
    );

    return apiSuccess({ oapPlan }, 201);
  }, writeOptions(dependencies.auth));

export const GET = createListOapPlansHandler();
export const POST = createCreateOapPlanHandler();
