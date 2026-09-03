import type { NextRequest } from "next/server";
import { apiSuccess } from "../../../../../../lib/api/response";
import { createProtectedRoute, type ProtectedRouteOptions } from "../../../../../../lib/auth/guard";
import { trainingFormsService, type TrainingFormsService } from "../../../../../../lib/trainingForms/service";
import { parseEvaluationTiming } from "../../../../../../lib/trainingForms/validation";

type Dependencies = { auth?: ProtectedRouteOptions; service?: TrainingFormsService };
type RouteContext = { params: Promise<{ planId: string; timing: string }> };

const options = (auth?: ProtectedRouteOptions) => ({ ...auth, allowedRoles: ["HRD_CENTER", "HRD_FACTORY"] as const });

/** Aggregated evaluation answers for one plan. HRD only - the summary itself carries no identities
 *  (see readEvaluationSummary), but who took which course is still not employees' business. */
export const createReadEvaluationSummaryHandler = (dependencies: Dependencies = {}) =>
  createProtectedRoute<RouteContext>(async (_request: NextRequest, principal, { params }) => {
    const { planId, timing } = await params;
    const summary = await (dependencies.service ?? trainingFormsService).readEvaluationSummary(
      planId,
      parseEvaluationTiming(timing),
      principal.role === "HRD_FACTORY" ? principal.companyId : null,
    );
    return apiSuccess({ summary });
  }, options(dependencies.auth));

export const GET = createReadEvaluationSummaryHandler();
